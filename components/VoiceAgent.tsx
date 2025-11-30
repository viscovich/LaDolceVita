

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Mic, MicOff, Phone, Volume2, Loader2, Sparkles } from 'lucide-react';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, fetchIntroAudio } from '../services/audioUtils';
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
  
  // Holds the "Alessia.wav" content (base64 PCM)
  const [introAudioBase64, setIntroAudioBase64] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const activeRef = useRef(false);

  // Fetch the "Alessia.wav" file on mount
  useEffect(() => {
      const apiKey = process.env.API_KEY;
      if(apiKey) {
          fetchIntroAudio(apiKey).then(base64 => {
              if (base64) {
                  console.log("Intro audio loaded.");
                  setIntroAudioBase64(base64);
              }
          });
      }
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
      if (!introAudioBase64 || !audioContextRef.current) return;
      
      try {
          const audioCtx = audioContextRef.current;
          const buffer = await decodeAudioData(base64ToUint8Array(introAudioBase64), audioCtx);
          
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          
          setIsAgentSpeaking(true); // Visual indicator ON
          
          source.addEventListener('ended', () => {
               // Only turn off if the live agent hasn't taken over yet (unlikely this fast, but safe)
               if (sourcesRef.current.size === 0) {
                   setIsAgentSpeaking(false);
               }
          });
          
          source.start(0);
          // We don't track this source in sourcesRef because we don't want to stop it if the live connection opens
      } catch (e) {
          console.error("Failed to play intro", e);
      }
  };

  const connect = async () => {
    ensureAudioContext();
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API Key not found in environment variables");
      return;
    }

    try {
      setStatus('connecting');
      activeRef.current = true;
      setIsConnected(true);
      
      // 1. PLAY INTRO IMMEDIATELY (Simulating "Alessia.wav")
      playIntroAudio();

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
            if (!activeRef.current) return;
            console.log("Connection opened");
            setStatus('connected');
            
            // Setup Microphone Stream
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!activeRef.current) return;

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
                  if (activeRef.current) {
                      session.sendRealtimeInput({ media: pcmBlob });
                  }
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!activeRef.current) return;

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
                    if (activeRef.current) {
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
            if (activeRef.current) {
                setIsConnected(false);
                setStatus('idle');
            }
          },
          onerror: (err) => {
            if (activeRef.current) {
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
      activeRef.current = false;
      setStatus('idle');
    }
  };

  const disconnect = useCallback(() => {
    activeRef.current = false;
    setIsConnected(false);
    setStatus('idle');
    
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (inputContextRef.current) {
        try { inputContextRef.current.close(); } catch(e) {}
        inputContextRef.current = null;
    }
    sourcesRef.current.forEach(src => {
        try { src.stop(); src.disconnect(); } catch(e){}
    });
    sourcesRef.current.clear();
    setIsAgentSpeaking(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);


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
                 {status === 'connecting' && <span className="text-amber-500 text-xs animate-pulse font-mono">CONNESSIONE...</span>}
                 {status === 'connected' && (
                     isAgentSpeaking 
                     ? <span className="text-amber-400 text-xs font-bold tracking-widest animate-pulse">PARLANDO</span>
                     : <span className="text-emerald-400 text-xs font-bold tracking-widest">IN ASCOLTO</span>
                 )}
            </div>
        </div>

        {/* ORB VISUALIZER CONTAINER */}
        <div className="relative z-10 w-48 h-48 flex items-center justify-center mb-10">
            
            {/* INTERACTIVE CLICK AREA (Main Button) */}
            <button 
                onClick={isConnected ? disconnect : connect}
                disabled={status === 'connecting'}
                className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all focus:outline-none group"
            >
                {/* 1. Ambient Glow (Always there) - NON-INTERACTIVE */}
                <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-1000 pointer-events-none
                    ${isConnected 
                        ? (isAgentSpeaking ? 'bg-amber-600/60 scale-125' : 'bg-emerald-600/40 scale-110') 
                        : 'bg-slate-700/30 scale-90 group-hover:bg-slate-600/50'
                    }`} 
                />

                {/* 2. RIPPLES (User Speaking) - NON-INTERACTIVE */}
                {isConnected && !isAgentSpeaking && (
                    <>
                        <div className="absolute inset-0 rounded-full border border-emerald-400/30 transition-transform duration-75 ease-out pointer-events-none"
                             style={{ transform: `scale(${1 + (volume / 100) * 1.8})` }} />
                        <div className="absolute inset-0 rounded-full border border-emerald-400/10 transition-transform duration-100 ease-out pointer-events-none"
                             style={{ transform: `scale(${1 + (volume / 100) * 2.5})` }} />
                         <div className="absolute inset-0 rounded-full border border-emerald-400/5 transition-transform duration-150 ease-out pointer-events-none"
                             style={{ transform: `scale(${1 + (volume / 100) * 3.5})` }} />
                    </>
                )}

                {/* 3. PULSE (Agent Speaking) - NON-INTERACTIVE */}
                {/* Critical Fix: pointer-events-none ensures this large animation doesn't block clicks on the Hang Up button below */}
                {isConnected && isAgentSpeaking && (
                    <>
                        <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none" />
                        <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s] pointer-events-none" />
                    </>
                )}

                {/* 4. CORE SPHERE (The Main UI) */}
                <div className={`relative z-20 w-32 h-32 rounded-full flex items-center justify-center shadow-[inset_0_2px_20px_rgba(255,255,255,0.1)] backdrop-blur-sm border transition-all duration-500 overflow-hidden
                    ${isConnected 
                        ? (isAgentSpeaking 
                            ? 'bg-gradient-to-br from-amber-900/80 to-slate-900 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.3)]' 
                            : 'bg-gradient-to-br from-emerald-900/80 to-slate-900 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]')
                        : 'bg-gradient-to-br from-slate-800 to-slate-950 border-slate-700 group-hover:border-slate-500 shadow-xl'
                    }`}
                >
                    {status === 'connecting' ? (
                        <Loader2 className="w-10 h-10 text-white animate-spin opacity-80" />
                    ) : isConnected ? (
                        isAgentSpeaking ? (
                            // EQUALIZER ANIMATION (CSS based)
                            <div className="flex items-center gap-1.5 h-12">
                                <div className="w-1.5 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 bg-amber-300 rounded-full animate-music-wave" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 bg-amber-200 rounded-full animate-music-wave" style={{ animationDelay: '300ms' }}></div>
                                <div className="w-1.5 bg-amber-300 rounded-full animate-music-wave" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 bg-amber-400 rounded-full animate-music-wave" style={{ animationDelay: '0ms' }}></div>
                            </div>
                        ) : (
                            // MIC ICON (Scales slightly)
                            <Mic className="w-10 h-10 text-emerald-400 drop-shadow-lg transition-transform duration-75" 
                                 style={{ transform: `scale(${1 + volume/300})`}} 
                            />
                        )
                    ) : (
                        // IDLE PHONE ICON
                        <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform duration-300">
                             <Phone className="w-8 h-8 text-slate-300 fill-slate-300/20" />
                             <span className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">CHIAMA</span>
                        </div>
                    )}
                </div>
            </button>
        </div>

        {/* CONTROLS */}
        {/* z-20 ensures controls sit ON TOP of any spilling orb animations */}
        <div className="relative z-20 w-full px-4">
             {isConnected ? (
                 <div className="flex justify-center gap-4">
                    <button 
                        onClick={disconnect}
                        className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <MicOff size={16} /> Termina Chiamata
                    </button>
                 </div>
             ) : (
                 <p className="text-center text-slate-500 text-xs">
                     {introAudioBase64 ? "Tocca la sfera per iniziare." : "Caricamento Voce..."}
                 </p>
             )}
        </div>

    </div>
  );
};

export default VoiceAgent;