import { supabase } from '@/integrations/supabase/client';
import { SalesOrder, SalesOrderItem, SalesOrderStatus } from '@/types/salesOrder';

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `SO-${datePart}-${randomPart}`;
}

function calculateTotalAmount(items: Partial<SalesOrderItem>[]): number {
  return (items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
}

export const getSalesOrders = async (): Promise<SalesOrder[]> => {
  const { data, error } = await supabase
    .from('sales_orders')
    .select('*, sales_order_items(*)')
    .order('order_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((so: any) => ({ ...so, items: so.sales_order_items }));
};

export const getSalesOrderById = async (id: string): Promise<SalesOrder | null> => {
  const { data, error } = await supabase
    .from('sales_orders')
    .select('*, sales_order_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data ? { ...data, items: data.sales_order_items } : null;
};

export const createSalesOrder = async (so: Partial<SalesOrder>, items: Partial<SalesOrderItem>[]): Promise<string> => {
  const order_number = so.order_number || generateOrderNumber();
  const total_amount = calculateTotalAmount(items);
  const { data, error } = await supabase
    .from('sales_orders')
    .insert([{ ...so, order_number, total_amount }])
    .select('id')
    .single();
  if (error) throw error;
  const soId = data.id;
  if (items && items.length > 0) {
    await supabase.from('sales_order_items').insert(
      items.map(item => ({ ...item, sales_order_id: soId }))
    );
  }
  return soId;
};

export const updateSalesOrder = async (id: string, updates: Partial<SalesOrder>, items?: Partial<SalesOrderItem>[]) => {
  let total_amount = updates.total_amount;
  if (items) {
    total_amount = calculateTotalAmount(items);
  }
  const { error } = await supabase
    .from('sales_orders')
    .update({ ...updates, total_amount, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  // Optionally update line items here if needed
};

export const updateSalesOrderStatus = async (id: string, status: SalesOrderStatus) => {
  const { error } = await supabase
    .from('sales_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const deleteSalesOrder = async (id: string) => {
  const { error } = await supabase
    .from('sales_orders')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const addSalesOrderItem = async (item: Partial<SalesOrderItem>) => {
  const { error } = await supabase
    .from('sales_order_items')
    .insert([item]);
  if (error) throw error;
};

export const updateSalesOrderItem = async (id: string, updates: Partial<SalesOrderItem>) => {
  const { error } = await supabase
    .from('sales_order_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const deleteSalesOrderItem = async (id: string) => {
  const { error } = await supabase
    .from('sales_order_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}; 