import { menuData } from '../data/menuData';
import { MenuItem } from '../types';

export const menuLogic = {
    // Flatten menu for searching
    getAllItems: (): MenuItem[] => {
        let all: MenuItem[] = [];
        Object.values(menuData).forEach(items => {
            all = [...all, ...items];
        });
        return all;
    },

    findItem: (query: string): MenuItem | null => {
        const items = menuLogic.getAllItems();
        const lowerQ = query.toLowerCase().trim();

        // 1. Exact match
        const exact = items.find(i => i.name.toLowerCase() === lowerQ);
        if (exact) return exact;

        // 2. Contains match (prioritize specific)
        // Sort items by length descending to match "Risotto alla Milanese" before "Risotto" if both existed
        const potentialMatches = items.filter(i => i.name.toLowerCase().includes(lowerQ));
        
        if (potentialMatches.length > 0) {
             // Return the shortest match that contains the query? No, usually specific is better.
             // If user says "Risotto", and we have "Risotto Milanese" and "Risotto Tartufo", it's ambiguous.
             // But for this demo, let's pick the first one or the one that starts with it.
             return potentialMatches[0];
        }

        // 3. Reverse contains (User says "Milanese" for "Risotto alla Milanese")
        const reverseMatch = items.find(i => i.name.toLowerCase().includes(lowerQ) || lowerQ.includes(i.name.toLowerCase()));
        if (reverseMatch) return reverseMatch;

        return null;
    },

    processOrder: (requestedItems: string[]) => {
        const foundItems: MenuItem[] = [];
        const missingItems: string[] = [];
        let total = 0;

        requestedItems.forEach(req => {
            const match = menuLogic.findItem(req);
            if (match) {
                foundItems.push(match);
                total += (match.priceNum || 0);
            } else {
                missingItems.push(req);
            }
        });

        return {
            total,
            foundItems,
            missingItems
        };
    }
};