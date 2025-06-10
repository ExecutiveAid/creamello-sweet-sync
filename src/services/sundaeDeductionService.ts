import { supabase } from '@/integrations/supabase/client';
import { getSundaeRecipe, isSundae, SundaeIngredient } from '@/config/sundaeRecipes';
import InventoryMovementService from '@/services/inventoryMovementService';

export interface SundaeDeductionResult {
  success: boolean;
  deductedIngredients: string[];
  missingIngredients: string[];
  errors: string[];
}

export class SundaeDeductionService {
  /**
   * Deduct ingredients for a sundae order
   */
  static async deductSundaeIngredients(
    sundaeName: string,
    quantity: number,
    orderId: string,
    staffId: string
  ): Promise<SundaeDeductionResult> {
    const result: SundaeDeductionResult = {
      success: true,
      deductedIngredients: [],
      missingIngredients: [],
      errors: []
    };

    // Check if this is actually a sundae
    if (!isSundae(sundaeName)) {
      result.success = false;
      result.errors.push(`${sundaeName} is not recognized as a sundae item`);
      return result;
    }

    // Get the recipe for this sundae
    const recipe = getSundaeRecipe(sundaeName);
    if (!recipe) {
      result.success = false;
      result.errors.push(`No recipe found for ${sundaeName}`);
      return result;
    }

    console.log(`🍨 Processing sundae deduction for ${quantity}x ${sundaeName}`);
    console.log(`📋 Recipe requires ${recipe.ingredients.length} different ingredients`);

    // Process each ingredient in the recipe
    for (const ingredient of recipe.ingredients) {
      const totalQuantityNeeded = ingredient.quantity * quantity;
      
      try {
        // Find the inventory item for this ingredient
        const inventoryItem = await this.findInventoryItem(ingredient);
        
        if (!inventoryItem) {
          result.missingIngredients.push(`${ingredient.name} (${totalQuantityNeeded}${ingredient.unit})`);
          console.warn(`❌ No inventory item found for ${ingredient.name}`);
          continue;
        }

        // Convert units if necessary
        const convertedQuantity = this.convertUnits(
          totalQuantityNeeded,
          ingredient.unit,
          inventoryItem.unit
        );

        // Check if enough inventory is available
        if (inventoryItem.available_quantity < convertedQuantity) {
          result.missingIngredients.push(
            `${ingredient.name} (need: ${convertedQuantity}${inventoryItem.unit}, available: ${inventoryItem.available_quantity}${inventoryItem.unit})`
          );
          console.warn(`❌ Insufficient inventory for ${ingredient.name}`);
          continue;
        }

        // Deduct from inventory
        const deductionResult = await InventoryMovementService.consumeStock({
          inventory_id: inventoryItem.id,
          quantity: convertedQuantity,
          movement_type: 'SALE',
          reference_type: 'SALE',
          reference_id: orderId,
          notes: `Sundae ingredient: ${totalQuantityNeeded}${ingredient.unit} ${ingredient.name} for ${quantity}x ${sundaeName}`,
          created_by: staffId
        });

        if (deductionResult.success) {
          result.deductedIngredients.push(
            `${convertedQuantity}${inventoryItem.unit} ${ingredient.name}`
          );
          console.log(`✅ Deducted ${convertedQuantity}${inventoryItem.unit} ${ingredient.name}`);
        } else {
          result.errors.push(`Failed to deduct ${ingredient.name}: ${deductionResult.error}`);
          console.error(`❌ Failed to deduct ${ingredient.name}:`, deductionResult.error);
        }

      } catch (error: any) {
        result.errors.push(`Error processing ${ingredient.name}: ${error.message}`);
        console.error(`❌ Error processing ${ingredient.name}:`, error);
      }
    }

    // Determine overall success
    if (result.errors.length > 0 || result.missingIngredients.length > 0) {
      result.success = false;
    }

    console.log(`🍨 Sundae deduction completed for ${sundaeName}:`);
    console.log(`   ✅ Deducted: ${result.deductedIngredients.length} ingredients`);
    console.log(`   ❌ Missing: ${result.missingIngredients.length} ingredients`);
    console.log(`   ⚠️ Errors: ${result.errors.length} errors`);

    return result;
  }

  /**
   * Find inventory item matching the ingredient specification
   */
  private static async findInventoryItem(ingredient: SundaeIngredient) {
    // Try exact name match first
    let { data: item } = await supabase
      .from('inventory')
      .select('id, name, category, available_quantity, unit, cost_per_unit')
      .eq('name', ingredient.name)
      .eq('is_active', true)
      .single();

    if (item) return item;

    // Try name match with category filter
    if (ingredient.category) {
      const { data: items } = await supabase
        .from('inventory')
        .select('id, name, category, available_quantity, unit, cost_per_unit')
        .eq('category', ingredient.category)
        .eq('is_active', true);

      if (items) {
        // Look for partial name matches within the category
        item = items.find(i => 
          i.name.toLowerCase().includes(ingredient.name.toLowerCase()) ||
          ingredient.name.toLowerCase().includes(i.name.toLowerCase())
        );
        
        if (item) return item;
      }
    }

    // Try fuzzy name matching across all inventory
    const { data: allItems } = await supabase
      .from('inventory')
      .select('id, name, category, available_quantity, unit, cost_per_unit')
      .eq('is_active', true);

    if (allItems) {
      // Look for partial matches
      item = allItems.find(i => 
        i.name.toLowerCase().includes(ingredient.name.toLowerCase()) ||
        ingredient.name.toLowerCase().includes(i.name.toLowerCase())
      );
    }

    return item || null;
  }

  /**
   * Convert units if needed (basic conversions)
   */
  private static convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return quantity;

    // Weight conversions
    if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000;
    if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000;

    // Volume conversions
    if (fromUnit === 'ml' && toUnit === 'L') return quantity / 1000;
    if (fromUnit === 'L' && toUnit === 'ml') return quantity * 1000;

    // Count conversions (assume same if both are count units)
    const countUnits = ['pcs', 'pieces', 'count', 'units'];
    if (countUnits.includes(fromUnit.toLowerCase()) && countUnits.includes(toUnit.toLowerCase())) {
      return quantity;
    }

    // If no conversion available, return original quantity and log warning
    console.warn(`⚠️ No conversion available from ${fromUnit} to ${toUnit}, using original quantity`);
    return quantity;
  }

  /**
   * Check ingredient availability for a sundae before ordering
   */
  static async checkSundaeAvailability(sundaeName: string, quantity: number = 1) {
    if (!isSundae(sundaeName)) return { available: false, reason: 'Not a sundae item' };

    const recipe = getSundaeRecipe(sundaeName);
    if (!recipe) return { available: false, reason: 'No recipe found' };

    const missingIngredients: string[] = [];

    for (const ingredient of recipe.ingredients) {
      const totalNeeded = ingredient.quantity * quantity;
      const inventoryItem = await this.findInventoryItem(ingredient);
      
      if (!inventoryItem) {
        missingIngredients.push(`${ingredient.name} (not in inventory)`);
        continue;
      }

      const convertedQuantity = this.convertUnits(totalNeeded, ingredient.unit, inventoryItem.unit);
      
      if (inventoryItem.available_quantity < convertedQuantity) {
        missingIngredients.push(
          `${ingredient.name} (need: ${convertedQuantity}${inventoryItem.unit}, have: ${inventoryItem.available_quantity}${inventoryItem.unit})`
        );
      }
    }

    return {
      available: missingIngredients.length === 0,
      reason: missingIngredients.length > 0 ? `Missing: ${missingIngredients.join(', ')}` : 'Available'
    };
  }
} 