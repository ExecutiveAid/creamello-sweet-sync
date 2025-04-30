
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Types for our order system
export interface IceCreamFlavor {
  id: string;
  name: string;
  description: string;
  pricePerScoop: number;
  image: string;
  category: string;
  available: boolean;
}

export interface OrderItem {
  flavorId: string;
  flavorName: string;
  scoops: number;
  price: number;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  createdAt: Date;
  staffId: string;
  staffName: string;
  tableNumber?: string;
  customerName?: string;
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  getOrdersByStatus: (status?: Order['status']) => Order[];
  // We'll add a currentUser field later for authentication
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);

  const addOrder = (order: Order) => {
    setOrders([...orders, order]);
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status } 
        : order
    ));
  };

  const getOrdersByStatus = (status?: Order['status']) => {
    if (!status) return orders;
    return orders.filter(order => order.status === status);
  };

  // Later, we'll add currentUser from authentication here
  const value: OrderContextType = {
    orders, 
    addOrder, 
    updateOrderStatus, 
    getOrdersByStatus
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrderContext = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrderContext must be used within an OrderProvider');
  }
  return context;
};
