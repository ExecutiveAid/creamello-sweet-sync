import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, addDays, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

// Type definition for inventory product (matching Supabase schema)
interface InventoryProduct {
  id?: string;
  name: string;
  category: string;
  available_quantity: number;
  unit: string;
  price_per_unit: number;
  expiration_date?: string;
  date_created: string;
}

const Inventory = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<InventoryProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    available_quantity: 0,
    unit: '',
    price_per_unit: 0,
    expiration_date: '',
    date_created: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('inventory')
          .select('*')
          .order('name', { ascending: true });
        if (fetchError) throw fetchError;
        setProducts(data || []);
        setFilteredProducts(data || []);
        // Low stock and expiry notifications
        (data || []).forEach(product => {
          if (product.available_quantity <= 6) {
            toast({
              title: 'Low Stock Alert',
              description: `${product.name} is low in stock (${product.available_quantity} left).`,
              variant: 'destructive',
            });
          }
          if (product.expiration_date) {
            const daysToExpiry = differenceInDays(parseISO(product.expiration_date), new Date());
            if (daysToExpiry >= 0 && daysToExpiry <= 7) {
              toast({
                title: 'Expiry Alert',
                description: `${product.name} expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}!`,
                variant: 'default',
              });
            }
          }
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  // Filtering
  useEffect(() => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (startDate) {
      filtered = filtered.filter(product => product.date_created >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(product => product.date_created <= endDate);
    }
    setFilteredProducts(filtered);
  }, [searchQuery, products, startDate, endDate]);

  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case 'gelato':
        return <Badge className="bg-creamello-purple text-white">Gelato</Badge>;
      case 'sorbet':
        return <Badge className="bg-creamello-blue text-foreground">Sorbet</Badge>;
      case 'specialty':
        return <Badge className="bg-creamello-pink text-foreground">Specialty</Badge>;
      default:
        return <Badge>{category}</Badge>;
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      setProducts(data || []);
      setFilteredProducts(data || []);
      toast({ title: 'Inventory Refreshed', description: 'Inventory data has been refreshed.' });
    } catch (err: any) {
      setError(err.message || 'Failed to refresh inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Inventory Item
          </Button>
          <Button>View Stock Alerts</Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <div className="flex gap-2 items-center mb-2">
        <label>From:</label>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{maxWidth: 160}} />
        <label>To:</label>
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{maxWidth: 160}} />
        <Button
          variant="outline"
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
          disabled={!startDate && !endDate}
        >Clear</Button>
      </div>
      
      <DataTable
        data={loading ? [] : filteredProducts}
        columns={[
          {
            header: "Product",
            accessorKey: "name",
          },
          {
            header: "Category",
            cell: (row: InventoryProduct) => getCategoryBadge(row.category),
            accessorKey: "category"
          },
          {
            header: "Available",
            cell: (row: InventoryProduct) => (
              <div className={row.available_quantity < 6 ? "text-amber-500 font-medium" : ""}>
                {row.available_quantity} {row.unit}
                {row.available_quantity < 6 && (
                  <AlertTriangle className="inline ml-2 h-4 w-4" />
                )}
              </div>
            ),
            accessorKey: "available_quantity"
          },
          {
            header: "Price",
            cell: (row: InventoryProduct) => (
              <div>GHS{Number(row.price_per_unit).toFixed(2)}</div>
            ),
            accessorKey: "price_per_unit"
          },
          {
            header: "Created",
            accessorKey: "date_created",
            cell: (row: InventoryProduct) => row.date_created ? format(parseISO(row.date_created), 'MMM dd, yyyy') : ''
          },
          {
            header: "Expires",
            accessorKey: "expiration_date",
            cell: (row: InventoryProduct) => {
              if (!row.expiration_date) return '';
              const expiryDate = parseISO(row.expiration_date);
              const isExpiringSoon = isAfter(expiryDate, new Date()) && 
                isAfter(addDays(new Date(), 5), expiryDate);
              return (
                <div className={isExpiringSoon ? "text-amber-500 font-medium" : ""}>
                  {format(expiryDate, 'MMM dd, yyyy')}
                  {isExpiringSoon && (
                    <AlertTriangle className="inline ml-2 h-4 w-4" />
                  )}
                </div>
              );
            }
          },
        ]}
        title="Product Inventory"
        searchable={true}
        onSearch={setSearchQuery}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new item to the inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name *</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Category *</Label>
              <Input
                id="category"
                value={newItem.category}
                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="available_quantity" className="text-right">Available *</Label>
              <Input
                id="available_quantity"
                type="number"
                value={Number.isNaN(newItem.available_quantity) || newItem.available_quantity === undefined ? '' : newItem.available_quantity}
                onChange={e => setNewItem({ ...newItem, available_quantity: parseInt(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">Unit *</Label>
              <Input
                id="unit"
                value={newItem.unit}
                onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price_per_unit" className="text-right">Price *</Label>
              <Input
                id="price_per_unit"
                type="number"
                value={Number.isNaN(newItem.price_per_unit) || newItem.price_per_unit === undefined ? '' : newItem.price_per_unit}
                onChange={e => setNewItem({ ...newItem, price_per_unit: parseFloat(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiration_date" className="text-right">Expiration Date *</Label>
              <Input
                id="expiration_date"
                type="date"
                value={newItem.expiration_date}
                onChange={e => setNewItem({ ...newItem, expiration_date: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                // Validate required fields
                if (!newItem.name || !newItem.category || !newItem.unit || !newItem.price_per_unit || !newItem.expiration_date) {
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
                    .from('inventory')
                    .insert([{ ...newItem, date_created: format(new Date(), 'yyyy-MM-dd') }]);
                  if (error) throw error;
                  toast({
                    title: "Inventory Item Added",
                    description: `${newItem.name} has been added to inventory.`
                  });
                  setDialogOpen(false);
                  // Refresh the list
                  const { data, error: fetchError } = await supabase
                    .from('inventory')
                    .select('*')
                    .order('name', { ascending: true });
                  if (fetchError) throw fetchError;
                  setProducts(data || []);
                  setFilteredProducts(data || []);
                  // Reset form
                  setNewItem({
                    name: '',
                    category: '',
                    available_quantity: 0,
                    unit: '',
                    price_per_unit: 0,
                    expiration_date: '',
                    date_created: format(new Date(), 'yyyy-MM-dd'),
                  });
                } catch (err: any) {
                  toast({
                    title: "Error",
                    description: err.message || "Failed to add inventory item.",
                    variant: "destructive"
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
