import { supabase } from '@/integrations/supabase/client';

export interface InventoryMovement {
  id: string;
  inventory_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'WASTE' | 'SALE' | 'PRODUCTION';
  quantity: number;
  unit_cost: number;
  reference_type?: 'PURCHASE' | 'SALE' | 'PRODUCTION' | 'ADJUSTMENT' | 'TRANSFER' | 'WASTE' | 'RETURN';
  reference_id?: string;
  reference_number?: string;
  notes?: string;
  reason?: string;
  from_location?: string;
  to_location?: string;
  created_by: string;
  movement_date: string;
  created_at: string;
}

export interface ReplenishmentData {
  inventory_id: string;
  quantity: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
  created_by: string;
}

export interface ConsumptionData {
  inventory_id: string;
  quantity: number;
  movement_type?: 'OUT' | 'SALE' | 'PRODUCTION' | 'WASTE';
  reference_type?: 'SALE' | 'PRODUCTION' | 'WASTE';
  reference_id?: string;
  notes?: string;
  created_by: string;
}

export class InventoryMovementService {
  /**
   * Add stock to inventory (proper replenishment)
   * This is the INDUSTRY STANDARD way to handle restocking
   */
  static async replenishStock(data: ReplenishmentData): Promise<{ success: boolean; movement_id?: string; error?: string }> {
    try {
      // Use the database function for proper stock replenishment
      const { data: result, error } = await supabase.rpc('add_inventory_stock', {
        p_inventory_id: data.inventory_id,
        p_quantity: data.quantity,
        p_unit_cost: data.unit_cost || 0,
        p_reference_number: data.reference_number || null,
        p_notes: data.notes || null,
        p_created_by: data.created_by
      });

      if (error) throw error;

      return { success: true, movement_id: result };
    } catch (error: any) {
      console.error('Error replenishing stock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Consume stock from inventory (for sales, production, waste)
   */
  static async consumeStock(data: ConsumptionData): Promise<{ success: boolean; movement_id?: string; error?: string }> {
    try {
      // Use the database function for proper stock consumption
      const { data: result, error } = await supabase.rpc('consume_inventory_stock', {
        p_inventory_id: data.inventory_id,
        p_quantity: data.quantity,
        p_movement_type: data.movement_type || 'OUT',
        p_reference_type: data.reference_type || 'SALE',
        p_reference_id: data.reference_id || null,
        p_notes: data.notes || null,
        p_created_by: data.created_by
      });

      if (error) throw error;

      return { success: true, movement_id: result };
    } catch (error: any) {
      console.error('Error consuming stock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get movement history for an inventory item
   */
  static async getMovementHistory(inventoryId: string, limit = 50): Promise<InventoryMovement[]> {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('movement_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching movement history:', error);
      return [];
    }
  }

  /**
   * Get inventory summary with movement statistics
   */
  static async getInventorySummary() {
    try {
      const { data, error } = await supabase
        .from('inventory_summary')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching inventory summary:', error);
      return [];
    }
  }

  /**
   * Create manual adjustment (for corrections, stock takes, etc.)
   */
  static async createAdjustment(
    inventoryId: string,
    quantityChange: number,
    reason: string,
    createdBy: string,
    notes?: string
  ): Promise<{ success: boolean; movement_id?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
          inventory_id: inventoryId,
          movement_type: 'ADJUSTMENT',
          quantity: quantityChange,
          reference_type: 'ADJUSTMENT',
          reason,
          notes,
          created_by: createdBy
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, movement_id: data.id };
    } catch (error: any) {
      console.error('Error creating adjustment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get low stock items based on minimum stock levels
   */
  static async getLowStockItems() {
    try {
      // Use a custom query to compare available_quantity with minimum_stock_level
      const { data, error } = await supabase
        .rpc('get_low_stock_items');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching low stock items:', error);
      // Fallback to basic query if RPC function doesn't exist
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('inventory')
          .select('*')
          .eq('is_active', true)
          .order('available_quantity', { ascending: true });
        
        if (fallbackError) throw fallbackError;
        
        // Filter low stock items in JavaScript
        return (fallbackData || []).filter(item => 
          item.available_quantity <= item.minimum_stock_level
        );
      } catch (fallbackErr: any) {
        console.error('Fallback query also failed:', fallbackErr);
        return [];
      }
    }
  }

  /**
   * Get items expiring soon
   */
  static async getExpiringItems(daysAhead = 7) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .not('expiration_date', 'is', null)
        .lte('expiration_date', futureDate.toISOString().split('T')[0])
        .eq('is_active', true)
        .order('expiration_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching expiring items:', error);
      return [];
    }
  }

  /**
   * Get movement statistics for reporting
   */
  static async getMovementStats(startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          movement_type,
          quantity,
          unit_cost,
          movement_date,
          inventory:inventory_id (
            name,
            category,
            unit
          )
        `);

      if (startDate) {
        query = query.gte('movement_date', startDate);
      }
      if (endDate) {
        query = query.lte('movement_date', endDate);
      }

      const { data, error } = await query.order('movement_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching movement stats:', error);
      return [];
    }
  }
}

export default InventoryMovementService; 