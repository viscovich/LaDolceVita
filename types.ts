export enum TableStatus {
  FREE = 'FREE',
  OCCUPIED = 'OCCUPIED',
  SELECTED = 'SELECTED', // Used during the booking process visualization
}

export interface Table {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  isCombinable: boolean;
  combinableWith: string[]; // IDs of tables it can merge with
  x: number; // Grid X position for visual
  y: number; // Grid Y position for visual
  shape: 'round' | 'rect';
}

export interface Reservation {
  id: string;
  customerName: string;
  contactInfo: string; // Phone
  partySize: number;
  startTime: Date; // JS Date object
  durationMinutes: number;
  tableIds: string[]; // Can be multiple if tables are combined
  notes?: string;
  type: 'dine-in' | 'takeaway';
}

export interface BookingRequest {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  partySize: number;
}

export interface RestaurantData {
  tables: Table[];
  reservations: Reservation[];
  hours: {
    open: number; // 18 (6 PM)
    close: number; // 23 (11 PM)
  };
}

// Menu Types
export interface MenuItem {
    name: string;
    price: string; // Display price e.g. "€12"
    priceNum?: number; // Numeric price for calculation
    description?: string;
}

export interface MenuData {
    specials: MenuItem[];
    [category: string]: MenuItem[];
}

// Tool Arguments Types
export interface CheckAvailabilityArgs {
  partySize: number;
  time: string; // HH:mm
  date: string; // YYYY-MM-DD
}

export interface MakeReservationArgs extends CheckAvailabilityArgs {
  customerName: string;
  contactInfo: string;
  notes?: string;
  type?: 'dine-in' | 'takeaway';
  items?: string[]; // For takeaway orders: list of dish names
}

export interface CancelReservationArgs {
  customerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

export interface GetInfoArgs {
  category: 'menu' | 'hours' | 'parking' | 'events' | 'allergies' | 'location';
}