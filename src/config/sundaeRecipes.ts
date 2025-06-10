// Sundae Recipe Configuration
// This defines what ingredients are needed for each sundae item

export interface SundaeIngredient {
  name: string;           // Name to match with inventory item
  quantity: number;       // Amount needed
  unit: string;           // Unit (g, ml, pcs, etc.)
  category?: string;      // Category to help find the inventory item
}

export interface SundaeRecipe {
  sundaeName: string;     // Name of the sundae menu item
  ingredients: SundaeIngredient[];
}

// Define recipes for each sundae
export const SUNDAE_RECIPES: SundaeRecipe[] = [
  {
    sundaeName: "Chocolate Sundae",
    ingredients: [
      { name: "Chocolate", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Chocolate Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Vanilla Sundae", 
    ingredients: [
      { name: "Vanilla", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Caramel Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Strawberry Sundae",
    ingredients: [
      { name: "Strawberry", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Strawberry Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Fresh Strawberry", quantity: 3, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Hot Fudge Sundae",
    ingredients: [
      { name: "Vanilla", quantity: 150, unit: "g", category: "Flavors" },
      { name: "Chocolate", quantity: 50, unit: "g", category: "Flavors" },
      { name: "Hot Fudge Sauce", quantity: 40, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 25, unit: "ml", category: "Toppings" },
      { name: "Crushed Nuts", quantity: 10, unit: "g", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Banana Split",
    ingredients: [
      { name: "Vanilla", quantity: 100, unit: "g", category: "Flavors" },
      { name: "Chocolate", quantity: 100, unit: "g", category: "Flavors" },
      { name: "Strawberry", quantity: 100, unit: "g", category: "Flavors" },
      { name: "Fresh Banana", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Chocolate Sauce", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Strawberry Sauce", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Caramel Sauce", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Crushed Nuts", quantity: 15, unit: "g", category: "Toppings" },
      { name: "Cherry", quantity: 3, unit: "pcs", category: "Toppings" }
    ]
  },
  {
    sundaeName: "Oreo Sundae",
    ingredients: [
      { name: "Oreo", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Chocolate Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Crushed Oreo", quantity: 20, unit: "g", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Kitkat Sundae",
    ingredients: [
      { name: "Kitkat", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Chocolate Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Crushed Kitkat", quantity: 20, unit: "g", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  },
  {
    sundaeName: "Pistachio Sundae",
    ingredients: [
      { name: "Pistachios", quantity: 200, unit: "g", category: "Flavors" },
      { name: "Honey Sauce", quantity: 30, unit: "ml", category: "Toppings" },
      { name: "Whipped Cream", quantity: 20, unit: "ml", category: "Toppings" },
      { name: "Crushed Pistachios", quantity: 15, unit: "g", category: "Toppings" },
      { name: "Cherry", quantity: 1, unit: "pcs", category: "Toppings" },
      { name: "Waffle Cone", quantity: 1, unit: "pcs", category: "Cones" }
    ]
  }
];

// Helper function to get recipe for a sundae
export const getSundaeRecipe = (sundaeName: string): SundaeRecipe | null => {
  return SUNDAE_RECIPES.find(recipe => 
    recipe.sundaeName.toLowerCase() === sundaeName.toLowerCase()
  ) || null;
};

// Helper function to check if an item is a sundae
export const isSundae = (itemName: string): boolean => {
  return SUNDAE_RECIPES.some(recipe => 
    recipe.sundaeName.toLowerCase() === itemName.toLowerCase()
  );
}; 