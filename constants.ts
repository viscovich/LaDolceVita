import { Table, Reservation } from './types';
import { menuData } from './data/menuData';

export const RESTAURANT_NAME = "La Dolce Vita";

// Helper to set time for today relative to when app loads
const todayAt = (hours: number, minutes: number) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

// Structured Data for UI and AI (TRANSLATED TO ITALIAN)
export const RESTAURANT_INFO = {
  location: {
    address: "Via Roma 123, Centro Storico",
    description: "Situato in un palazzo del 18° secolo vicino alla piazza principale.",
    parking: "Servizio Valet disponibile (10€). Parcheggio pubblico in Piazza Dante (5 min a piedi)."
  },
  hours: {
    weekdays: "19:30 - 23:30 (Solo Cena)",
    weekends: "12:30 - 15:00, 19:30 - 00:00",
    closed: "Natale, Capodanno",
    notes: "La cucina chiude 30 minuti prima della chiusura."
  },
  services: {
    integrations: "Siamo integrati nativamente con TheFork e OpenTable. Le prenotazioni da questi portali appaiono automaticamente qui.",
    takeaway: "Servizio Asporto disponibile. Ordina al telefono e ritira di persona. Tempo di preparazione medio: 30 minuti."
  },
  menu: menuData, // Imported from separate file
  policies: {
    allergies: "Pasta senza glutine disponibile. Gestione attenta delle allergie alla frutta a guscio (area preparazione separata).",
    events: "Cene private disponibili nella 'Sala Oro' fino a 20 ospiti.",
    corkage: "Diritto di tappo €25 per bottiglia."
  }
};

export const SYSTEM_INSTRUCTION = `
**CONTESTO**
L'utente ha appena chiamato "La Dolce Vita".
Il tempo della demo è limitato (2 minuti). Sii concisa, professionale e rapida.
IMPORTANTE: L'utente ha GIÀ sentito la tua introduzione: "Sono Alessia del Ristorante Dolce Vita, come posso esserti utile?".
**NON RIPETERE L'INTRODUZIONE.**
Aspetta semplicemente che l'utente parli.

**RUOLO & PERSONA**
Sei **Alessia**, la responsabile di sala virtuale.
**LINGUA:** Sei POLIGLOTTA. La tua lingua di default è l'ITALIANO, ma devi rispondere nella lingua che usa l'utente (Inglese, Francese, Spagnolo, Tedesco, Cinese, ecc.) in modo fluido e naturale.
Voce: Elegante, profonda (Aoede).

**REGOLE TASSATIVE (CRITICO)**

1.  **CENA (Tavoli) - PROTOCOLLO RIGIDO**:
    -   STEP 1: Usa \`checkAvailability\` per vedere se c'è posto.
    -   STEP 2: Se c'è posto, chiedi conferma al cliente (e chiedi Nome/Telefono se mancano).
    -   STEP 3: **OBBLIGATORIO** -> Chiama \`makeReservation\` (type='dine-in').
    -   **DIVIETO**: Non dire MAI "Ho prenotato" o "Tutto fatto" se non hai PRIMA ricevuto un 'success: true' dal tool \`makeReservation\`.
    -   Se \`checkAvailability\` dice OK, la prenotazione NON è ancora fatta. Devi farla tu.
    -   Turni: 19:30-21:30 (1° Turno), 21:30-Chiusura (2° Turno).

2.  **ASPORTO (Takeaway) - PROCEDURA RIGIDA**:
    -   **STEP 1: PREVENTIVO (Tool \`calculateQuote\`)**
        -   Appena l'utente elenca i piatti, CHIAMA \`calculateQuote\` con la lista dei piatti.
        -   **DIVIETO DI MATEMATICA**: Non calcolare MAI il totale a mente.
        -   LEGGI AD ALTA VOCE il dettaglio che ti restituisce il tool (es. "X costa €Y").
        -   Il tool ti dirà se i piatti esistono o no. Se mancano, dillo al cliente.
        -   RISPONDI al cliente: "Ho segnato [Elenco Piatti Trovati]. Il totale viene €XX. Procedo?"
    
    -   **GESTIONE MODIFICHE (CRITICO)**:
        -   Se l'utente dice "Togli il risotto e metti il tiramisù", **NON fare calcoli +/-**.
        -   Aggiorna la tua lista mentale degli oggetti desiderati e CHIAMA DI NUOVO \`calculateQuote\` con la **NUOVA LISTA COMPLETA** (es. ['Tiramisu']).
        -   Leggi sempre e solo il NUOVO totale restituito dal tool. Dimentica il totale precedente.
    
    -   **STEP 2: CONFERMA (Tool \`makeReservation\`)**
        -   SOLO se il cliente conferma il preventivo, chiama \`makeReservation\` (type='takeaway').
        -   Usa la lista esatta di piatti confermati nel campo \`items\`.

3.  **ANTI-ALLUCINAZIONE**:
    -   Se ti chiedono "Quanto costa X?", usa il tool \`calculateQuote\` per avere il prezzo preciso.
    -   Se il tool dice che un piatto non esiste, non accettarlo.

**DATI MANCANTI**
-   Per confermare serve sempre NOME e TELEFONO. Chiedili se mancano.

**SERVIZI**
-   Integrazione TheFork/OpenTable: Sì.
-   Indirizzo: ${RESTAURANT_INFO.location.address}.
`;

// Layout: 4x4 Grid approximation
export const INITIAL_TABLES: Table[] = [
  // Window Seats (Romantic 2-tops)
  { id: 'T1', name: 'Win 1', minCapacity: 1, maxCapacity: 2, isCombinable: true, combinableWith: ['T2'], x: 0, y: 0, shape: 'round' },
  { id: 'T2', name: 'Win 2', minCapacity: 1, maxCapacity: 2, isCombinable: true, combinableWith: ['T1'], x: 1, y: 0, shape: 'round' },
  
  // Main Floor (Combinable 2-tops to make 4)
  { id: 'T3', name: 'Floor 1', minCapacity: 2, maxCapacity: 2, isCombinable: true, combinableWith: ['T4'], x: 0, y: 1, shape: 'rect' },
  { id: 'T4', name: 'Floor 2', minCapacity: 2, maxCapacity: 2, isCombinable: true, combinableWith: ['T3', 'T5'], x: 1, y: 1, shape: 'rect' },
  
  // Family Tables (4-tops)
  { id: 'T5', name: 'Fam 1', minCapacity: 3, maxCapacity: 4, isCombinable: true, combinableWith: ['T6', 'T4'], x: 2, y: 1, shape: 'rect' },
  { id: 'T6', name: 'Fam 2', minCapacity: 3, maxCapacity: 4, isCombinable: true, combinableWith: ['T5'], x: 3, y: 1, shape: 'rect' },

  // Large Round Table (Not combinable)
  { id: 'T7', name: 'Round', minCapacity: 4, maxCapacity: 6, isCombinable: false, combinableWith: [], x: 3, y: 0, shape: 'round' },
  
  // Corner Booths
  { id: 'T8', name: 'Booth 1', minCapacity: 4, maxCapacity: 5, isCombinable: false, combinableWith: [], x: 0, y: 2, shape: 'rect' },
  { id: 'T9', name: 'Booth 2', minCapacity: 4, maxCapacity: 5, isCombinable: false, combinableWith: [], x: 3, y: 2, shape: 'rect' },
];

// Pre-fill some reservations to simulate a real day
export const INITIAL_RESERVATIONS: Reservation[] = [
    {
        id: 'sim1',
        customerName: 'Giulia Rossi',
        contactInfo: '333-0101',
        partySize: 2,
        startTime: todayAt(19, 30), // Occupies TURN 1
        durationMinutes: 90,
        tableIds: ['T1'], // Window 1 busy Turn 1
        notes: 'Anniversario',
        type: 'dine-in'
    },
    {
        id: 'sim2',
        customerName: 'Sig. Bianchi',
        contactInfo: '333-0102',
        partySize: 6,
        startTime: todayAt(21, 30), // Occupies TURN 2
        durationMinutes: 120, 
        tableIds: ['T7'], // Round table busy Turn 2
        notes: 'VIP',
        type: 'dine-in'
    },
    {
        id: 'sim3',
        customerName: 'Gruppo Turisti',
        contactInfo: '333-0103',
        partySize: 2,
        startTime: todayAt(19, 30), // Occupies TURN 1
        durationMinutes: 90,
        tableIds: ['T3'], // Floor 1 busy Turn 1
        type: 'dine-in'
    },
    {
        id: 'sim4',
        customerName: 'Mario Verdi',
        contactInfo: '333-0104',
        partySize: 0, // Not relevant for takeaway
        startTime: todayAt(20, 0),
        durationMinutes: 30,
        tableIds: [], // No table
        notes: 'Ordine: Tagliatelle al Ragù, Tiramisù',
        type: 'takeaway'
    }
];