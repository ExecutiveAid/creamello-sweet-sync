import { useState, useEffect } from 'react';
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
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
}

const Production = () => {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<ProductionBatch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('production_batches')
          .select('*')
          .order('production_date', { ascending: false });
        if (fetchError) throw fetchError;
        setBatches(data || []);
        setFilteredBatches(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load production batches');
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, []);

  // Handle search
  useEffect(() => {
    let filtered = batches;
    if (searchQuery) {
      filtered = filtered.filter(batch =>
        batch.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredBatches(filtered);
  }, [searchQuery, batches]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('production_batches')
        .select('*')
        .order('production_date', { ascending: false });
      if (fetchError) throw fetchError;
      setBatches(data || []);
      setFilteredBatches(data || []);
      toast({ title: 'Production Refreshed', description: 'Production data has been refreshed.' });
    } catch (err: any) {
      setError(err.message || 'Failed to refresh production batches');
    } finally {
      setLoading(false);
    }
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
            cell: (row: ProductionBatch) => <div>{row.quantity} {row.unit}</div>,
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
              Schedule a new production batch for gelato making.
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
                onChange={(e) => setNewBatch({ ...newBatch, category: e.target.value })}
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
                    .insert([newBatch]);
                  if (error) throw error;
                  toast({
                    title: "Production Batch Added",
                    description: `${newBatch.product_name} batch has been added to production schedule.`
                  });
                  setDialogOpen(false);
                  // Refresh the list
                  const { data, error: fetchError } = await supabase
                    .from('production_batches')
                    .select('*')
                    .order('production_date', { ascending: false });
                  if (fetchError) throw fetchError;
                  setBatches(data || []);
                  setFilteredBatches(data || []);
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
