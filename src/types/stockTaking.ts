// Stock Taking System Types

export interface StockTake {
  id: string;
  reference_number: string;
  title: string;
  description?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  location: string;
  initiated_by: string;
  initiated_at: string;
  started_at?: string;
  completed_at?: string;
  approved_by?: string;
  approved_at?: string;
  total_items_counted: number;
  total_variance_value: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_category: string;
  system_quantity: number;
  physical_quantity?: number;
  variance_quantity?: number; // calculated field
  unit_cost: number;
  variance_value?: number; // calculated field
  counted_by?: string;
  counted_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustment {
  id: string;
  reference_number: string;
  stock_take_id?: string;
  inventory_item_id: string;
  inventory_item_name: string;
  adjustment_type: 'increase' | 'decrease' | 'correction';
  quantity_before: number;
  quantity_after: number;
  adjustment_quantity?: number; // calculated field
  unit_cost: number;
  adjustment_value?: number; // calculated field
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  applied_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'production' | 'waste' | 'return';
  reference_id?: string;
  reference_type?: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  total_value?: number; // calculated field
  created_by: string;
  notes?: string;
  created_at: string;
}

// Form types for creating new records
export interface CreateStockTakeRequest {
  title: string;
  description?: string;
  location?: string;
  notes?: string;
}

export interface UpdateStockTakeItemRequest {
  physical_quantity: number;
  notes?: string;
}

export interface CreateStockAdjustmentRequest {
  inventory_item_id: string;
  inventory_item_name: string;
  adjustment_type: 'increase' | 'decrease' | 'correction';
  quantity_after: number;
  reason: string;
  notes?: string;
}

// Response types for API calls
export interface StockTakeWithItems extends StockTake {
  items: StockTakeItem[];
}

export interface StockTakeVarianceReport {
  stock_take: StockTake;
  total_items: number;
  items_with_variance: number;
  total_variance_value: number;
  positive_variances: number;
  negative_variances: number;
  variance_items: StockTakeItem[];
}

// Utility types
export interface StockTakeStats {
  total_stock_takes: number;
  active_stock_takes: number;
  completed_this_month: number;
  pending_adjustments: number;
  total_variance_this_month: number;
}

export interface StockTakeFilters {
  status?: string;
  location?: string;
  initiated_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface StockAdjustmentFilters {
  status?: string;
  adjustment_type?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Constants
export const STOCK_TAKE_STATUSES = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const ADJUSTMENT_TYPES = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
  CORRECTION: 'correction'
} as const;

export const ADJUSTMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export const MOVEMENT_TYPES = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  ADJUSTMENT: 'adjustment',
  TRANSFER: 'transfer',
  PRODUCTION: 'production',
  WASTE: 'waste',
  RETURN: 'return'
} as const; 