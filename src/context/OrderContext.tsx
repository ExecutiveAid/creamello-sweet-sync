import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import InventoryMovementService from '@/services/inventoryMovementService';
import { SundaeDeductionService } from '@/services/sundaeDeductionService';
import { isSundae } from '@/config/sundaeRecipes';

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

    // Deduct from inventory when order is completed
    if (status === 'completed') {
      console.log(`Order ${orderId} marked as completed, deducting from inventory...`);
      
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
        let productName = item.flavor_name;
        
        // Fetch the menu item to get the category
        let category = '';
        const { data: menuItem } = await supabase
          .from('menu_items')
          .select('category')
          .eq('name', productName)
          .single();
        
        if (menuItem) category = menuItem.category;
        console.log(`Item: ${productName}, Category: ${category}, Scoops/Quantity: ${item.scoops || 1}`);
        
        // 🍨 NEW: Handle sundaes with recipe-based deduction
        if (category === 'Sundaes' && isSundae(productName)) {
          console.log(`🍨 Processing sundae: ${productName}`);
          
          const sundaeResult = await SundaeDeductionService.deductSundaeIngredients(
            productName,
            item.scoops || 1,
            orderId,
            orderData.staff_id || 'system'
          );
          
          if (sundaeResult.success) {
            console.log(`✅ Sundae deduction successful for ${productName}:`);
            console.log(`   Deducted ingredients: ${sundaeResult.deductedIngredients.join(', ')}`);
          } else {
            console.error(`❌ Sundae deduction failed for ${productName}:`);
            if (sundaeResult.missingIngredients.length > 0) {
              console.error(`   Missing: ${sundaeResult.missingIngredients.join(', ')}`);
            }
            if (sundaeResult.errors.length > 0) {
              console.error(`   Errors: ${sundaeResult.errors.join(', ')}`);
            }
          }
          
          // Skip the normal deduction process for sundaes
          continue;
        }
        
        // 🥤 Handle other categories with simple deduction logic
        let deduction = 0;
        let unit = '';
        
        if (category === 'Flavors') {
          deduction = (item.scoops || 1) * 100; // 100g per scoop
          unit = 'g';
        } else if (category === 'Milkshakes') {
          deduction = (item.scoops || 1) * 250; // 250ml per order
          unit = 'ml';
        } else if (category === 'Juice') {
          deduction = (item.scoops || 1) * 250; // 250ml per order
          unit = 'ml';
        } else {
          // Default: deduct by quantity
          deduction = (item.scoops || 1);
          unit = '';
        }
        console.log(`Calculated deduction: ${deduction}${unit}`);
        
        // NEW: Find the corresponding inventory item instead of production batch
        const { data: inventoryItem, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, name, category, available_quantity, unit, cost_per_unit, price_per_unit')
          .eq('name', productName)
          .eq('category', category)
          .eq('is_active', true)
          .single();
          
        if (inventoryError || !inventoryItem) {
          console.error(`No inventory item found for ${productName}:`, inventoryError?.message);
          
          // FALLBACK: Try the old production batch method for backward compatibility
          console.log(`Falling back to production batch deduction for ${productName}...`);
        const { data: batch, error: batchError } = await supabase
          .from('production_batches')
          .select('*')
          .eq('product_name', productName)
          .order('production_date', { ascending: false })
          .limit(1)
          .single();
          
          if (!batchError && batch && batch.available_quantity > 0) {
            let convertedDeduction = deduction;
          
          // Convert units if needed
          if (batch.unit === 'kg' && unit === 'g') {
              convertedDeduction = deduction / 1000;
          } else if (batch.unit === 'L' && unit === 'ml') {
              convertedDeduction = deduction / 1000;
          }
          
            const newQty = Math.max(0, batch.available_quantity - convertedDeduction);
          await supabase
            .from('production_batches')
            .update({ available_quantity: newQty })
            .eq('id', batch.id);
          
            console.log(`✅ Fallback: Updated production batch ${batch.id}`);
          } else {
            console.warn(`❌ No available stock for ${productName} in production batches either`);
          }
          continue;
        }
        
        // NEW: Convert deduction to inventory unit if needed
        let convertedDeduction = deduction;
        if (inventoryItem.unit === 'kg' && unit === 'g') {
          convertedDeduction = deduction / 1000; // convert g to kg
          console.log(`Converting ${deduction}g to ${convertedDeduction}kg for inventory`);
        } else if (inventoryItem.unit === 'L' && unit === 'ml') {
          convertedDeduction = deduction / 1000; // convert ml to L
          console.log(`Converting ${deduction}ml to ${convertedDeduction}L for inventory`);
        } else if (inventoryItem.unit === 'pieces' && unit === 'pcs') {
          // Same unit, no conversion needed
          convertedDeduction = deduction;
        }
        
        // Check if enough inventory is available
        if (inventoryItem.available_quantity < convertedDeduction) {
          console.warn(`❌ Insufficient inventory for ${productName}. Available: ${inventoryItem.available_quantity}${inventoryItem.unit}, Needed: ${convertedDeduction}${inventoryItem.unit}`);
          continue;
        }
        
        // NEW: Use InventoryMovementService to deduct from inventory with proper audit trail
        console.log(`Deducting ${convertedDeduction}${inventoryItem.unit} from inventory for ${productName}`);
        
        const result = await InventoryMovementService.consumeStock({
          inventory_id: inventoryItem.id,
          quantity: convertedDeduction,
          movement_type: 'SALE',
          reference_type: 'SALE',
          reference_id: orderId,
          notes: `Sale: ${item.scoops || 1} ${item.scoops > 1 ? 'scoops' : 'scoop'} of ${productName}`,
          created_by: orderData.staff_id || 'system'
        });
        
        if (result.success) {
          console.log(`✅ Successfully deducted ${convertedDeduction}${inventoryItem.unit} from inventory for ${productName}`);
          
          // Calculate and log profit information
          const costOfGoodsSold = convertedDeduction * inventoryItem.cost_per_unit;
          const revenue = item.price;
          const profit = revenue - costOfGoodsSold;
          
          console.log(`💰 Sales Analytics for ${productName}:`);
          console.log(`   Revenue: GHS${revenue.toFixed(2)}`);
          console.log(`   COGS: GHS${costOfGoodsSold.toFixed(2)} (${convertedDeduction}${inventoryItem.unit} × GHS${inventoryItem.cost_per_unit}/${inventoryItem.unit})`);
          console.log(`   Profit: GHS${profit.toFixed(2)} (${((profit / revenue) * 100).toFixed(1)}% margin)`);
        } else {
          console.error(`❌ Failed to deduct inventory for ${productName}:`, result.error);
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
