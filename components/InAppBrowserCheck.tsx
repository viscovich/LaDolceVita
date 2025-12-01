
import React, { useEffect, useState } from 'react';
import { ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react';

const InAppBrowserCheck: React.FC = () => {
  const [isInApp, setIsInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    // Regex to detect Facebook (FBAN/FBAV), Instagram, LinkedIn, Twitter, and generic WebViews
    // FBAN/FBAV = Facebook for iOS/Android
    const rules = [
      /FBAN/i,
      /FBAV/i,
      /Instagram/i,
      /LinkedIn/i,
      /Twitter/i,
      /Snapchat/i,
      /Line/i
    ];

    const isSocialBrowser = rules.some((rule) => rule.test(ua));

    if (isSocialBrowser) {
      setIsInApp(true);
    }
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isInApp) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="bg-slate-800 p-8 rounded-2xl border border-amber-500/50 shadow-2xl max-w-md w-full relative overflow-hidden">
        
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500"></div>

        <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
            <AlertTriangle size={32} />
        </div>

        <h2 className="text-xl font-bold text-white mb-2 font-serif">Browser Limitato Rilevato</h2>
        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
          Sembra che tu stia aprendo il link direttamente da <strong>Facebook/Instagram</strong>.
          <br /><br />
          Questo browser <span className="text-rose-400 font-bold">blocca il microfono</span>, necessario per parlare con l'Agente IA.
        </p>

        <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-left">
                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Soluzione:</p>
                <ol className="list-decimal list-inside text-sm text-slate-200 space-y-2">
                    <li>Premi i <strong>3 puntini (...)</strong> in alto a destra o in basso.</li>
                    <li>Seleziona <strong>"Apri nel browser"</strong> (o Open in Chrome/Safari).</li>
                </ol>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-700"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-800 px-2 text-slate-500">Oppure copia il link</span>
                </div>
            </div>

            <button 
                onClick={copyToClipboard}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
                {copied ? <Check size={18} className="text-emerald-400"/> : <Copy size={18} />}
                {copied ? "Link Copiato!" : "Copia Link manualmente"}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InAppBrowserCheck;
