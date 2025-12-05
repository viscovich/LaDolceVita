import { MenuData } from '../types';

export const menuData: MenuData = {
    specials: [
        { name: "Risotto al Tartufo Bianco", price: "€35", priceNum: 35, description: "Tartufo fresco di Alba" },
        { name: "Fiorentina Steak (1kg)", price: "€80", priceNum: 80, description: "Frollatura 45 giorni" }
    ],
    antipasti: [
        { name: "Burrata con Tartufo", price: "€18", priceNum: 18 },
        { name: "Carpaccio di Manzo", price: "€22", priceNum: 22 },
        { name: "Bruschetta Mista", price: "€12", priceNum: 12 }
    ],
    primi: [
        { name: "Tagliatelle al Ragù", price: "€24", priceNum: 24 },
        { name: "Risotto alla Milanese", price: "€26", priceNum: 26 },
        { name: "Spaghetti alle Vongole", price: "€25", priceNum: 25 },
        { name: "Gnocchi al Pesto", price: "€22", priceNum: 22 }
    ],
    secondi: [
        { name: "Ossobuco", price: "€32", priceNum: 32 },
        { name: "Branzino al Sale", price: "€35", priceNum: 35 },
        { name: "Cotoletta alla Milanese", price: "€30", priceNum: 30 }
    ],
    contorni: [
        { name: "Patate al Forno", price: "€8", priceNum: 8 },
        { name: "Verdure Grigliate", price: "€10", priceNum: 10 },
        { name: "Insalata Mista", price: "€6", priceNum: 6 }
    ],
    dessert: [
        { name: "Tiramisu", price: "€12", priceNum: 12 },
        { name: "Cannoli Siciliani", price: "€10", priceNum: 10 },
        { name: "Panna Cotta", price: "€10", priceNum: 10 }
    ],
    vini: [
        { name: "Chianti Classico", price: "€35", priceNum: 35 },
        { name: "Barolo", price: "€85", priceNum: 85 },
        { name: "Prosecco", price: "€28", priceNum: 28 },
        { name: "Acqua Naturale/Frizzante", price: "€4", priceNum: 4 }
    ]
};