import { supabase } from '@/integrations/supabase/client';
import { Invoice, Payment, InvoiceStatus } from '@/types/invoice';

export const getInvoices = async (): Promise<Invoice[]> => {
  const { data, error } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getInvoiceById = async (id: string): Promise<Invoice | null> => {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error) throw error;
  return data || null;
};

export const createInvoice = async (invoice: Partial<Invoice>): Promise<string> => {
  const { data, error } = await supabase.from('invoices').insert([invoice]).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
  const { error } = await supabase.from('invoices').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteInvoice = async (id: string) => {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
};

// Payments
export const getPayments = async (invoice_id?: string): Promise<Payment[]> => {
  let query = supabase.from('payments').select('*').order('payment_date', { ascending: false });
  if (invoice_id) query = query.eq('invoice_id', invoice_id);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createPayment = async (payment: Partial<Payment>): Promise<string> => {
  const { data, error } = await supabase.from('payments').insert([payment]).select('id').single();
  if (error) throw error;
  // After payment, update invoice status
  if (payment.invoice_id) {
    await updateInvoiceStatusFromPayments(payment.invoice_id);
  }
  return data.id;
};

export const updateInvoiceStatusFromPayments = async (invoiceId: string) => {
  // Fetch invoice and all payments
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
  const { data: payments } = await supabase.from('payments').select('*').eq('invoice_id', invoiceId);
  if (!invoice) return;
  const totalPaid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  let status: InvoiceStatus = 'unpaid';
  if (totalPaid >= invoice.total_amount) {
    status = 'paid';
  } else if (totalPaid > 0) {
    status = 'partial';
  } else {
    status = 'unpaid';
  }
  await supabase.from('invoices').update({ status }).eq('id', invoiceId);
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  // Fetch the latest invoice number
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
  let nextNumber = 1;
  if (data && data.invoice_number) {
    const match = data.invoice_number.match(/INV-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  return `INV-${nextNumber.toString().padStart(5, '0')}`;
}; 