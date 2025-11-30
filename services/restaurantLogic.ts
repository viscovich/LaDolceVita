import { Table, Reservation, TableStatus } from '../types';

// Helper: Add minutes to a date
const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

// Helper: Check if two dates are the same calendar day
const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export class RestaurantManager {
  private tables: Table[];
  private reservations: Reservation[];

  constructor(tables: Table[], reservations: Reservation[]) {
    this.tables = tables;
    this.reservations = reservations;
  }

  // Helper: Check if a specific table (or set of tables) is free at a specific time interval
  isAvailable(tableIds: string[], startTime: Date, durationMinutes: number = 90): boolean {
    const endTime = addMinutes(startTime, durationMinutes);

    // Filter reservations that overlap with the requested time
    const conflicting = this.reservations.filter(res => {
      // Check if any of the requested tables are in this reservation
      const sharesTable = res.tableIds.some(id => tableIds.includes(id));
      if (!sharesTable) return false;

      const resEnd = addMinutes(res.startTime, res.durationMinutes);
      
      // Check time overlap: (StartA < EndB) and (EndA > StartB)
      return (startTime < resEnd) && (endTime > res.startTime);
    });

    return conflicting.length === 0;
  }

  // THE ALGORITHM: Find best configuration
  findTableForRequest(partySize: number, dateStr: string, timeStr: string): { tableIds: string[], score: number, requiresManager?: boolean } | null {
    // RULE: Large groups require manager
    if (partySize >= 10) {
        return { tableIds: [], score: 0, requiresManager: true };
    }

    // Manual parsing to avoid dependency issues
    // dateStr: YYYY-MM-DD, timeStr: HH:mm
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    // Note: Month is 0-indexed in JS Date
    const startTime = new Date(year, month - 1, day, hour, minute);

    const duration = 90; // Standard dining time

    let bestOption: { tableIds: string[], score: number } | null = null;

    // Strategy 1: Single Tables
    const validSingleTables = this.tables.filter(t => 
      t.maxCapacity >= partySize && 
      t.minCapacity <= partySize + 1 // Optimization: Don't put 2 people on a 6 top
    );

    for (const table of validSingleTables) {
      if (this.isAvailable([table.id], startTime, duration)) {
        const waste = table.maxCapacity - partySize;
        const score = waste; 
        
        if (!bestOption || score < bestOption.score) {
          bestOption = { tableIds: [table.id], score };
        }
      }
    }

    // Strategy 2: Combined Tables
    const combinables = this.tables.filter(t => t.isCombinable);
    const checkedPairs = new Set<string>();

    for (const t1 of combinables) {
      for (const t2Id of t1.combinableWith) {
        const pairKey = [t1.id, t2Id].sort().join('-');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const t2 = this.tables.find(t => t.id === t2Id);
        if (!t2) continue;

        const combinedMax = t1.maxCapacity + t2.maxCapacity;
        
        if (combinedMax >= partySize) {
           if (this.isAvailable([t1.id, t2.id], startTime, duration)) {
             const waste = combinedMax - partySize;
             const score = waste + 1.5; // Penalty for combining

             if (!bestOption || score < bestOption.score) {
               bestOption = { tableIds: [t1.id, t2.id], score };
             }
           }
        }
      }
    }

    return bestOption;
  }

  addReservation(res: Reservation) {
    this.reservations.push(res);
  }

  // Find reservations by name (fuzzy search)
  findReservationsByName(name: string): Reservation[] {
    const lowerName = name.toLowerCase();
    return this.reservations.filter(res => 
      res.customerName.toLowerCase().includes(lowerName)
    );
  }

  // Remove a reservation
  cancelReservation(id: string) {
    this.reservations = this.reservations.filter(res => res.id !== id);
  }

  getReservations() {
    return this.reservations;
  }

  getReservationsForDate(date: Date) {
    return this.reservations.filter(res => isSameDay(res.startTime, date));
  }

  // Get status of all tables at a specific snapshot time
  getTableStatusAt(snapshotTime: Date): Map<string, TableStatus> {
    const statusMap = new Map<string, TableStatus>();
    
    this.tables.forEach(table => {
      statusMap.set(table.id, TableStatus.FREE);

      const occupied = !this.isAvailable([table.id], snapshotTime, 1); 
      if (occupied) {
        statusMap.set(table.id, TableStatus.OCCUPIED);
      }
    });

    return statusMap;
  }
}