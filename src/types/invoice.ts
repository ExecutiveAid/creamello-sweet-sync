export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled' | 'partial';

export interface Invoice {
  id: string;
  sales_order_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date?: string;
  total_amount: number;
  status: InvoiceStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method?: string;
  reference?: string;
  created_at: string;
} 