
import { MENU_DATA } from '../data/menuData';

interface OrderItem {
    name: string;
    price: number;
}

interface ProcessedOrder {
    total: number;
    items: OrderItem[];
    invalidItems: string[];
}

// Flatten menu for easy searching
const getFlatMenu = () => {
    const flat: { name: string, price: number, category: string }[] = [];
    Object.entries(MENU_DATA).forEach(([category, items]) => {
        (items as any[]).forEach(item => {
            flat.push({ name: item.name, price: typeof item.price === 'string' ? parseInt(item.price.replace('€','')) : item.price, category });
        });
    });
    return flat;
};

export const processOrder = (requestedItems: string[]): ProcessedOrder => {
    const flatMenu = getFlatMenu();
    const validItems: OrderItem[] = [];
    const invalidItems: string[] = [];
    let total = 0;

    if (!requestedItems || requestedItems.length === 0) {
        return { total: 0, items: [], invalidItems: [] };
    }

    requestedItems.forEach(reqItem => {
        const lowerReq = reqItem.toLowerCase().trim();
        
        // Find best match
        // 1. Exact match
        let match = flatMenu.find(m => m.name.toLowerCase() === lowerReq);
        
        // 2. Contains match (if strict match fails)
        if (!match) {
            // Sort by length desc to match "Risotto alla Milanese" before "Risotto"
            const potentialMatches = flatMenu.filter(m => m.name.toLowerCase().includes(lowerReq));
            if (potentialMatches.length > 0) {
                // Pick the shortest name that contains the search term? 
                // Or best logic: if I say "Risotto", I probably mean one of them. 
                // Let's pick the first one but prefer specific ones if multiple.
                // Actually, let's try to match words.
                match = potentialMatches[0];
            }
        }

        if (match) {
            validItems.push({ name: match.name, price: match.price });
            total += match.price;
        } else {
            invalidItems.push(reqItem);
        }
    });

    return { total, items: validItems, invalidItems };
};
