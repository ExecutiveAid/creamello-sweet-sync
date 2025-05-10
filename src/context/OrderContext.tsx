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
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
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

    // Deduct from production batch if delivered
    if (status === 'completed') {
      console.log(`Order ${orderId} marked as completed, deducting from production batches...`);
      // Fetch the order and its items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();
      if (orderError || !orderData) {
        console.error("Error fetching order data:", orderError);
        return;
      }
      const items = orderData.order_items || [];
      console.log(`Processing ${items.length} items from order ${orderId}`);
      
      for (const item of items) {
        // Determine deduction amount and unit
        let deduction = 0;
        let unit = '';
        let productName = item.flavor_name;
        // Try to fetch the menu item to get the category
        let category = '';
        const { data: menuItem } = await supabase
          .from('menu_items')
          .select('category')
          .eq('name', productName)
          .single();
        if (menuItem) category = menuItem.category;
        console.log(`Item: ${productName}, Category: ${category}, Scoops/Quantity: ${item.scoops || 1}`);
        
        if (category === 'Flavors') {
          deduction = (item.scoops || 1) * 100; // 100g per scoop
          unit = 'g';
        } else if (category === 'Milkshakes') {
          deduction = (item.scoops || 1) * 250; // 250ml per order
          unit = 'ml';
        } else if (category === 'Juice') {
          deduction = (item.scoops || 1) * 250; // 250ml per order
          unit = 'ml';
        } else if (category === 'Sundaes' && productName.toLowerCase().includes('cone')) {
          deduction = (item.scoops || 1) * 1; // 1 per order
          unit = 'pcs';
        } else {
          // Default: try to deduct by quantity if possible
          deduction = (item.scoops || 1);
          unit = '';
        }
        console.log(`Calculated deduction: ${deduction}${unit}`);
        
        // Find the most recent production batch for this product
        const { data: batch, error: batchError } = await supabase
          .from('production_batches')
          .select('*')
          .eq('product_name', productName)
          .order('production_date', { ascending: false })
          .limit(1)
          .single();
          
        if (batchError) {
          console.error(`No batch found for ${productName}:`, batchError.message);
          continue;
        }
          
        if (batch && batch.available_quantity > 0) {
          let newQty = batch.available_quantity;
          let originalDeduction = deduction;
          
          // Convert units if needed
          if (batch.unit === 'kg' && unit === 'g') {
            deduction = deduction / 1000; // convert g to kg
            console.log(`Converting ${originalDeduction}g to ${deduction}kg`);
          } else if (batch.unit === 'L' && unit === 'ml') {
            deduction = deduction / 1000; // convert ml to L
            console.log(`Converting ${originalDeduction}ml to ${deduction}L`);
          }
          
          newQty = Math.max(0, newQty - deduction);
          console.log(`Deducting ${deduction}${batch.unit} from batch ${batch.id} for ${productName}`);
          console.log(`Previous quantity: ${batch.available_quantity}${batch.unit}, New quantity: ${newQty}${batch.unit}`);
          
          await supabase
            .from('production_batches')
            .update({ available_quantity: newQty })
            .eq('id', batch.id);
          
          console.log(`✅ Successfully updated batch ${batch.id}`);
        } else {
          console.warn(`❌ No available inventory for ${productName}`);
        }
      }
      console.log(`✅ Finished processing order ${orderId}`);
    }
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
