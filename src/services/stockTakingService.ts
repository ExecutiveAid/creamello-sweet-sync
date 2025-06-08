import { supabase } from '@/integrations/supabase/client';
import {
  StockTake,
  StockTakeItem,
  StockAdjustment,
  StockMovement,
  CreateStockTakeRequest,
  UpdateStockTakeItemRequest,
  CreateStockAdjustmentRequest,
  StockTakeWithItems,
  StockTakeVarianceReport,
  StockTakeStats,
  StockTakeFilters,
  StockAdjustmentFilters,
  STOCK_TAKE_STATUSES,
  ADJUSTMENT_STATUSES
} from '@/types/stockTaking';

export class StockTakingService {
  
  // =================== STOCK TAKES ===================
  
  /**
   * Create a new stock take
   */
  static async createStockTake(request: CreateStockTakeRequest, userId: string): Promise<StockTake> {
    const { data, error } = await supabase
      .from('stock_takes')
      .insert([{
        title: request.title,
        description: request.description,
        location: request.location || 'main',
        initiated_by: userId,
        notes: request.notes
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create stock take: ${error.message}`);
    return data;
  }

  /**
   * Get all stock takes with optional filtering
   */
  static async getStockTakes(filters?: StockTakeFilters): Promise<StockTake[]> {
    let query = supabase
      .from('stock_takes')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.location) {
      query = query.eq('location', filters.location);
    }
    if (filters?.initiated_by) {
      query = query.eq('initiated_by', filters.initiated_by);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch stock takes: ${error.message}`);
    return data || [];
  }

  /**
   * Get a single stock take by ID
   */
  static async getStockTakeById(id: string): Promise<StockTake | null> {
    const { data, error } = await supabase
      .from('stock_takes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch stock take: ${error.message}`);
    }
    return data;
  }

  /**
   * Get stock take with all its items
   */
  static async getStockTakeWithItems(id: string): Promise<StockTakeWithItems | null> {
    const stockTake = await this.getStockTakeById(id);
    if (!stockTake) return null;

    const items = await this.getStockTakeItems(id);
    return { ...stockTake, items };
  }

  /**
   * Update stock take
   */
  static async updateStockTake(id: string, updates: Partial<StockTake>): Promise<StockTake> {
    const { data, error } = await supabase
      .from('stock_takes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update stock take: ${error.message}`);
    return data;
  }

  /**
   * Start a stock take (change status to in_progress and populate items)
   */
  static async startStockTake(id: string, userId: string): Promise<StockTakeWithItems> {
    // First, get all current inventory items
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory')
      .select('*');

    if (inventoryError) {
      throw new Error(`Failed to fetch inventory: ${inventoryError.message}`);
    }

    // Start the stock take
    const { data: stockTake, error: updateError } = await supabase
      .from('stock_takes')
      .update({
        status: STOCK_TAKE_STATUSES.IN_PROGRESS,
        started_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to start stock take: ${updateError.message}`);

    // Create stock take items for all inventory items
    const stockTakeItems = inventoryItems?.map(item => ({
      stock_take_id: id,
      inventory_item_id: item.id,
      inventory_item_name: item.name,
      inventory_item_category: item.category,
      system_quantity: item.available_quantity,
      unit_cost: item.price_per_unit
    })) || [];

    const { data: items, error: itemsError } = await supabase
      .from('stock_take_items')
      .insert(stockTakeItems)
      .select();

    if (itemsError) throw new Error(`Failed to create stock take items: ${itemsError.message}`);

    return { ...stockTake, items: items || [] };
  }

  /**
   * Complete a stock take
   */
  static async completeStockTake(id: string, userId: string): Promise<StockTake> {
    // Calculate totals
    const items = await this.getStockTakeItems(id);
    const totalItemsCounted = items.filter(item => item.physical_quantity !== null).length;
    const totalVarianceValue = items.reduce((sum, item) => sum + (item.variance_value || 0), 0);

    const { data, error } = await supabase
      .from('stock_takes')
      .update({
        status: STOCK_TAKE_STATUSES.COMPLETED,
        completed_at: new Date().toISOString(),
        total_items_counted: totalItemsCounted,
        total_variance_value: totalVarianceValue
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to complete stock take: ${error.message}`);
    return data;
  }

  /**
   * Approve a stock take (requires manager/admin role)
   */
  static async approveStockTake(id: string, userId: string): Promise<StockTake> {
    const { data, error } = await supabase
      .from('stock_takes')
      .update({
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to approve stock take: ${error.message}`);
    return data;
  }

  // =================== STOCK TAKE ITEMS ===================
  
  /**
   * Get all items for a stock take
   */
  static async getStockTakeItems(stockTakeId: string): Promise<StockTakeItem[]> {
    const { data, error } = await supabase
      .from('stock_take_items')
      .select('*')
      .eq('stock_take_id', stockTakeId)
      .order('inventory_item_name');

    if (error) throw new Error(`Failed to fetch stock take items: ${error.message}`);
    return data || [];
  }

  /**
   * Update a stock take item with physical count
   */
  static async updateStockTakeItem(
    itemId: string, 
    update: UpdateStockTakeItemRequest, 
    userId: string
  ): Promise<StockTakeItem> {
    const { data, error } = await supabase
      .from('stock_take_items')
      .update({
        physical_quantity: update.physical_quantity,
        notes: update.notes,
        counted_by: userId,
        counted_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update stock take item: ${error.message}`);
    return data;
  }

  // =================== STOCK ADJUSTMENTS ===================
  
  /**
   * Create stock adjustments from stock take variances
   */
  static async createAdjustmentsFromStockTake(stockTakeId: string, userId: string): Promise<StockAdjustment[]> {
    const items = await this.getStockTakeItems(stockTakeId);
    const varianceItems = items.filter(item => 
      item.physical_quantity !== null && (item.variance_quantity || 0) !== 0
    );

    const adjustments = await Promise.all(
      varianceItems.map(async item => {
        const adjustmentType = (item.variance_quantity || 0) > 0 ? 'increase' : 'decrease';
        
        const { data, error } = await supabase
          .from('stock_adjustments')
          .insert([{
            stock_take_id: stockTakeId,
            inventory_item_id: item.inventory_item_id,
            inventory_item_name: item.inventory_item_name,
            adjustment_type: adjustmentType,
            quantity_before: item.system_quantity,
            quantity_after: item.physical_quantity!,
            unit_cost: item.unit_cost,
            reason: `Stock take variance`,
            created_by: userId,
            notes: `Variance: ${item.variance_quantity} | Stock Take: ${stockTakeId}`
          }])
          .select()
          .single();

        if (error) throw new Error(`Failed to create adjustment: ${error.message}`);
        return data;
      })
    );

    return adjustments;
  }

  /**
   * Create a single stock adjustment
   */
  static async createStockAdjustment(
    request: CreateStockAdjustmentRequest, 
    userId: string,
    stockTakeId?: string
  ): Promise<StockAdjustment> {
    // Get current inventory quantity
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .select('available_quantity, price_per_unit')
      .eq('id', request.inventory_item_id)
      .single();

    if (inventoryError) {
      throw new Error(`Failed to fetch inventory item: ${inventoryError.message}`);
    }

    const { data, error } = await supabase
      .from('stock_adjustments')
      .insert([{
        stock_take_id: stockTakeId,
        inventory_item_id: request.inventory_item_id,
        inventory_item_name: request.inventory_item_name,
        adjustment_type: request.adjustment_type,
        quantity_before: inventoryItem.available_quantity,
        quantity_after: request.quantity_after,
        unit_cost: inventoryItem.price_per_unit,
        reason: request.reason,
        created_by: userId,
        notes: request.notes
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create stock adjustment: ${error.message}`);
    return data;
  }

  /**
   * Get stock adjustments with filtering
   */
  static async getStockAdjustments(filters?: StockAdjustmentFilters): Promise<StockAdjustment[]> {
    let query = supabase
      .from('stock_adjustments')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.adjustment_type) {
      query = query.eq('adjustment_type', filters.adjustment_type);
    }
    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters?.search) {
      query = query.or(`inventory_item_name.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%,reason.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch stock adjustments: ${error.message}`);
    return data || [];
  }

  /**
   * Approve a stock adjustment and apply it to inventory
   */
  static async approveStockAdjustment(adjustmentId: string, userId: string): Promise<boolean> {
    // Get the adjustment
    const { data: adjustment, error: fetchError } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', adjustmentId)
      .single();

    if (fetchError) throw new Error(`Failed to fetch adjustment: ${fetchError.message}`);

    // Update inventory
    const { error: inventoryError } = await supabase
      .from('inventory')
      .update({ available_quantity: adjustment.quantity_after })
      .eq('id', adjustment.inventory_item_id);

    if (inventoryError) throw new Error(`Failed to update inventory: ${inventoryError.message}`);

    // Update adjustment status
    const { error: adjustmentError } = await supabase
      .from('stock_adjustments')
      .update({
        status: ADJUSTMENT_STATUSES.APPROVED,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        applied_at: new Date().toISOString()
      })
      .eq('id', adjustmentId);

    if (adjustmentError) throw new Error(`Failed to approve adjustment: ${adjustmentError.message}`);

    return true;
  }

  // =================== REPORTING ===================
  
  /**
   * Generate variance report for a stock take
   */
  static async generateVarianceReport(stockTakeId: string): Promise<StockTakeVarianceReport> {
    const stockTake = await this.getStockTakeById(stockTakeId);
    if (!stockTake) throw new Error('Stock take not found');

    const items = await this.getStockTakeItems(stockTakeId);
    const varianceItems = items.filter(item => 
      item.physical_quantity !== null && (item.variance_quantity || 0) !== 0
    );

    const totalItems = items.length;
    const itemsWithVariance = varianceItems.length;
    const totalVarianceValue = varianceItems.reduce((sum, item) => sum + (item.variance_value || 0), 0);
    const positiveVariances = varianceItems.filter(item => (item.variance_quantity || 0) > 0).length;
    const negativeVariances = varianceItems.filter(item => (item.variance_quantity || 0) < 0).length;

    return {
      stock_take: stockTake,
      total_items: totalItems,
      items_with_variance: itemsWithVariance,
      total_variance_value: totalVarianceValue,
      positive_variances: positiveVariances,
      negative_variances: negativeVariances,
      variance_items: varianceItems
    };
  }

  /**
   * Get stock taking statistics
   */
  static async getStockTakeStats(): Promise<StockTakeStats> {
    const [totalStockTakes, activeStockTakes, completedThisMonth, pendingAdjustments, varianceThisMonth] = await Promise.all([
      // Total stock takes
      supabase.from('stock_takes').select('id', { count: 'exact', head: true }),
      
      // Active stock takes
      supabase.from('stock_takes').select('id', { count: 'exact', head: true }).in('status', ['draft', 'in_progress']),
      
      // Completed this month
      supabase.from('stock_takes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      
      // Pending adjustments
      supabase.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      
      // Total variance this month
      supabase.from('stock_takes')
        .select('total_variance_value')
        .eq('status', 'completed')
        .gte('completed_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    const totalVarianceThisMonth = varianceThisMonth.data?.reduce((sum, st) => sum + (st.total_variance_value || 0), 0) || 0;

    return {
      total_stock_takes: totalStockTakes.count || 0,
      active_stock_takes: activeStockTakes.count || 0,
      completed_this_month: completedThisMonth.count || 0,
      pending_adjustments: pendingAdjustments.count || 0,
      total_variance_this_month: totalVarianceThisMonth
    };
  }

  // =================== STOCK MOVEMENTS ===================
  
  /**
   * Record a stock movement
   */
  static async recordStockMovement(movement: Omit<StockMovement, 'id' | 'created_at'>): Promise<StockMovement> {
    const { data, error } = await supabase
      .from('stock_movements')
      .insert([movement])
      .select()
      .single();

    if (error) throw new Error(`Failed to record stock movement: ${error.message}`);
    return data;
  }

  /**
   * Get stock movements for an inventory item
   */
  static async getStockMovements(inventoryItemId: string, limit = 50): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('inventory_item_id', inventoryItemId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch stock movements: ${error.message}`);
    return data || [];
  }
} 