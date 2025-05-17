import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, AlertTriangle, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// Type definition for production batch (matching Supabase schema)
interface ProductionBatch {
  id?: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'completed' | 'in-progress' | 'planned';
  production_date: string;
  notes?: string;
  available_quantity?: number;
  last_replenished_at?: string;
}

// Interface to track which batches have already triggered low inventory warnings
interface LowInventoryAlerts {
  [batchId: string]: boolean;
}

// Interface for replenishment data
interface ReplenishmentData {
  batchId: string;
  productName: string;
  quantity: number;
  unit: string;
}

const LOW_INVENTORY_THRESHOLD = 0.3; // 30% threshold

const Production = () => {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<ProductionBatch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  // Add state for categories
  const [categories, setCategories] = useState<string[]>([]);
  // Add state for product names
  const [productNames, setProductNames] = useState<{name: string; category: string}[]>([]);
  
  // Replenishment state
  const [replenishDialogOpen, setReplenishDialogOpen] = useState(false);
  const [replenishmentData, setReplenishmentData] = useState<ReplenishmentData>({
    batchId: '',
    productName: '',
    quantity: 0,
    unit: ''
  });
  
  // For dialog (UI only, not DB insert yet)
  const [newBatch, setNewBatch] = useState({
    product_name: '',
    category: '',
    quantity: 0,
    unit: '',
    status: 'planned',
    production_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  
  // Use a ref to track which batches have already triggered low inventory warnings
  // This prevents duplicate warnings on every refresh/rerender
  const lowInventoryAlertsRef = useRef<LowInventoryAlerts>({});

  // Check for low inventory and show warnings
  const checkLowInventory = (batchData: ProductionBatch[]) => {
    batchData.forEach(batch => {
      // Only check completed batches
      if (batch.status !== 'completed') return;
      
      // Check if available quantity exists and is below threshold
      if (
        batch.id && 
        batch.available_quantity !== undefined && 
        batch.quantity > 0 && 
        batch.available_quantity < batch.quantity * LOW_INVENTORY_THRESHOLD
      ) {
        // Only show warning if we haven't shown it before for this batch at this level
        if (!lowInventoryAlertsRef.current[batch.id]) {
          // Format the units appropriately
          let unit = batch.unit;
          if (batch.category.toLowerCase().includes('flavor') || batch.category.toLowerCase().includes('gelato')) {
            unit = 'kg';
          } else if (batch.category.toLowerCase().includes('milkshake') || batch.category.toLowerCase().includes('juice')) {
            unit = 'L';
          } else if (batch.category.toLowerCase().includes('cone')) {
            unit = 'pcs';
          }
          
          // Mark this batch as having received a warning
          lowInventoryAlertsRef.current[batch.id] = true;
          
          // Show the toast warning
          toast({
            title: "Low Inventory Alert",
            description: `${batch.product_name} is running low! Only ${batch.available_quantity} ${unit} remaining (${Math.round(batch.available_quantity / batch.quantity * 100)}% left)`,
            variant: "destructive",
            duration: 5000,
          });
        }
      }
      // Reset the alert if inventory has been replenished (e.g., through a new batch)
      else if (
        batch.id && 
        batch.available_quantity !== undefined && 
        batch.quantity > 0 && 
        batch.available_quantity >= batch.quantity * LOW_INVENTORY_THRESHOLD && 
        lowInventoryAlertsRef.current[batch.id]
      ) {
        // Remove the warning flag so it can trigger again if it drops below threshold
        delete lowInventoryAlertsRef.current[batch.id];
      }
    });
  };

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('production_batches')
        .select('*')
        .order('production_date', { ascending: false });
      if (fetchError) throw fetchError;
      console.log('Fetched production batches:', data);
      setBatches(data || []);
      setFilteredBatches(data || []);
      
      // Check for low inventory after fetching data
      checkLowInventory(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load production batches');
    } finally {
      setLoading(false);
    }
  };

  // Add a function to fetch categories
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('category')
        .order('category');
      
      if (error) throw error;
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data.map(item => item.category))];
      setCategories(uniqueCategories);
    } catch (err: any) {
      console.error('Error fetching categories:', err.message);
      // Don't show error to user, just log it
    }
  };

  // Add a function to fetch product names
  const fetchProductNames = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('name, category')
        .order('name');
      
      if (error) throw error;
      
      setProductNames(data || []);
    } catch (err: any) {
      console.error('Error fetching product names:', err.message);
      // Don't show error to user, just log it
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchCategories();
    fetchProductNames();

    // Set up real-time subscription to production_batches table
    const subscription = supabase
      .channel('production_batches_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'production_batches' }, 
        (payload) => {
          console.log('Production batch change detected:', payload);
          
          // If a single batch was updated and it's below threshold, show a warning immediately
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.quantity && payload.new.available_quantity) {
            const batch = payload.new as ProductionBatch;
            if (
              batch.status === 'completed' && 
              batch.available_quantity < batch.quantity * LOW_INVENTORY_THRESHOLD &&
              batch.id && 
              !lowInventoryAlertsRef.current[batch.id]
            ) {
              // Format the units appropriately
              let unit = batch.unit;
              if (batch.category?.toLowerCase().includes('flavor') || batch.category?.toLowerCase().includes('gelato')) {
                unit = 'kg';
              } else if (batch.category?.toLowerCase().includes('milkshake') || batch.category?.toLowerCase().includes('juice')) {
                unit = 'L';
              } else if (batch.category?.toLowerCase().includes('cone')) {
                unit = 'pcs';
              }
              
              // Mark this batch as having received a warning
              lowInventoryAlertsRef.current[batch.id] = true;
              
              // Show the toast warning immediately
              toast({
                title: "Low Inventory Alert",
                description: `${batch.product_name} is running low! Only ${batch.available_quantity} ${unit} remaining (${Math.round(batch.available_quantity / batch.quantity * 100)}% left)`,
                variant: "destructive",
                duration: 5000,
              });
            }
          }
          
          // Refresh all batches when any change occurs
          fetchBatches();
        }
      )
      .subscribe();

    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Handle search and low stock filter
  useEffect(() => {
    let filtered = batches;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(batch =>
        batch.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply low stock filter if enabled
    if (showLowStockOnly) {
      filtered = filtered.filter(batch => 
        batch.status === 'completed' && 
        batch.available_quantity !== undefined && 
        batch.quantity > 0 && 
        batch.available_quantity < batch.quantity * LOW_INVENTORY_THRESHOLD
      );
    }
    
    setFilteredBatches(filtered);
  }, [searchQuery, batches, showLowStockOnly]);

  const handleRefresh = async () => {
    fetchBatches();
    toast({ title: 'Production Refreshed', description: 'Production data has been refreshed.' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'planned':
        return <Badge className="bg-amber-500">Planned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Helper to suggest unit based on category
  const getSuggestedUnit = (category: string) => {
    if (category.toLowerCase().includes('flavor') || category.toLowerCase().includes('gelato')) return 'kg';
    if (category.toLowerCase().includes('milkshake') || category.toLowerCase().includes('juice')) return 'L';
    if (category.toLowerCase().includes('cone')) return 'pcs';
    return '';
  };

  const handleReplenish = (batch: ProductionBatch) => {
    // Prepare replenishment data
    setReplenishmentData({
      batchId: batch.id || '',
      productName: batch.product_name,
      quantity: 0, // Default to 0, will be set by user
      unit: batch.unit
    });
    
    // Open replenishment dialog
    setReplenishDialogOpen(true);
  };

  const submitReplenishment = async () => {
    if (replenishmentData.quantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a positive quantity to replenish.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get the current batch
      const { data: batchData, error: fetchError } = await supabase
        .from('production_batches')
        .select('*')
        .eq('id', replenishmentData.batchId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Calculate new available quantity
      const currentAvailable = batchData.available_quantity || 0;
      const newAvailable = currentAvailable + replenishmentData.quantity;
      const now = new Date().toISOString();

      // Update the batch's available quantity and last_replenished_at timestamp
      const { error: updateError } = await supabase
        .from('production_batches')
        .update({ 
          available_quantity: newAvailable,
          last_replenished_at: now
        })
        .eq('id', replenishmentData.batchId);
        
      if (updateError) throw updateError;

      // Success! Close dialog and refresh
      toast({
        title: "Stock Replenished",
        description: `Added ${replenishmentData.quantity} ${replenishmentData.unit} to ${replenishmentData.productName}.`
      });
      
      setReplenishDialogOpen(false);
      fetchBatches(); // Refresh data
      
      // Clear low stock alert for this batch
      if (batchData.id) {
        delete lowInventoryAlertsRef.current[batchData.id];
      }
      
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to replenish stock.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Production</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Production Batch
          </Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      
      {/* Filter Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="lowStockFilter"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-creamello-purple focus:ring-creamello-purple mr-2"
          />
          <label htmlFor="lowStockFilter" className="text-sm font-medium flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
            Show Low Stock Only
          </label>
        </div>
        
        {showLowStockOnly && filteredBatches.length === 0 && (
          <p className="text-sm text-muted-foreground">No low stock items found</p>
        )}
        
        {showLowStockOnly && (
          <Badge className="bg-red-500">
            {filteredBatches.length} Low Stock {filteredBatches.length === 1 ? 'Item' : 'Items'}
          </Badge>
        )}
      </div>
      
      {/* Low Inventory Alert Section */}
      {batches.filter(b => 
        b.status === 'completed' && 
        b.available_quantity !== undefined && 
        b.quantity > 0 && 
        b.available_quantity < b.quantity * LOW_INVENTORY_THRESHOLD
      ).length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
            <h3 className="text-lg font-bold text-red-700">Low Inventory Alert</h3>
          </div>
          <div className="mt-2">
            <p className="text-red-700 mb-2">The following products are running low and need to be replenished:</p>
            <ul className="list-disc pl-6 space-y-1">
              {batches.filter(b => 
                b.status === 'completed' && 
                b.available_quantity !== undefined && 
                b.quantity > 0 && 
                b.available_quantity < b.quantity * LOW_INVENTORY_THRESHOLD
              ).map(batch => {
                let unit = batch.unit;
                if (batch.category.toLowerCase().includes('flavor') || batch.category.toLowerCase().includes('gelato')) {
                  unit = 'kg';
                } else if (batch.category.toLowerCase().includes('milkshake') || batch.category.toLowerCase().includes('juice')) {
                  unit = 'L';
                } else if (batch.category.toLowerCase().includes('cone')) {
                  unit = 'pcs';
                }
                
                const percentRemaining = Math.round((batch.available_quantity || 0) / batch.quantity * 100);
                
                return (
                  <li key={batch.id} className="text-red-700">
                    <span className="font-semibold">{batch.product_name}</span>: Only {batch.available_quantity?.toFixed(2)} {unit} remaining ({percentRemaining}%)
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      
      <DataTable
        data={loading ? [] : filteredBatches}
        columns={[
          {
            header: "Product",
            accessorKey: "product_name",
          },
          {
            header: "Category",
            accessorKey: "category",
          },
          {
            header: "Date",
            accessorKey: "production_date",
            cell: (row: ProductionBatch) => row.production_date ? format(parseISO(row.production_date), 'MMM dd, yyyy') : ''
          },
          {
            header: "Quantity",
            cell: (row: ProductionBatch) => {
              let unit = row.unit;
              let note = '';
              if (row.category.toLowerCase().includes('flavor') || row.category.toLowerCase().includes('gelato')) {
                unit = 'kg';
                note = ' (deducted in grams)';
              } else if (row.category.toLowerCase().includes('milkshake') || row.category.toLowerCase().includes('juice')) {
                unit = 'L';
                note = ' (deducted in ml)';
              } else if (row.category.toLowerCase().includes('cone')) {
                unit = 'pcs';
              }
              
              // Calculate percentage remaining
              const availableQty = row.available_quantity !== undefined ? row.available_quantity : row.quantity;
              const percentRemaining = row.quantity > 0 ? (availableQty / row.quantity) * 100 : 100;
              const isLow = percentRemaining < LOW_INVENTORY_THRESHOLD * 100;
              const isWarning = percentRemaining < 50 && !isLow;
              
              return (
                <div className="flex flex-col space-y-2">
                  <div>Total: {row.quantity} {unit}{note}</div>
                  <div className={isLow ? "text-red-500 font-bold" : isWarning ? "text-amber-500" : ""}>
                    Available: {availableQty.toFixed(2)} {unit}
                    {isLow && <AlertTriangle className="inline-block ml-2 h-4 w-4 text-red-500" />}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        isLow ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentRemaining, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">{Math.round(percentRemaining)}% remaining</div>
                  
                  {/* Last replenished date if available */}
                  {row.last_replenished_at && (
                    <div className="text-xs text-gray-600">
                      Last replenished: {format(parseISO(row.last_replenished_at), 'MMM dd, yyyy')}
                    </div>
                  )}
                  
                  {/* Add replenish button for low stock completed batches */}
                  {isLow && row.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleReplenish(row)}
                      className="mt-2 text-xs"
                    >
                      <RefreshCcw className="h-3 w-3 mr-1" /> Replenish
                    </Button>
                  )}
                </div>
              );
            },
            accessorKey: "quantity"
          },
          {
            header: "Status",
            cell: (row: ProductionBatch) => getStatusBadge(row.status),
            accessorKey: "status"
          },
          {
            header: "Actions",
            cell: (row: ProductionBatch) => {
              // If the batch is already completed, don't allow status changes
              if (row.status === 'completed') {
                return (
                  <div className="text-sm text-muted-foreground">
                    Completed (no changes allowed)
                  </div>
                );
              }
              
              // For planned or in-progress batches, allow status changes
              return (
                <Select
                  value={row.status}
                  onValueChange={async (value) => {
                    const { error } = await supabase
                      .from('production_batches')
                      .update({ status: value })
                      .eq('id', row.id);
                    if (!error) {
                      setBatches((prev) => prev.map(b => b.id === row.id ? { ...b, status: value as ProductionBatch['status'] } : b));
                      setFilteredBatches((prev) => prev.map(b => b.id === row.id ? { ...b, status: value as ProductionBatch['status'] } : b));
                      toast({ title: 'Status Updated', description: `Batch status changed to ${value}` });
                    } else {
                      toast({ title: 'Error', description: error.message, variant: 'destructive' });
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              );
            },
          },
        ]}
        title="Production Batches"
        searchable={true}
        onSearch={setSearchQuery}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Production Batch</DialogTitle>
            <DialogDescription>
              Schedule a new production batch for gelato, milkshake, juice, or cones.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product_name" className="text-right">
                Product Name *
              </Label>
              <Select
                value={newBatch.product_name}
                onValueChange={(name) => {
                  // Find the selected product to get its category
                  const selectedProduct = productNames.find(p => p.name === name);
                  if (selectedProduct) {
                    const category = selectedProduct.category;
                    setNewBatch({
                      ...newBatch,
                      product_name: name,
                      category: category,
                      unit: getSuggestedUnit(category)
                    });
                  } else {
                    setNewBatch({ ...newBatch, product_name: name });
                  }
                }}
              >
                <SelectTrigger id="product_name" className="col-span-3">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {productNames.map((product) => (
                    <SelectItem key={product.name} value={product.name}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category *
              </Label>
              <Select
                value={newBatch.category}
                onValueChange={(category) => {
                  setNewBatch({ 
                    ...newBatch, 
                    category, 
                    unit: getSuggestedUnit(category)
                  });
                }}
              >
                <SelectTrigger id="category" className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="production_date" className="text-right">
                Date *
              </Label>
              <Input
                id="production_date"
                type="date"
                value={newBatch.production_date}
                onChange={(e) => setNewBatch({ ...newBatch, production_date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                value={newBatch.quantity}
                onChange={(e) => setNewBatch({ ...newBatch, quantity: parseFloat(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unit *
              </Label>
              <Select
                value={newBatch.unit}
                onValueChange={(unit) => setNewBatch({ ...newBatch, unit })}
              >
                <SelectTrigger id="unit" className="col-span-3">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="L">Liters (L)</SelectItem>
                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  <SelectItem value="g">Grams (g)</SelectItem>
                  <SelectItem value="ml">Milliliters (ml)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={newBatch.status}
                onValueChange={(value) => setNewBatch({ ...newBatch, status: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={newBatch.notes}
                onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                // Validate required fields
                if (
                  !newBatch.product_name ||
                  !newBatch.category ||
                  !newBatch.production_date ||
                  !newBatch.quantity ||
                  !newBatch.unit
                ) {
                  toast({
                    title: "Missing Fields",
                    description: "Please fill in all required fields.",
                    variant: "destructive"
                  });
                  return;
                }
                setLoading(true);
                try {
                  const { error } = await supabase
                    .from('production_batches')
                    .insert([{
                      ...newBatch,
                      available_quantity: newBatch.quantity // Set available_quantity equal to quantity initially
                    }]);
                  if (error) throw error;
                  toast({
                    title: "Production Batch Added",
                    description: `${newBatch.product_name} batch has been added to production schedule.`
                  });
                  setDialogOpen(false);
                  // Refresh the list using our common fetchBatches function
                  fetchBatches();
                  // Reset form
                  setNewBatch({
                    product_name: '',
                    category: '',
                    quantity: 0,
                    unit: '',
                    status: 'planned',
                    production_date: format(new Date(), 'yyyy-MM-dd'),
                    notes: '',
                  });
                } catch (err: any) {
                  toast({
                    title: "Error",
                    description: err.message || "Failed to add production batch.",
                    variant: "destructive"
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Add Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Replenishment Dialog */}
      <Dialog open={replenishDialogOpen} onOpenChange={setReplenishDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Replenish Stock</DialogTitle>
            <DialogDescription>
              Add more stock to {replenishmentData.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replenish_quantity" className="text-right">
                Quantity *
              </Label>
              <Input
                id="replenish_quantity"
                type="number"
                value={replenishmentData.quantity || ''}
                onChange={(e) => setReplenishmentData({
                  ...replenishmentData,
                  quantity: parseFloat(e.target.value) || 0
                })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replenish_unit" className="text-right">
                Unit
              </Label>
              <Input
                id="replenish_unit"
                value={replenishmentData.unit}
                disabled
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplenishDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={submitReplenishment}
              disabled={loading || replenishmentData.quantity <= 0}
            >
              Replenish Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Production;
