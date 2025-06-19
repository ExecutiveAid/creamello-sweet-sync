import { supabase } from '@/integrations/supabase/client';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/types/purchaseOrder';

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `PO-${datePart}-${randomPart}`;
}

function calculateTotalAmount(items: Partial<PurchaseOrderItem>[]): number {
  return (items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
}

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .order('order_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((po: any) => ({ ...po, items: po.purchase_order_items }));
};

export const getPurchaseOrderById = async (id: string): Promise<PurchaseOrder | null> => {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data ? { ...data, items: data.purchase_order_items } : null;
};

export const createPurchaseOrder = async (po: Partial<PurchaseOrder>, items: Partial<PurchaseOrderItem>[]): Promise<string> => {
  const order_number = po.order_number || generateOrderNumber();
  const total_amount = calculateTotalAmount(items);
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert([{ ...po, order_number, total_amount }])
    .select('id')
    .single();
  if (error) throw error;
  const poId = data.id;
  if (items && items.length > 0) {
    await supabase.from('purchase_order_items').insert(
      items.map(item => ({ ...item, purchase_order_id: poId }))
    );
  }
  return poId;
};

export const updatePurchaseOrder = async (id: string, updates: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]) => {
  let total_amount = updates.total_amount;
  if (items) {
    total_amount = calculateTotalAmount(items);
  }
  const { error } = await supabase
    .from('purchase_orders')
    .update({ ...updates, total_amount, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  // Optionally update line items here if needed
};

export const updatePurchaseOrderStatus = async (id: string, status: PurchaseOrderStatus) => {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const deletePurchaseOrder = async (id: string) => {
  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const addPurchaseOrderItem = async (item: Partial<PurchaseOrderItem>) => {
  const { error } = await supabase
    .from('purchase_order_items')
    .insert([item]);
  if (error) throw error;
};

export const updatePurchaseOrderItem = async (id: string, updates: Partial<PurchaseOrderItem>) => {
  const { error } = await supabase
    .from('purchase_order_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const deletePurchaseOrderItem = async (id: string) => {
  const { error } = await supabase
    .from('purchase_order_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}; 