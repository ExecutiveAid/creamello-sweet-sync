// Sales Order Status Enum
export type SalesOrderStatus = 'draft' | 'confirmed' | 'partially_fulfilled' | 'fulfilled' | 'closed' | 'cancelled';

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  order_date: string;
  status: SalesOrderStatus;
  delivery_date?: string;
  total_amount: number;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  invoice_generated?: boolean;
  items?: SalesOrderItem[];
}

export type SalesOrderItemStatus = 'pending' | 'fulfilled' | 'backordered';

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  inventory_item_id: string;
  description?: string;
  quantity: number;
  unit_price: number;
  fulfilled_quantity: number;
  status: SalesOrderItemStatus;
  created_at: string;
  updated_at: string;
} 