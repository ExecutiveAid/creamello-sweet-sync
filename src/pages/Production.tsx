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
import { Plus, RefreshCw, AlertTriangle } from 'lucide-react';
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
}

// Interface to track which batches have already triggered low inventory warnings
interface LowInventoryAlerts {
  [batchId: string]: boolean;
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

  useEffect(() => {
    fetchBatches();

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
            cell: (row: ProductionBatch) => (
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
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            ),
          },
          {
            header: "Notes",
            accessorKey: "notes",
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
              <Input
                id="product_name"
                value={newBatch.product_name}
                onChange={(e) => setNewBatch({ ...newBatch, product_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category *
              </Label>
              <Input
                id="category"
                value={newBatch.category}
                onChange={(e) => {
                  const cat = e.target.value;
                  setNewBatch({ ...newBatch, category: cat, unit: getSuggestedUnit(cat) });
                }}
                className="col-span-3"
              />
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
              <Input
                id="unit"
                value={newBatch.unit}
                onChange={(e) => setNewBatch({ ...newBatch, unit: e.target.value })}
                className="col-span-3"
                placeholder={getSuggestedUnit(newBatch.category)}
              />
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
                  <SelectItem value="in-progress">In Progress</SelectItem>
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
    </div>
  );
};

export default Production;
