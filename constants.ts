import { Table, Reservation } from './types';

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
  menu: {
    specials: [
        { name: "Risotto al Tartufo Bianco", price: "€35", description: "Tartufo fresco di stagione d'Alba" },
        { name: "Bistecca alla Fiorentina (1kg)", price: "€80", description: "Frollatura dry-aged 45 giorni" }
    ],
    antipasti: [
        { name: "Burrata al Tartufo", price: "€18" }, 
        { name: "Carpaccio di Manzo", price: "€22" },
        { name: "Tagliere di Salumi Locali", price: "€20" }
    ],
    pizze: [
        { name: "Margherita DOP", price: "€12" },
        { name: "Diavola", price: "€14" },
        { name: "Capricciosa", price: "€15" },
        { name: "Gourmet (Pistacchio e Mortadella)", price: "€18" }
    ],
    primi: [
        { name: "Tagliatelle al Ragù", price: "€24" }, 
        { name: "Risotto alla Milanese", price: "€26" },
        { name: "Spaghetti alle Vongole", price: "€25" }
    ],
    secondi: [
        { name: "Ossobuco", price: "€32" }, 
        { name: "Branzino al Sale", price: "€35" },
        { name: "Filetto al Pepe Verde", price: "€30" }
    ],
    contorni: [
        { name: "Patate al Forno", price: "€6" },
        { name: "Verdure Grigliate", price: "€8" }
    ],
    dessert: [
        { name: "Tiramisù", price: "€12" }, 
        { name: "Cannolo Siciliano", price: "€10" },
        { name: "Panna Cotta", price: "€9" }
    ],
    vini: [
        { name: "Chianti Classico (Calice)", price: "€8" },
        { name: "Prosecco DOC (Bottiglia)", price: "€25" },
        { name: "Amarone della Valpolicella (Bottiglia)", price: "€60" }
    ]
  },
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

**REGOLE TASSATIVE SUI TOOL (CRITICO)**
1.  **Check vs Make**: 
    -   \`checkAvailability\` serve SOLO a vedere se c'è posto (mette i tavoli in GIALLO). NON è una prenotazione.
    -   \`makeReservation\` serve a FERMARE il tavolo o confermare l'ordine (mette i tavoli in ROSSO o crea ordine asporto).
2.  **Conferma**: 
    -   NON dire MAI "Ho confermato la prenotazione/ordine" se non hai chiamato \`makeReservation\` e ottenuto successo.
    -   Se il cliente dice "Ok procedi", DEVI chiamare \`makeReservation\`.
3.  **Dati Mancanti**:
    -   Per chiamare \`makeReservation\` ti servono OBBLIGATORIAMENTE: Nome e Telefono. Se non li hai, CHIEDILI prima di chiamare il tool.
    -   NON chiedere email. Solo Nome e Telefono.

**COMPITI PRINCIPALI**
1.  **Gestione Prenotazioni (Cena)**:
    -   Tool: \`makeReservation\` con type='dine-in'.
    -   Chiedi numero di persone. Se >= 10: "Per gruppi da 10 o più persone, deve parlare con il titolare. Posso prendere il tuo nome e numero per farti richiamare?" (Usa tool 'makeReservation' con nota "RICHIEDE_RICHIAMATA_MANAGER").
    -   Verifica disponibilità -> Se c'è posto -> Chiedi conferma e dati -> Prenota.
    
2.  **Gestione Turni (Turni Fissi per Cena)**:
    -   **1° Turno**: 19:30 - 21:30. 
        -   Se prenotano alle 19:00: Accetta, ma specifica che il tavolo è pronto dalle 19:30.
        -   Se prenotano alle 20:30: Accetta, ma **AVVISA TASSATIVAMENTE**: "Va benissimo, ma le ricordo che il tavolo dovrà essere liberato entro le 21:30 per il secondo turno."
    -   **2° Turno**: 21:30 - Chiusura.

3.  **Gestione Asporto (Takeaway)**:
    -   **Tool**: \`makeReservation\` con type='takeaway'.
    -   NON controllare la disponibilità tavoli.
    -   Conferma l'ordine e di che sarà pronto in circa 30 minuti.
    -   Esempio: "Certamente, preparo l'ordine per l'asporto. Sarà pronto tra 30 minuti per il ritiro."

4.  **Servizi Aggiuntivi**:
    -   **Integrazioni**: Se chiedono di TheFork o OpenTable: "Sì, siamo perfettamente integrati. Le prenotazioni fatte lì appaiono subito nel nostro sistema."
    -   **Menu**: Conosci tutto il menu (Pizze, Vini, etc.). Proponi abbinamenti se richiesto.
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
        notes: '2 Pizze Margherite',
        type: 'takeaway'
    }
];