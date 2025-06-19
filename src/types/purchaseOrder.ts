// Purchase Order Status Enum
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'closed' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  order_date: string;
  status: PurchaseOrderStatus;
  expected_delivery?: string;
  total_amount: number;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

export type PurchaseOrderItemStatus = 'pending' | 'received' | 'backordered';

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  description?: string;
  quantity: number;
  unit_price: number;
  received_quantity: number;
  status: PurchaseOrderItemStatus;
  created_at: string;
  updated_at: string;
} 