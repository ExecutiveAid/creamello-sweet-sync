import React, { createContext, useContext, useState } from 'react';
import { Product, generateProducts } from '@/data/mockData';

interface ProductInventoryContextType {
  products: Product[];
  deductStock: (productId: string, quantity: number) => void;
  restockProduct: (productId: string, quantity: number) => void;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const ProductInventoryContext = createContext<ProductInventoryContextType | undefined>(undefined);

export const ProductInventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(generateProducts());

  const deductStock = (productId: string, quantity: number) => {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, availableQuantity: Math.max(0, p.availableQuantity - quantity) }
        : p
    ));
  };

  const restockProduct = (productId: string, quantity: number) => {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, availableQuantity: p.availableQuantity + quantity }
        : p
    ));
  };

  return (
    <ProductInventoryContext.Provider value={{ products, deductStock, restockProduct, setProducts }}>
      {children}
    </ProductInventoryContext.Provider>
  );
};

export const useProductInventory = () => {
  const ctx = useContext(ProductInventoryContext);
  if (!ctx) throw new Error('useProductInventory must be used within a ProductInventoryProvider');
  return ctx;
}; 