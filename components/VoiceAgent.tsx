import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Mic, MicOff, Phone, Loader2, Clock } from 'lucide-react';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioUtils';
import { SYSTEM_INSTRUCTION } from '../constants';

// Define the tool schema
const checkAvailabilityTool: FunctionDeclaration = {
  name: 'checkAvailability',
  description: 'Check if a table is available for a given party size, date and time.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      partySize: { type: Type.NUMBER, description: 'Number of people' },
      date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      time: { type: Type.STRING, description: 'HH:mm' },
    },
    required: ['partySize', 'date', 'time'],
  },
};

const makeReservationTool: FunctionDeclaration = {
  name: 'makeReservation',
  description: 'Finalize a reservation or a takeaway order.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      partySize: { type: Type.NUMBER },
      date: { type: Type.STRING },
      time: { type: Type.STRING },
      customerName: { type: Type.STRING },
      contactInfo: { type: Type.STRING, description: "Phone number" },
      notes: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['dine-in', 'takeaway'], description: "Type of reservation: dine-in (default) or takeaway (food pickup)" }
    },
    required: ['partySize', 'date', 'time', 'customerName', 'contactInfo'],
  },
};

const cancelReservationTool: FunctionDeclaration = {
    name: 'cancelReservation',
    description: 'Find and cancel an existing reservation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING, description: "Name of the customer (fuzzy match)" },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        time: { type: Type.STRING, description: "HH:mm" },
      },
      required: ['customerName', 'date', 'time'],
    },
};

const getInfoTool: FunctionDeclaration = {
    name: 'getInfo',
    description: 'Get specific information about the restaurant.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            category: { type: Type.STRING, enum: ['menu', 'hours', 'parking', 'events', 'allergies', 'location'] }
        },
        required: ['category']
    }
}

interface VoiceAgentProps {
  onToolCall: (name: string, args: any) => Promise<any>;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({ onToolCall }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // User speaking
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [volume, setVolume] = useState(0); // For visualization
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [timeLeft, setTimeLeft] = useState(120); // 2 Minutes Demo Limit
  
  // Holds the "Alessia.wav" content (ArrayBuffer)
  const [introAudioBuffer, setIntroAudioBuffer] = useState<ArrayBuffer | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  // Race condition prevention
  const connectionIdRef = useRef<string>('');

  // Fetch the "Alessia.wav" file on mount
  useEffect(() => {
     fetch('/Alessia.wav')
        .then(response => response.arrayBuffer())
        .then(buffer => {
            console.log("Intro audio loaded", buffer.byteLength);
            setIntroAudioBuffer(buffer);
        })
        .catch(err => console.warn("Failed to load intro audio", err));
  }, []);

  // Initialize contexts
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputContextRef.current) {
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  const playIntroAudio = async () => {
      if (!introAudioBuffer || !audioContextRef.current) return;
      
      try {
          const audioCtx = audioContextRef.current;
          // Decode the stored buffer
          const bufferCopy = introAudioBuffer.slice(0);
          const buffer = await audioCtx.decodeAudioData(bufferCopy);
          
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          
          setIsAgentSpeaking(true); // Visual indicator ON
          
          source.addEventListener('ended', () => {
               if (sourcesRef.current.has(source) && sourcesRef.current.size === 1) {
                   setIsAgentSpeaking(false);
               }
               sourcesRef.current.delete(source);
          });
          
          source.start(0);
          sourcesRef.current.add(source); 
      } catch (e) {
          console.error("Failed to play intro", e);
      }
  };

  const disconnect = useCallback(() => {
    // Invalidate the current connection ID
    connectionIdRef.current = ''; 
    
    setIsConnected(false);
    setStatus('idle');
    setTimeLeft(120); // Reset timer
    
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (inputContextRef.current) {
        try { inputContextRef.current.close(); } catch(e) {}
        inputContextRef.current = null;
    }
    
    // Stop all audio immediately
    sourcesRef.current.forEach(src => {
        try { src.stop(); src.disconnect(); } catch(e){}
    });
    sourcesRef.current.clear();
    
    setIsAgentSpeaking(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  // Timer Logic
  useEffect(() => {
      let interval: any;
      if (isConnected && timeLeft > 0) {
          interval = setInterval(() => {
              setTimeLeft((prev) => prev - 1);
          }, 1000);
      } else if (isConnected && timeLeft === 0) {
          // Time's up
          disconnect();
          alert("Tempo Demo Scaduto (2 min). La chiamata è stata terminata.");
      }
      return () => clearInterval(interval);
  }, [isConnected, timeLeft, disconnect]);

  const connect = async () => {
    ensureAudioContext();
    
    let apiKey = '';
    try {
        apiKey = process.env.API_KEY || '';
    } catch (e) {
        console.error("Error accessing process.env", e);
    }

    if (!apiKey) {
      alert("API Key not found in environment variables");
      return;
    }

    const currentConnectionId = Math.random().toString(36).substring(7);
    connectionIdRef.current = currentConnectionId;

    try {
      setStatus('connecting');
      setIsConnected(true);
      setTimeLeft(120); // Reset timer on connect
      
      // 1. PLAY INTRO IMMEDIATELY
      if (introAudioBuffer) {
          playIntroAudio();
      }

      // 2. CONNECT LIVE IN BACKGROUND
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ai = new GoogleGenAI({ apiKey });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
          tools: [{ functionDeclarations: [checkAvailabilityTool, makeReservationTool, getInfoTool, cancelReservationTool] }],
        },
        callbacks: {
          onopen: () => {
            if (connectionIdRef.current !== currentConnectionId) return;
            console.log("Connection opened");
            setStatus('connected');
            
            // Setup Microphone Stream
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (connectionIdRef.current !== currentConnectionId) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Visualization math
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              
              const targetVol = Math.min(100, rms * 800);
              setVolume(prev => prev * 0.8 + targetVol * 0.2); 
              setIsSpeaking(rms > 0.01);

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                  if (connectionIdRef.current === currentConnectionId) {
                      session.sendRealtimeInput({ media: pcmBlob });
                  }
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (connectionIdRef.current !== currentConnectionId) return;

            // Handle Audio
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
                setIsAgentSpeaking(true);
                const audioCtx = audioContextRef.current;
                
                try {
                    const buffer = await decodeAudioData(base64ToUint8Array(audioData), audioCtx);
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
                    const source = audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtx.destination);
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) setIsAgentSpeaking(false);
                    });
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += buffer.duration;
                    sourcesRef.current.add(source);
                } catch (e) {
                    console.error("Audio decode error", e);
                }
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => {
                    try { src.stop(); } catch(e){}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAgentSpeaking(false);
            }

            // Handle Function Calls
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    const result = await onToolCall(fc.name, fc.args);
                    if (connectionIdRef.current === currentConnectionId) {
                        sessionPromise.then(session => session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result }
                            }
                        }));
                    }
                }
            }
          },
          onclose: () => {
            if (connectionIdRef.current === currentConnectionId) {
                setIsConnected(false);
                setStatus('idle');
            }
          },
          onerror: (err) => {
            if (connectionIdRef.current === currentConnectionId) {
                setIsConnected(false);
                setStatus('idle');
            }
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to connect", err);
      alert("Microphone access denied or connection failed.");
      if (connectionIdRef.current === currentConnectionId) {
          setIsConnected(false);
          setStatus('idle');
      }
    }
  };

  // Helper to format time
  const formatTimer = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


  return (
    <div className="flex flex-col items-center justify-center p-8 glass-panel rounded-2xl w-full shadow-2xl relative overflow-hidden transition-all duration-500 min-h-[400px]">
        
        {/* Dynamic Background Glow */}
        <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isConnected ? 'opacity-30' : 'opacity-5'} bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800`}></div>
        
        {/* Connection Status Label */}
        <div className="relative z-20 mb-8 flex flex-col items-center pointer-events-none">
            <h3 className={`text-2xl font-serif transition-colors duration-500 ${isConnected ? 'text-white' : 'text-slate-400'}`}>
                {isConnected ? "Alessia" : "La Dolce Vita"}
            </h3>
            <div className="h-6 flex items-center justify-center mt-2">
                 {status === 'connecting' && <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Connessione in corso...</span>}
                 {status === 'connected' && isAgentSpeaking && <span className="text-xs text-amber-400 font-bold tracking-widest animate-pulse">PARLANDO</span>}
                 {status === 'connected' && !isAgentSpeaking && <span className="text-xs text-emerald-400 font-bold tracking-widest">IN ASCOLTO</span>}
            </div>
        </div>

        {/* ORB VISUALIZER */}
        <div className="relative z-10 w-48 h-48 flex items-center justify-center mb-6">
            
            {/* 1. Base Idle Orb Background */}
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${isConnected ? 'opacity-0' : 'opacity-100'}`}></div>

            {/* 2. Agent Speaking Mode (Golden Glow) */}
            <div className={`absolute inset-0 rounded-full bg-amber-500/10 blur-xl transition-all duration-300 pointer-events-none ${isAgentSpeaking ? 'opacity-100 scale-150' : 'opacity-0 scale-100'}`}></div>
            <div className={`absolute inset-0 rounded-full border-2 border-amber-500/30 transition-all duration-300 pointer-events-none ${isAgentSpeaking ? 'opacity-100 scale-110' : 'opacity-0 scale-95'}`}></div>

            {/* 3. User Speaking Mode (Emerald Pulse) */}
            {/* Responsive rings based on volume */}
            <div 
                className={`absolute inset-0 rounded-full border border-emerald-500/20 bg-emerald-500/5 transition-transform duration-75 pointer-events-none ${isConnected && !isAgentSpeaking ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: `scale(${1 + volume / 50})` }}
            ></div>
             <div 
                className={`absolute inset-0 rounded-full border border-emerald-500/10 bg-emerald-500/5 transition-transform duration-100 delay-75 pointer-events-none ${isConnected && !isAgentSpeaking ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: `scale(${1 + volume / 30})` }}
            ></div>

            {/* 4. Core Button / Orb */}
            <button
                onClick={isConnected ? undefined : connect}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl z-30 group overflow-hidden
                    ${isConnected 
                        ? (isAgentSpeaking 
                            ? 'bg-amber-900/80 border-2 border-amber-500/50' 
                            : 'bg-slate-900/90 border-2 border-emerald-500/50') 
                        : 'border border-amber-500/30 hover:scale-105 active:scale-95 animate-[pulse_4s_ease-in-out_infinite]'}
                `}
                style={!isConnected ? {
                    background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 1) 0%, rgba(245, 158, 11, 1) 40%, rgba(180, 83, 9, 1) 80%)',
                    boxShadow: 'inset -4px -4px 10px rgba(0,0,0,0.4), inset 4px 4px 10px rgba(255,255,255,0.4), 0 0 20px rgba(245, 158, 11, 0.4)'
                } : undefined}
            >
                {isConnected ? (
                     // Connected State Icon
                     isAgentSpeaking ? (
                         // Wave animation
                         <div className="flex items-end gap-1 h-8">
                             <div className="w-1 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0s' }}></div>
                             <div className="w-1 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0.1s' }}></div>
                             <div className="w-1 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0.2s' }}></div>
                             <div className="w-1 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0.3s' }}></div>
                         </div>
                     ) : (
                         <Mic className={`w-8 h-8 transition-colors ${isSpeaking ? 'text-emerald-400' : 'text-slate-500'}`} />
                     )
                ) : (
                    // Idle State Icon (Glassy Orb look)
                    <Phone className="w-8 h-8 text-amber-950 drop-shadow-md" />
                )}
                
                {/* Glossy reflection for the orb */}
                {!isConnected && (
                    <div className="absolute top-2 left-3 w-8 h-4 bg-white/30 rounded-[100%] rotate-[-15deg] blur-[1px]"></div>
                )}
            </button>

        </div>

        {/* COUNTDOWN TIMER */}
        {isConnected && (
            <div className={`relative z-20 mb-6 flex flex-col items-center gap-1 ${timeLeft < 30 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                <div className="flex items-center gap-2 text-xs font-mono font-medium">
                    <Clock size={12} />
                    <span>Tempo Demo: {formatTimer(timeLeft)}</span>
                </div>
                {/* Progress bar */}
                <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${timeLeft < 30 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${(timeLeft / 120) * 100}%` }}
                    ></div>
                </div>
            </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-20 min-h-[60px] flex justify-center">
            {isConnected ? (
                 <button 
                    onClick={disconnect}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg shadow-rose-900/20 active:scale-95 z-20 relative pointer-events-auto"
                 >
                    <MicOff size={18} />
                    Termina Chiamata
                 </button>
            ) : (
                 <div className="text-amber-500/80 text-sm font-medium tracking-wide animate-pulse">
                    Tocca la sfera per iniziare
                 </div>
            )}
        </div>
        
        {/* Helper Text */}
        <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono text-center w-full pointer-events-none">
            {isConnected ? "Live Session Active" : (introAudioBuffer ? "Ready to call" : "Audio resource loading...")}
        </div>

    </div>
  );
};

export default VoiceAgent;