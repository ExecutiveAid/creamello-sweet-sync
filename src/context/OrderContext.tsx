import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

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
  id: string;
  order_id: string;
  flavor_id: string;
  flavor_name: string;
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
  staff_id: string;
  customer_name?: string;
  table_number?: string;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  payment_method?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
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

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (data) {
        setOrders(
          data.map((order: any) => ({ ...order, items: order.order_items }))
        );
      }
    };
    fetchOrders();
  }, []);

  const addOrder = async (
    order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items'>,
    items: Omit<OrderItem, 'id' | 'order_id'>[]
  ) => {
    const order_id = uuidv4();
    const now = new Date().toISOString();
    const orderRow = {
      ...order,
      id: order_id,
      created_at: now,
      updated_at: now,
    };
    await supabase.from('orders').insert([orderRow]);
    const itemRows = items.map(item => ({ ...item, order_id, id: uuidv4() }));
    await supabase.from('order_items').insert(itemRows);
    setOrders(prev => [{ ...orderRow, items: itemRows }, ...prev]);
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status } : order));
    await supabase.from('orders').update({ status }).eq('id', orderId);
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
    getOrdersByStatus,
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
