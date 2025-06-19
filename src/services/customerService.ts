import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/customer';

export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
};

export const getCustomerById = async (id: string): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data || null;
};

export const createCustomer = async (customer: Partial<Customer>): Promise<string> => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>) => {
  const { error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
};

export const deleteCustomer = async (id: string) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}; 