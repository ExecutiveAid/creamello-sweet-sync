
import { format, subDays } from 'date-fns';

// Types
export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  threshold: number;
  expirationDate: string;
  supplier: string;
  lastRestocked: string;
  pricePerUnit: number;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  ingredients: {
    ingredientId: string;
    quantity: number;
  }[];
  outputQuantity: number;
  outputUnit: string;
  wastagePercentage: number;
};

export type ProductionBatch = {
  id: string;
  recipeId: string;
  recipeName: string;
  date: string;
  quantity: number;
  producedBy: string;
  notes: string;
  status: 'completed' | 'in-progress' | 'planned';
};

export type Product = {
  id: string;
  name: string;
  category: 'gelato' | 'sorbet' | 'specialty';
  availableQuantity: number;
  unit: string;
  pricePerUnit: number;
  expirationDate: string;
  dateCreated: string;
};

export type Sale = {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
};

// Mock data generators
export const generateIngredients = (): Ingredient[] => [
  {
    id: '1',
    name: 'Whole Milk',
    unit: 'liters',
    quantity: 45,
    threshold: 20,
    expirationDate: format(subDays(new Date(), -14), 'yyyy-MM-dd'),
    supplier: 'Local Dairy Co.',
    lastRestocked: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    pricePerUnit: 2.5,
  },
  {
    id: '2',
    name: 'Heavy Cream',
    unit: 'liters',
    quantity: 15,
    threshold: 10,
    expirationDate: format(subDays(new Date(), -10), 'yyyy-MM-dd'),
    supplier: 'Local Dairy Co.',
    lastRestocked: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    pricePerUnit: 4.2,
  },
  {
    id: '3',
    name: 'Sugar',
    unit: 'kg',
    quantity: 50,
    threshold: 15,
    expirationDate: format(subDays(new Date(), -180), 'yyyy-MM-dd'),
    supplier: 'Sweeteners Inc.',
    lastRestocked: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    pricePerUnit: 1.8,
  },
  {
    id: '4',
    name: 'Cocoa Powder',
    unit: 'kg',
    quantity: 8,
    threshold: 5,
    expirationDate: format(subDays(new Date(), -90), 'yyyy-MM-dd'),
    supplier: 'Chocolate Source',
    lastRestocked: format(subDays(new Date(), 15), 'yyyy-MM-dd'),
    pricePerUnit: 12.5,
  },
  {
    id: '5',
    name: 'Vanilla Extract',
    unit: 'liters',
    quantity: 2,
    threshold: 1,
    expirationDate: format(subDays(new Date(), -120), 'yyyy-MM-dd'),
    supplier: 'Flavor Essentials',
    lastRestocked: format(subDays(new Date(), 45), 'yyyy-MM-dd'),
    pricePerUnit: 32.0,
  },
  {
    id: '6',
    name: 'Strawberries',
    unit: 'kg',
    quantity: 12,
    threshold: 8,
    expirationDate: format(subDays(new Date(), -5), 'yyyy-MM-dd'),
    supplier: 'Fresh Farms',
    lastRestocked: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    pricePerUnit: 8.5,
  },
  {
    id: '7',
    name: 'Pistachios',
    unit: 'kg',
    quantity: 5,
    threshold: 3,
    expirationDate: format(subDays(new Date(), -60), 'yyyy-MM-dd'),
    supplier: 'Nut Supply Co.',
    lastRestocked: format(subDays(new Date(), 20), 'yyyy-MM-dd'),
    pricePerUnit: 24.0,
  }
];

export const generateRecipes = (): Recipe[] => [
  {
    id: '1',
    name: 'Vanilla Gelato',
    description: 'Classic vanilla gelato with Madagascar vanilla',
    ingredients: [
      { ingredientId: '1', quantity: 2 },
      { ingredientId: '2', quantity: 1 },
      { ingredientId: '3', quantity: 0.5 },
      { ingredientId: '5', quantity: 0.05 },
    ],
    outputQuantity: 3,
    outputUnit: 'liters',
    wastagePercentage: 5,
  },
  {
    id: '2',
    name: 'Chocolate Gelato',
    description: 'Rich chocolate gelato with premium cocoa',
    ingredients: [
      { ingredientId: '1', quantity: 2 },
      { ingredientId: '2', quantity: 1 },
      { ingredientId: '3', quantity: 0.5 },
      { ingredientId: '4', quantity: 0.3 },
    ],
    outputQuantity: 3,
    outputUnit: 'liters',
    wastagePercentage: 5,
  },
  {
    id: '3',
    name: 'Strawberry Gelato',
    description: 'Fresh strawberry gelato made with local berries',
    ingredients: [
      { ingredientId: '1', quantity: 2 },
      { ingredientId: '2', quantity: 0.5 },
      { ingredientId: '3', quantity: 0.6 },
      { ingredientId: '6', quantity: 1.2 },
    ],
    outputQuantity: 3,
    outputUnit: 'liters',
    wastagePercentage: 8,
  },
  {
    id: '4',
    name: 'Pistachio Gelato',
    description: 'Creamy pistachio gelato with premium nuts',
    ingredients: [
      { ingredientId: '1', quantity: 2 },
      { ingredientId: '2', quantity: 1 },
      { ingredientId: '3', quantity: 0.5 },
      { ingredientId: '7', quantity: 0.8 },
    ],
    outputQuantity: 3,
    outputUnit: 'liters',
    wastagePercentage: 7,
  }
];

export const generateProductionBatches = (): ProductionBatch[] => [
  {
    id: '1',
    recipeId: '1',
    recipeName: 'Vanilla Gelato',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    quantity: 9,
    producedBy: 'Maria Rodriguez',
    notes: 'Extra creamy batch',
    status: 'completed',
  },
  {
    id: '2',
    recipeId: '2',
    recipeName: 'Chocolate Gelato',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    quantity: 9,
    producedBy: 'Maria Rodriguez',
    notes: 'Used dark cocoa for this batch',
    status: 'completed',
  },
  {
    id: '3',
    recipeId: '3',
    recipeName: 'Strawberry Gelato',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    quantity: 6,
    producedBy: 'Alex Chen',
    notes: 'Berries from Fresh Farms',
    status: 'completed',
  },
  {
    id: '4',
    recipeId: '4',
    recipeName: 'Pistachio Gelato',
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: 6,
    producedBy: 'Alex Chen',
    notes: 'Premium batch for weekend',
    status: 'in-progress',
  },
  {
    id: '5',
    recipeId: '1',
    recipeName: 'Vanilla Gelato',
    date: format(subDays(new Date(), -1), 'yyyy-MM-dd'),
    quantity: 9,
    producedBy: 'Maria Rodriguez',
    notes: 'For weekend special',
    status: 'planned',
  }
];

export const generateProducts = (): Product[] => [
  {
    id: '1',
    name: 'Vanilla Gelato',
    category: 'gelato',
    availableQuantity: 18,
    unit: 'liters',
    pricePerUnit: 12.99,
    expirationDate: format(subDays(new Date(), -7), 'yyyy-MM-dd'),
    dateCreated: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
  },
  {
    id: '2',
    name: 'Chocolate Gelato',
    category: 'gelato',
    availableQuantity: 15,
    unit: 'liters',
    pricePerUnit: 12.99,
    expirationDate: format(subDays(new Date(), -7), 'yyyy-MM-dd'),
    dateCreated: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
  },
  {
    id: '3',
    name: 'Strawberry Gelato',
    category: 'gelato',
    availableQuantity: 10,
    unit: 'liters',
    pricePerUnit: 13.99,
    expirationDate: format(subDays(new Date(), -5), 'yyyy-MM-dd'),
    dateCreated: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
  },
  {
    id: '4',
    name: 'Pistachio Gelato',
    category: 'gelato',
    availableQuantity: 5,
    unit: 'liters',
    pricePerUnit: 14.99,
    expirationDate: format(subDays(new Date(), -7), 'yyyy-MM-dd'),
    dateCreated: format(subDays(new Date(), 0), 'yyyy-MM-dd'),
  }
];

export const generateSales = (): Sale[] => [
  {
    id: '1',
    date: format(subDays(new Date(), 0), 'yyyy-MM-dd'),
    productId: '1',
    productName: 'Vanilla Gelato',
    quantity: 2,
    unitPrice: 12.99,
    total: 25.98,
    paymentMethod: 'card',
  },
  {
    id: '2',
    date: format(subDays(new Date(), 0), 'yyyy-MM-dd'),
    productId: '2',
    productName: 'Chocolate Gelato',
    quantity: 3,
    unitPrice: 12.99,
    total: 38.97,
    paymentMethod: 'cash',
  },
  {
    id: '3',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    productId: '3',
    productName: 'Strawberry Gelato',
    quantity: 2,
    unitPrice: 13.99,
    total: 27.98,
    paymentMethod: 'card',
  },
  {
    id: '4',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    productId: '4',
    productName: 'Pistachio Gelato',
    quantity: 1,
    unitPrice: 14.99,
    total: 14.99,
    paymentMethod: 'mobile',
  },
  {
    id: '5',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    productId: '1',
    productName: 'Vanilla Gelato',
    quantity: 3,
    unitPrice: 12.99,
    total: 38.97,
    paymentMethod: 'card',
  }
];

// Dashboard Analytics
export type DashboardStats = {
  totalInventoryValue: number;
  lowStockItems: number;
  todayProduction: number;
  todaySales: number;
  trendingProduct: {
    name: string;
    growth: string;
  };
  monthlySales: {
    month: string;
    amount: number;
  }[];
  productPerformance: {
    name: string;
    sales: number;
    inventory: number;
  }[];
  upcomingExpiry: {
    name: string;
    date: string;
    daysLeft: number;
  }[];
};

export const generateDashboardStats = (): DashboardStats => {
  const ingredients = generateIngredients();
  const products = generateProducts();
  const batches = generateProductionBatches();
  const sales = generateSales();

  // Calculate inventory value
  const inventoryValue = ingredients.reduce((total, ing) => {
    return total + (ing.quantity * ing.pricePerUnit);
  }, 0);

  // Count low stock items
  const lowStockItems = ingredients.filter(ing => ing.quantity <= ing.threshold).length;

  // Calculate today's production
  const todayProductionBatches = batches.filter(
    batch => batch.date === format(new Date(), 'yyyy-MM-dd') && batch.status !== 'planned'
  );
  const todayProduction = todayProductionBatches.reduce((total, batch) => total + batch.quantity, 0);

  // Calculate today's sales
  const todaySales = sales
    .filter(sale => sale.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((total, sale) => total + sale.total, 0);

  return {
    totalInventoryValue: parseFloat(inventoryValue.toFixed(2)),
    lowStockItems,
    todayProduction,
    todaySales: parseFloat(todaySales.toFixed(2)),
    trendingProduct: {
      name: 'Chocolate Gelato',
      growth: '24%'
    },
    monthlySales: [
      { month: 'Jan', amount: 2400 },
      { month: 'Feb', amount: 2210 },
      { month: 'Mar', amount: 2900 },
      { month: 'Apr', amount: 3100 },
      { month: 'May', amount: 3500 },
      { month: 'Jun', amount: 3200 },
    ],
    productPerformance: [
      { name: 'Vanilla Gelato', sales: 45, inventory: 18 },
      { name: 'Chocolate Gelato', sales: 52, inventory: 15 },
      { name: 'Strawberry Gelato', sales: 38, inventory: 10 },
      { name: 'Pistachio Gelato', sales: 25, inventory: 5 },
    ],
    upcomingExpiry: [
      { 
        name: 'Strawberries', 
        date: format(subDays(new Date(), -5), 'yyyy-MM-dd'), 
        daysLeft: 5 
      },
      { 
        name: 'Whole Milk', 
        date: format(subDays(new Date(), -14), 'yyyy-MM-dd'), 
        daysLeft: 14 
      },
      { 
        name: 'Heavy Cream', 
        date: format(subDays(new Date(), -10), 'yyyy-MM-dd'), 
        daysLeft: 10 
      },
    ],
  };
};
