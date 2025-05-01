import React, { createContext, useContext, useState } from 'react';
import { Ingredient, generateIngredients } from '@/data/mockData';

interface IngredientInventoryContextType {
  ingredients: Ingredient[];
  deductIngredient: (ingredientId: string, quantity: number) => void;
  restockIngredient: (ingredientId: string, quantity: number) => void;
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
}

const IngredientInventoryContext = createContext<IngredientInventoryContextType | undefined>(undefined);

export const IngredientInventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(generateIngredients());

  const deductIngredient = (ingredientId: string, quantity: number) => {
    setIngredients(prev => prev.map(i =>
      i.id === ingredientId
        ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
        : i
    ));
  };

  const restockIngredient = (ingredientId: string, quantity: number) => {
    setIngredients(prev => prev.map(i =>
      i.id === ingredientId
        ? { ...i, quantity: i.quantity + quantity }
        : i
    ));
  };

  return (
    <IngredientInventoryContext.Provider value={{ ingredients, deductIngredient, restockIngredient, setIngredients }}>
      {children}
    </IngredientInventoryContext.Provider>
  );
};

export const useIngredientInventory = () => {
  const ctx = useContext(IngredientInventoryContext);
  if (!ctx) throw new Error('useIngredientInventory must be used within an IngredientInventoryProvider');
  return ctx;
}; 