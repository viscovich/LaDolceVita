
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { UtensilsCrossed, Clock, Info, Mail, PhoneCall, Calendar as CalendarIcon, Users, MapPin, Car, AlertCircle, ChefHat, Moon, Sun, Sparkles, BookOpen, Smartphone, ShoppingBag, Radio, Globe } from 'lucide-react';
import VoiceAgent from './components/VoiceAgent';
import TableMap from './components/TableMap';
import InAppBrowserCheck from './components/InAppBrowserCheck'; // Imported Check
import { RestaurantManager } from './services/restaurantLogic';
import { INITIAL_TABLES, INITIAL_RESERVATIONS, RESTAURANT_NAME, RESTAURANT_INFO } from './constants';
import { TableStatus, Reservation, CheckAvailabilityArgs, MakeReservationArgs, GetInfoArgs, CancelReservationArgs } from './types';
import { processOrder } from './services/menuLogic'; // Imported Menu Logic

// --- Native Date Helpers to replace date-fns ---
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const parseInputDate = (dateStr: string) => {
    if (!dateStr) return new Date(); // Fallback to today
    // Parse YYYY-MM-DD as local date
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
         const [y, m, d] = parts;
         return new Date(y, m - 1, d);
    }
    return new Date();
};

// Helper to get defaults
const getDefaultDateStr = () => new Date().toISOString().split('T')[0];
const getDefaultTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function App() {
  // Dates
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Shifts: 'turn1' (19:30-21:15) or 'turn2' (21:30-Closing)
  const [activeShift, setActiveShift] = useState<'turn1' | 'turn2'>('turn1');
  
  const [manager] = useState(() => new RestaurantManager(INITIAL_TABLES, [...INITIAL_RESERVATIONS]));
  const [reservations, setReservations] = useState<Reservation[]>(manager.getReservations());
  const [highlightedTables, setHighlightedTables] = useState<string[]>([]);
  const [lastNotification, setLastNotification] = useState<{msg: string, type: 'success' | 'alert'} | null>(null);
  
  // Changed default tab to 'guide' so it is visible immediately
  const [activeInfoTab, setActiveInfoTab] = useState<'menu' | 'details' | 'guide'>('guide');

  // Derived current view time based on Active Shift
  const viewTime = useMemo(() => {
    const base = startOfDay(selectedDate);
    // Shift 1 View Time: 20:00 (Middle of Shift)
    // Shift 2 View Time: 22:00 (Middle of Shift)
    const hour = activeShift === 'turn1' ? 20 : 22;
    const minute = 0;
    const d = new Date(base);
    d.setHours(hour);
    d.setMinutes(minute);
    return d;
  }, [selectedDate, activeShift]);

  // Compute table statuses based on viewTime and highlights
  const tableStatuses = useMemo(() => {
    const statusMap = manager.getTableStatusAt(viewTime);
    
    // Only show highlights if they are relevant to the current shift?
    // For now, show them to give feedback, but they might look weird if the time is wrong.
    highlightedTables.forEach(id => {
      // If table is FREE in this shift, show as selected. 
      // If occupied, keep occupied.
      if (statusMap.get(id) === TableStatus.FREE) {
          statusMap.set(id, TableStatus.SELECTED);
      }
    });

    return statusMap;
  }, [viewTime, reservations, highlightedTables, manager]);

  // Filter reservations for the list
  const visibleReservations = useMemo(() => {
      return reservations.filter(res => isSameDay(res.startTime, selectedDate));
  }, [reservations, selectedDate]);

  // Format Helper for Italian Date
  const formatDateIt = (date: Date, format: 'short' | 'full' | 'weekday') => {
      const day = date.getDate();
      const monthShort = date.toLocaleDateString('it-IT', { month: 'short' });
      const weekday = date.toLocaleDateString('it-IT', { weekday: 'short' });
      
      if (format === 'weekday') return weekday.toUpperCase();
      if (format === 'short') return `${day} ${monthShort}`;
      return `${weekday} ${day} ${monthShort}`;
  };

  const formatTime = (date: Date) => {
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  // --- Tool Handlers for Voice Agent ---

  const handleToolCall = useCallback(async (name: string, args: any) => {
    console.log(`Executing tool: ${name}`, args);

    if (name === 'checkAvailability') {
      let { partySize, date, time } = args as CheckAvailabilityArgs;
      
      // Default guards
      if (!date) date = getDefaultDateStr();
      if (!time) time = getDefaultTimeStr();

      // PARSE TIME for SHIFT LOGIC
      const [h, m] = (time || "").split(':').map(Number);
      
      // LOGIC: Suggest correct shift times
      if (h === 21 && m < 30) {
          // User asked for 21:00, 21:15 etc.
          return { 
              available: true, // Technically true, but we want to guide them
              message: "DISPONIBILE MA ATTENZIONE: Questo orario (21:xx) è nel cambio turno. Per il secondo turno devi proporre le 21:30. Chiedi al cliente se le 21:30 va bene." 
          };
      }

      if (h < 19 || (h === 19 && m < 30)) {
           return { 
              available: true,
              message: "DISPONIBILE MA ATTENZIONE: Il ristorante apre alle 19:30. Proponi le 19:30 come orario di inizio." 
          };
      }

      const result = manager.findTableForRequest(partySize, date, time);
      
      // Auto-switch visual shift based on requested time
      if (h >= 21 && m >= 30) {
          setActiveShift('turn2');
      } else {
          setActiveShift('turn1');
      }

      // Sync date
      setSelectedDate(parseInputDate(date));

      if (result?.requiresManager) {
           setLastNotification({ msg: `Gruppo di ${partySize} richiede richiamata Manager.`, type: 'alert' });
           setTimeout(() => setLastNotification(null), 8000);
           return { available: false, requiresManager: true, message: "Party size too large for auto-booking. Tell user the manager will call back." };
      }

      if (result && result.tableIds.length > 0) {
        setHighlightedTables(result.tableIds);
        return { available: true, tableIds: result.tableIds, message: "Tables available. Confirm with user." };
      } else {
        setHighlightedTables([]);
        return { available: false, message: "No suitable tables found for that time." };
      }
    }

    if (name === 'calculateQuote') {
        const { items } = args;
        // Use the centralized fuzzy logic
        const { total, items: detailedItems } = processOrder(items || []);

        const foundNames = detailedItems.map(i => i.name);
        const detailString = detailedItems.map(i => `${i.name} (€${i.price})`).join(', ');

        if (detailedItems.length === 0 && (items || []).length > 0) {
             return {
                 success: false,
                 message: "Non ho trovato nessuno dei piatti richiesti nel menu. Per favore controlla l'ordine con il cliente."
             };
        }

        // Return structured data for the AI to read
        return {
            success: true,
            totalPrice: `€${total}`,
            itemDetails: detailString, 
            message: `PREVENTIVO CALCOLATO: Il nuovo totale per la lista completa [${foundNames.join(', ')}] è €${total}. Dettaglio voci: ${detailString}.`
        };
    }

    if (name === 'makeReservation') {
      let { partySize, date, time, customerName, contactInfo, notes, type = 'dine-in', items = [] } = args as MakeReservationArgs;
      
      // Default guards
      if (!date) date = getDefaultDateStr();
      if (!time) time = getDefaultTimeStr();

      // Check if it was a manager request
      if (notes === "RICHIEDE_RICHIAMATA_MANAGER" || notes === "REQUIRES_MANAGER_CALLBACK") {
          setLastNotification({ msg: `RICHIESTA SUPPORTO: ${customerName} (${partySize} pax) @ ${contactInfo}`, type: 'alert' });
          return { success: true, message: "Manager will call back." };
      }

      let tableIds: string[] = [];
      let duration = 90;
      let orderTotal = "";
      let finalNotes = notes || "";

      // Logic split based on type
      if (type === 'takeaway') {
          // Takeaway logic
          duration = 30; // standard prep time placeholder
          
          // STRICT VALIDATION: Re-calculate to ensure consistency
          const { total, items: detailedItems, invalidItems } = processOrder(items);
          
          if (invalidItems.length > 0) {
               return { 
                   success: false, 
                   message: `ERRORE: I seguenti piatti non sono nel menu: ${invalidItems.join(', ')}. Chiedi al cliente di correggere.` 
               };
          }
          
          orderTotal = `€${total}`;
          finalNotes = `Ordine: ${detailedItems.map(i => i.name).join(', ')}`;

      } else {
          // Dine-in logic
          const result = manager.findTableForRequest(partySize, date, time);
          if (result && result.tableIds.length > 0) {
              tableIds = result.tableIds;
          } else {
             // If we are here, it means checkAvailability passed but now it failed? 
             // Or user skipped check.
             // Try to force find tables if it's a valid shift time.
             const forcedResult = manager.findTableForRequest(partySize, date, time);
             if (forcedResult && forcedResult.tableIds.length > 0) {
                 tableIds = forcedResult.tableIds;
             } else {
                 return { success: false, message: "Table no longer available or time invalid. Please re-check." };
             }
          }
      }
      
      const newRes: Reservation = {
          id: Math.random().toString(36).substr(2, 9),
          customerName,
          contactInfo,
          partySize: type === 'takeaway' ? 0 : partySize,
          startTime: new Date(`${date} ${time}`),
          durationMinutes: duration,
          tableIds: tableIds,
          notes: finalNotes,
          type
        };
        
        manager.addReservation(newRes);
        // Force refresh
        setReservations([...manager.getReservations()]); 
        setHighlightedTables([]); // Clear highlights as it is now occupied (Red)
        
        // Sync UI to reservation details
        setSelectedDate(parseInputDate(date));
        
        const [reqHour, reqMin] = time.split(':').map(Number);
        if (reqHour >= 21 && reqMin >= 15) {
            setActiveShift('turn2');
        } else {
            setActiveShift('turn1');
        }

        const msg = type === 'takeaway' ? `Ordine Asporto (${orderTotal}): ${customerName}` : `Prenotazione Confermata: ${customerName}`;
        setLastNotification({ msg, type: 'success' });
        setTimeout(() => setLastNotification(null), 5000);

        return { success: true, reservationId: newRes.id, totalCost: orderTotal };
    }

    if (name === 'cancelReservation') {
        const { customerName } = args as CancelReservationArgs;
        const matches = manager.findReservationsByName(customerName);
        
        if (matches.length > 0) {
            // Cancel the first match
            const toCancel = matches[0];
            manager.cancelReservation(toCancel.id);
            setReservations([...manager.getReservations()]); // Force UI Update
            setLastNotification({ msg: `Prenotazione Cancellata: ${toCancel.customerName}`, type: 'alert' });
            return { success: true, message: `Reservation for ${toCancel.customerName} cancelled.` };
        } else {
            return { success: false, message: "No reservation found with that name." };
        }
    }

    if (name === 'getInfo') {
        // Return full info to ground the AI
        return { success: true, info: RESTAURANT_INFO };
    }

    return { error: "Unknown tool" };
  }, [manager]);


  // Generate next 14 days for the denser calendar
  const days = useMemo(() => Array.from({length: 14}, (_, i) => addDays(new Date(), i)), []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 font-sans selection:bg-amber-500/30">
      
      {/* SOCIAL BROWSER BLOCKER */}
      <InAppBrowserCheck />
      
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2 rounded-lg text-slate-900 shadow-amber-500/20 shadow-lg">
               <UtensilsCrossed size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold font-serif tracking-wide text-amber-500">{RESTAURANT_NAME}</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Dashboard Manager IA</p>
            </div>
          </div>
          
           {/* Toast Notification Top Right */}
           {lastNotification && (
              <div className={`absolute top-20 right-6 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5 z-50 border
                  ${lastNotification.type === 'alert' 
                    ? 'bg-rose-900 text-white border-rose-500' 
                    : 'bg-emerald-900 text-white border-emerald-500'}`}
              >
                  {lastNotification.type === 'alert' ? <PhoneCall size={20} /> : <Info size={20} />}
                  <div>
                      <div className="font-bold text-xs">{lastNotification.type === 'alert' ? 'AZIONE RICHIESTA' : 'SUCCESSO'}</div>
                      <div className="text-[10px] opacity-90">{lastNotification.msg}</div>
                  </div>
              </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        {/* LEFT COLUMN: Voice Agent & Guide (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <section>
             <VoiceAgent onToolCall={handleToolCall} />
          </section>

          {/* GUIDE & INFO SECTION (Moved to Left Bottom) */}
           <section className="glass-panel rounded-xl border border-slate-700/50 overflow-hidden flex flex-col flex-1">
              <div className="bg-slate-800/50 px-6 py-3 border-b border-slate-700 flex gap-4 overflow-x-auto">
                 <button 
                    onClick={() => setActiveInfoTab('guide')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeInfoTab === 'guide' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                 >
                    <BookOpen size={16} /> Guida Demo
                 </button>
                 <button 
                    onClick={() => setActiveInfoTab('menu')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeInfoTab === 'menu' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                 >
                    <ChefHat size={16} /> Menu
                 </button>
                 <button 
                    onClick={() => setActiveInfoTab('details')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeInfoTab === 'details' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                 >
                    <Info size={16} /> Info
                 </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[500px] custom-scrollbar">
                 
                 {activeInfoTab === 'guide' && (
                     <div className="text-slate-300 space-y-6">
                         <div className="border-l-2 border-amber-500 pl-4 bg-amber-900/10 py-2 rounded-r">
                             <h4 className="text-amber-400 font-bold uppercase text-xs mb-1 flex items-center gap-2">
                                 <Smartphone size={14}/> Contesto d'Uso
                             </h4>
                             <p className="text-sm leading-relaxed text-slate-300">
                                 Questa demo simula un agente progettato per gestire vere <strong>chiamate telefoniche</strong>. Il sistema ragiona in tempo reale come un receptionist esperto.
                             </p>
                         </div>

                         <div className="space-y-4">
                             <div>
                                <h5 className="font-semibold text-slate-200 text-sm mb-2 flex items-center gap-2">
                                     <Sparkles size={14} className="text-blue-400"/> Cosa sa fare?
                                </h5>
                                <ul className="text-xs space-y-2 text-slate-400 list-none">
                                     <li className="flex gap-2">
                                         <span className="text-emerald-400">✓</span>
                                         <span><strong>Gestione Prenotazioni:</strong> Controlla disponibilità e blocca tavoli.</span>
                                     </li>
                                     <li className="flex gap-2">
                                         <span className="text-emerald-400">✓</span>
                                         <span><strong>Gestione Ordini da Asporto:</strong> Prende l'ordine e calcola il totale esatto.</span>
                                     </li>
                                     <li className="flex gap-2">
                                         <span className="text-emerald-400">✓</span>
                                         <span><strong>Integrazioni:</strong> Possibile integrazione con TheFork e OpenTable.</span>
                                     </li>
                                     <li className="flex gap-2">
                                         <span className="text-emerald-400">✓</span>
                                         <span><strong>Modifiche:</strong> Cerca per nome ("Sono Giulia") e cancella prenotazioni.</span>
                                     </li>
                                     <li className="flex gap-2">
                                         <span className="text-emerald-400"><Globe size={14}/></span>
                                         <span><strong>Multilingua:</strong> Parla fluentemente qualsiasi lingua (Prova in Inglese, Spagnolo, Cinese...).</span>
                                     </li>
                                </ul>
                             </div>

                             <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700">
                                 <h5 className="font-semibold text-slate-200 text-sm mb-3 flex items-center gap-2">
                                     <Clock size={14} className="text-emerald-400"/> Logiche "Nascoste"
                                 </h5>
                                 <ul className="text-xs space-y-2 text-slate-400">
                                     <li>
                                         <span className="text-slate-300 font-medium">Algoritmo Tavoli:</span> Algoritmo per combinare i tavoli e cercare la migliore collocazione, ogni tavolo ha una indicazione sui tavoli ai quali può essere unito.
                                     </li>
                                     <li>
                                         <span className="text-slate-300 font-medium">Turni Rigidi:</span> Se prenoti alle 20:30, ti avviserà che devi lasciare il tavolo alle 21:15. Se chiedi 21:00, ti proporrà 21:30.
                                     </li>
                                     <li>
                                         <span className="text-slate-300 font-medium">Manager Escalation:</span> Gruppi di 10+ persone vengono segnalati al manager (simulato).
                                     </li>
                                 </ul>
                             </div>
                         </div>
                     </div>
                 )}

                 {activeInfoTab === 'menu' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="mb-4">
                            <h4 className="text-amber-500 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                                <Sparkles size={12} /> Specialità dello Chef
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {RESTAURANT_INFO.menu.specials.map((item: any) => (
                                    <div key={item.name} className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex justify-between items-start">
                                        <div>
                                            <span className="text-amber-200 text-sm font-bold block">{item.name}</span>
                                            <span className="text-amber-500/70 text-[10px]">{item.description}</span>
                                        </div>
                                        <span className="text-amber-400 font-mono text-sm">{item.price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dynamic Render of all other categories */}
                        {Object.entries(RESTAURANT_INFO.menu).map(([category, items]) => {
                             if(category === 'specials') return null;
                             return (
                                <div key={category}>
                                    <h4 className="text-slate-400 text-xs font-bold uppercase mb-3 border-b border-slate-800 pb-1">{category}</h4>
                                    <ul className="space-y-2">
                                        {(items as any[]).map(item => (
                                            <li key={item.name} className="flex justify-between text-xs items-center">
                                                <span className="text-slate-300">{item.name}</span>
                                                <span className="text-slate-500">{item.price}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                             )
                        })}
                    </div>
                 )}

                 {activeInfoTab === 'details' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-500/30 space-y-3">
                             <h4 className="text-indigo-400 text-xs font-bold uppercase flex items-center gap-2">
                                 <Radio size={14} /> Servizi Digitali & Asporto
                             </h4>
                             <p className="text-xs text-slate-300">
                                 <strong>TheFork & OpenTable:</strong> Integrazione attiva a 2 vie.
                             </p>
                             <div className="flex items-start gap-2">
                                 <ShoppingBag size={14} className="mt-0.5 text-indigo-400"/>
                                 <div className="text-xs text-slate-300">
                                     <strong>Asporto:</strong> {RESTAURANT_INFO.services.takeaway}
                                 </div>
                             </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="mt-1 text-slate-500"><MapPin size={18} /></div>
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-200">Posizione</h5>
                                    <p className="text-xs text-slate-400">{RESTAURANT_INFO.location.address}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{RESTAURANT_INFO.location.description}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-1 text-slate-500"><Car size={18} /></div>
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-200">Parcheggio</h5>
                                    <p className="text-xs text-slate-400">{RESTAURANT_INFO.location.parking}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-1 text-slate-500"><Clock size={18} /></div>
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-200">Orari</h5>
                                    <p className="text-xs text-slate-400">{RESTAURANT_INFO.hours.weekdays}</p>
                                    <p className="text-[10px] text-slate-500">Chiuso: {RESTAURANT_INFO.hours.closed}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-1 text-slate-500"><AlertCircle size={18} /></div>
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-200">Allergie & Regole</h5>
                                    <p className="text-xs text-slate-400 mb-2">{RESTAURANT_INFO.policies.allergies}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                 )}
              </div>
           </section>

        </div>

        {/* RIGHT COLUMN: Map & Controls & List (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           
           {/* 1. MAP & CONTROLS */}
           <section className="glass-panel p-6 rounded-xl border border-slate-700/50">
               
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                        <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                        Gestione Sala & Turni
                  </h2>
               </div>

               {/* CONTROLS: Date & Shift Selector */}
               <div className="flex flex-col gap-4 mb-6">
                   
                   {/* Date Picker Row - EXPANDED */}
                   <div className="flex items-center gap-2 pb-2">
                        {/* 
                            Native Date Picker Overlay Trick FIXED:
                            Input is Z-50 (top) and opacity 0.
                            Container is relative.
                            Visual elements are pointer-events-none.
                        */}
                        <div className="relative h-[50px] w-[50px] flex-shrink-0 group cursor-pointer bg-slate-800 border border-slate-600 rounded-lg shadow-md hover:bg-slate-700 hover:border-amber-500 transition-colors overflow-hidden">
                            <input 
                                type="date" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                                onChange={(e) => {
                                    if(e.target.value) setSelectedDate(parseInputDate(e.target.value));
                                }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-amber-500 pointer-events-none z-10">
                                <CalendarIcon size={20} />
                            </div>
                        </div>
                        
                        {/* Scrollable list of next 14 days */}
                        <div className="flex gap-2 overflow-x-auto custom-scrollbar flex-1 pb-1">
                            {days.map(d => {
                                const isSelected = isSameDay(d, selectedDate);
                                return (
                                    <button 
                                        key={d.toISOString()}
                                        onClick={() => setSelectedDate(d)}
                                        className={`px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border flex-shrink-0
                                            ${isSelected 
                                                ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-lg shadow-amber-500/20 font-bold' 
                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                            }`}
                                    >
                                        <div className="opacity-70 text-[9px] uppercase">{isSameDay(d, new Date()) ? 'OGGI' : formatDateIt(d, 'weekday')}</div>
                                        <div className="text-sm">{formatDateIt(d, 'short')}</div>
                                    </button>
                                )
                            })}
                        </div>
                   </div>

                   {/* Shift Toggle Row */}
                   <div className="grid grid-cols-2 gap-3 p-1 bg-slate-800 rounded-xl">
                        <button
                            onClick={() => setActiveShift('turn1')}
                            className={`flex flex-col items-center justify-center py-3 px-4 rounded-lg transition-all border
                                ${activeShift === 'turn1'
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                    : 'hover:bg-slate-700 border-transparent text-slate-400'
                                }`}
                        >
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <Sun size={14} className={activeShift === 'turn1' ? 'text-yellow-300' : ''}/> 
                                1° Turno
                            </div>
                            <div className="text-[10px] opacity-80 font-mono mt-1">19:30 - 21:15</div>
                        </button>

                        <button
                            onClick={() => setActiveShift('turn2')}
                            className={`flex flex-col items-center justify-center py-3 px-4 rounded-lg transition-all border
                                ${activeShift === 'turn2'
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                                    : 'hover:bg-slate-700 border-transparent text-slate-400'
                                }`}
                        >
                             <div className="flex items-center gap-2 font-bold text-sm">
                                <Moon size={14} className={activeShift === 'turn2' ? 'text-indigo-300' : ''}/> 
                                2° Turno
                            </div>
                            <div className="text-[10px] opacity-80 font-mono mt-1">21:30 - Chiusura</div>
                        </button>
                   </div>
               </div>

               {/* The Map */}
               <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                    <TableMap tables={INITIAL_TABLES} statuses={tableStatuses} />
               </div>

           </section>

           {/* 2. RESERVATIONS LIST (Moved Here) */}
           <section className="glass-panel p-6 rounded-xl border border-slate-700/50 flex flex-col flex-1 min-h-[250px]">
                <h3 className="font-serif text-lg mb-4 text-slate-300 flex items-center gap-2">
                    <CalendarIcon size={18} className="text-slate-500"/> 
                    Lista Prenotazioni: {formatDateIt(selectedDate, 'full')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2 overflow-y-auto custom-scrollbar">
                    {visibleReservations.length === 0 ? (
                        <div className="col-span-1 md:col-span-2 h-24 flex flex-col items-center justify-center text-slate-600 gap-2 border-2 border-dashed border-slate-800 rounded-xl">
                            <Clock size={20} />
                            <p className="text-sm">Nessuna prenotazione per questa data.</p>
                        </div>
                    ) : (
                        visibleReservations.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()).map(res => (
                            <div key={res.id} className={`group flex justify-between items-center p-3 rounded-xl border transition-all ${res.type === 'takeaway' ? 'bg-indigo-900/20 border-indigo-500/30 hover:bg-indigo-900/30' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'}`}>
                                <div className="flex items-center gap-3">
                                    {res.type === 'takeaway' ? (
                                        <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                            <ShoppingBag size={14} />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                                            {res.customerName.charAt(0)}
                                        </div>
                                    )}
                                    
                                    <div>
                                        <div className="font-medium text-sm text-slate-200">{res.customerName}</div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                            {res.type === 'takeaway' ? (
                                                <span className="text-indigo-300 font-semibold uppercase tracking-wider text-[9px]">ASPORTO</span>
                                            ) : (
                                                <><Users size={10} /> {res.partySize}p</>
                                            )}
                                            {res.notes && <span className="text-amber-500">• {res.notes}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`${res.type === 'takeaway' ? 'text-indigo-400' : 'text-amber-400'} font-mono font-bold text-sm`}>{formatTime(res.startTime)}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
           </section>

        </div>

      </main>
    </div>
  );
}

export default App;
