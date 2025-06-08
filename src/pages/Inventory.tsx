import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { AlertTriangle, RefreshCw, Plus, Package2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StockTaking from '@/components/inventory/StockTaking';
import InventoryMovementService from '@/services/inventoryMovementService';

// Type definition for inventory product (matching Supabase schema)
interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  available_quantity: number; // Current stock available for use
  total_quantity: number; // Total quantity ever received/stocked
  unit: string;
  price_per_unit: number;
  cost_per_unit: number;
  minimum_stock_level: number;
  maximum_stock_level?: number;
  reorder_point?: number;
  supplier?: string;
  barcode?: string;
  batch_number?: string;
  location: string;
  is_active: boolean;
  expiration_date?: string;
  date_created: string;
  created_at: string;
  updated_at: string;
}

// Type definition for inventory movements
interface InventoryMovement {
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

// Production inventory categories (matching the new system)
const INVENTORY_CATEGORIES = [
  'Gelato',
  'Juices', 
  'Milkshakes',
  'Pancakes',
  'Waffles',
  'Sundaes',
  'Cones',
  'Toppings',
  'Dairy',
  'Ingredients',
  'Packaging',
  'Supplies',
  'Other'
];

// Standardized units (matching database enum)
const INVENTORY_UNITS = [
  'kg',
  'g',
  'L',
  'ml',
  'pieces',
  'pcs',
  'boxes',
  'packs',
  'bottles',
  'bags',
  'containers',
  'rolls',
  'sheets'
];

// Location options
const INVENTORY_LOCATIONS = [
  'main',
  'freezer',
  'storage',
  'display',
  'kitchen',
  'office'
];

const Inventory = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<InventoryProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showStockTaking, setShowStockTaking] = useState(false);
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  
  // Add state for categories and product names from database
  const [categories, setCategories] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<{name: string; category: string}[]>([]);
  const [filteredProductNames, setFilteredProductNames] = useState<{name: string; category: string}[]>([]);
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    available_quantity: 0,
    unit: '',
    price_per_unit: 0,
    cost_per_unit: 0,
    minimum_stock_level: 5,
    maximum_stock_level: 100,
    reorder_point: 10,
    supplier: '',
    barcode: '',
    batch_number: '',
    location: 'main',
    expiration_date: '',
    date_created: format(new Date(), 'yyyy-MM-dd'),
  });

  const [replenishmentDialogOpen, setReplenishmentDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [replenishmentQuantity, setReplenishmentQuantity] = useState(0);
  const [replenishmentUnitCost, setReplenishmentUnitCost] = useState(0);
  const [replenishmentReferenceNumber, setReplenishmentReferenceNumber] = useState('');

  // Filter product names when category changes
  useEffect(() => {
    if (newItem.category) {
      const filtered = productNames.filter(product => product.category === newItem.category);
      setFilteredProductNames(filtered);
    } else {
      setFilteredProductNames([]);
    }
  }, [newItem.category, productNames]);

  // Add functions to fetch categories and product names from database
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
      // Fallback to static categories if database fetch fails
      setCategories(INVENTORY_CATEGORIES);
    }
  };

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
    const fetchInventory = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('inventory')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (fetchError) throw fetchError;
        console.log('Fetched inventory items:', data); // Debug log
        setProducts(data || []);
        setFilteredProducts(data || []);
        // Low stock and expiry notifications
        (data || []).forEach(product => {
          if (product.available_quantity <= product.minimum_stock_level) {
            toast({
              title: 'Low Stock Alert',
              description: `${product.name} is low in stock (${product.available_quantity} left, minimum: ${product.minimum_stock_level}).`,
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
    fetchCategories();
    fetchProductNames();
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
    
    // Apply low stock filter if enabled
    if (showLowStockOnly) {
      filtered = filtered.filter(product => product.available_quantity <= product.minimum_stock_level);
    }
    
    setFilteredProducts(filtered);
  }, [searchQuery, products, startDate, endDate, showLowStockOnly]);

  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case 'gelato':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Gelato</Badge>;
      case 'juices':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Juices</Badge>;
      case 'milkshakes':
        return <Badge className="bg-pink-100 text-pink-800 border-pink-200">Milkshakes</Badge>;
      case 'pancakes':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pancakes</Badge>;
      case 'waffles':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Waffles</Badge>;
      case 'sundaes':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Sundaes</Badge>;
      case 'cones':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Cones</Badge>;
      case 'toppings':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Toppings</Badge>;
      case 'dairy':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Dairy</Badge>;
      case 'ingredients':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Ingredients</Badge>;
      case 'packaging':
        return <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">Packaging</Badge>;
      case 'supplies':
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200">Supplies</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{category}</Badge>;
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      console.log('Refreshed inventory items:', data); // Debug log
      setProducts(data || []);
      setFilteredProducts(data || []);
      toast({ title: 'Inventory Refreshed', description: 'Inventory data has been refreshed.' });
    } catch (err: any) {
      setError(err.message || 'Failed to refresh inventory');
    } finally {
      setLoading(false);
    }
  };

  // Helper to suggest unit based on category
  const getSuggestedUnit = (category: string) => {
    if (category.toLowerCase().includes('flavor') || category.toLowerCase().includes('gelato')) return 'kg';
    if (category.toLowerCase().includes('milkshake') || category.toLowerCase().includes('juice')) return 'L';
    if (category.toLowerCase().includes('cone') || category.toLowerCase().includes('sundae')) return 'pcs';
    if (category.toLowerCase().includes('dairy') || category.toLowerCase().includes('ingredients')) return 'L';
    return '';
  };

  // Show Stock Taking component if selected
  if (showStockTaking) {
    return <StockTaking onClose={() => setShowStockTaking(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setShowStockTaking(true)}>
            <Package2 className="mr-2 h-4 w-4" /> Stock Taking
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Inventory Item
          </Button>
          <Button onClick={() => setReplenishmentDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Replenish Stock
          </Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      
      {/* Filter Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center mr-4">
          <input
            type="checkbox"
            id="lowStockFilter"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-creamello-purple focus:ring-creamello-purple mr-2"
          />
          <label htmlFor="lowStockFilter" className="text-sm font-medium flex items-center">
            <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
            Show Low Stock Only
          </label>
        </div>
        
        <div className="flex gap-2 items-center">
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
        
        {showLowStockOnly && filteredProducts.length === 0 && (
          <p className="text-sm text-muted-foreground">No low stock items found</p>
        )}
        
        {showLowStockOnly && (
          <Badge className="bg-amber-500">
            {filteredProducts.length} Low Stock {filteredProducts.length === 1 ? 'Item' : 'Items'}
          </Badge>
        )}
      </div>
      
      {/* Low Stock Alert Section */}
      {products.filter(p => p.available_quantity <= p.minimum_stock_level).length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-amber-500 mr-3" />
            <h3 className="text-lg font-bold text-amber-700">Low Stock Alert</h3>
          </div>
          <div className="mt-2">
            <p className="text-amber-700 mb-2">The following items are running low and need to be restocked:</p>
            <ul className="list-disc pl-6 space-y-1">
              {products.filter(p => p.available_quantity <= p.minimum_stock_level).map(product => (
                <li key={product.id} className="text-amber-700">
                  <span className="font-semibold">{product.name}</span>: Only {product.available_quantity} {product.unit} remaining (Min: {product.minimum_stock_level} {product.unit})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      <DataTable
        data={loading ? [] : filteredProducts}
        columns={[
          {
            header: "SKU",
            accessorKey: "sku",
            cell: (row: InventoryProduct) => (
              <div className="font-mono text-sm font-medium text-blue-600">
                {row.sku || 'Generating...'}
              </div>
            )
          },
          {
            header: "Name",
            accessorKey: "name",
            cell: (row: InventoryProduct) => (
              <div className="font-medium">{row.name}</div>
            )
          },
          {
            header: "Category",
            cell: (row: InventoryProduct) => getCategoryBadge(row.category),
            accessorKey: "category"
          },
          {
            header: "Quantity",
            cell: (row: InventoryProduct) => {
              const isLowStock = row.available_quantity <= row.minimum_stock_level;
              
              return (
                <div className="text-center space-y-1">
                  <div className="text-sm text-gray-600">
                    Total: {Number(row.total_quantity || 0).toFixed(2)} {row.unit}
                  </div>
                  <div className={isLowStock ? "text-red-600 font-medium" : "text-black font-medium"}>
                    Available: {Number(row.available_quantity).toFixed(2)} {row.unit}
                    {isLowStock && (
                      <AlertTriangle className="inline ml-1 h-3 w-3 text-red-500" />
                    )}
                  </div>
                  {isLowStock && (
                    <div className="text-xs text-red-500">
                      Low Stock (Min: {row.minimum_stock_level} {row.unit})
                    </div>
                  )}
                </div>
              );
            },
            accessorKey: "available_quantity"
          },
          {
            header: "Cost",
            cell: (row: InventoryProduct) => (
              <div className="text-center">
                <div className="font-medium text-black">
                  GHS{Number(row.cost_per_unit || 0).toFixed(2)}
                </div>
              </div>
            ),
            accessorKey: "cost_per_unit"
          },
          {
            header: "Price",
            cell: (row: InventoryProduct) => (
              <div className="text-center">
                <div className="font-medium text-black">
                  GHS{Number(row.price_per_unit).toFixed(2)}
                </div>
                {row.cost_per_unit > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Margin: {((row.price_per_unit - row.cost_per_unit) / row.price_per_unit * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            ),
            accessorKey: "price_per_unit"
          },
          {
            header: "Location",
            cell: (row: InventoryProduct) => (
              <Badge 
                variant="outline" 
                className={`capitalize ${
                  row.location === 'freezer' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  row.location === 'storage' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                  'bg-green-50 text-green-700 border-green-200'
                }`}
              >
                {row.location}
              </Badge>
            ),
            accessorKey: "location"
          },
          {
            header: "Date Created",
            accessorKey: "date_created",
            cell: (row: InventoryProduct) => row.date_created ? 
              format(parseISO(row.date_created), 'MMM dd, yyyy') : 
              format(new Date(), 'MMM dd, yyyy')
          },
          {
            header: "Expiration",
            accessorKey: "expiration_date",
            cell: (row: InventoryProduct) => {
              if (!row.expiration_date) return (
                <div className="text-center">
                  <span className="text-muted-foreground text-sm">No expiry</span>
                </div>
              );
              const expiryDate = parseISO(row.expiration_date);
              const daysToExpiry = differenceInDays(expiryDate, new Date());
              const isExpired = daysToExpiry < 0;
              const isExpiringSoon = daysToExpiry >= 0 && daysToExpiry <= 7;
              
              return (
                <div className={`text-center ${
                  isExpired ? "text-red-600 font-medium" :
                  isExpiringSoon ? "text-amber-600 font-medium" : 
                  "text-black font-medium"
                }`}>
                  {format(expiryDate, 'MMM dd, yyyy')}
                  {(isExpired || isExpiringSoon) && (
                    <AlertTriangle className="inline ml-1 h-3 w-3" />
                  )}
                  {isExpired && (
                    <div className="text-xs text-red-500">Expired</div>
                  )}
                  {isExpiringSoon && !isExpired && (
                    <div className="text-xs text-amber-500">
                      {daysToExpiry === 0 ? 'Today' : `${daysToExpiry} days`}
                    </div>
                  )}
                </div>
              );
            }
          },
        ]}
        title="Product Inventory"
        searchable={true}
        maxHeight="600px"
        onSearch={setSearchQuery}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-creamello-purple">Add New Inventory Item</DialogTitle>
            <DialogDescription>
              Create a new inventory item with complete details for proper stock management.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
              <Select
                value={newItem.category}
                onValueChange={category => {
                  setNewItem({ 
                    ...newItem, 
                    category, 
                    unit: getSuggestedUnit(category) // Auto-suggest unit
                  });
                }}
              >
                    <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                      {INVENTORY_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Product Name *</Label>
                  <Input
                    id="name"
                value={newItem.name}
                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
              </div>
            </div>

            {/* Quantity & Pricing Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Quantity & Pricing</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="available_quantity" className="text-sm font-medium">Available Quantity *</Label>
              <Input
                id="available_quantity"
                type="number"
                    step="0.01"
                    min="0"
                value={Number.isNaN(newItem.available_quantity) || newItem.available_quantity === undefined ? '' : newItem.available_quantity}
                    onChange={e => setNewItem({ ...newItem, available_quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
              />
            </div>

                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm font-medium">Unit *</Label>
              <Select
                value={newItem.unit}
                onValueChange={value => setNewItem({ ...newItem, unit: value })}
              >
                    <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium">Storage Location *</Label>
                  <Select
                    value={newItem.location}
                    onValueChange={value => setNewItem({ ...newItem, location: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          <span className="capitalize">{location}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_per_unit" className="text-sm font-medium">Cost Price (GHS) *</Label>
                  <Input
                    id="cost_per_unit"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={Number.isNaN(newItem.cost_per_unit) || newItem.cost_per_unit === undefined ? '' : newItem.cost_per_unit}
                    onChange={e => setNewItem({ ...newItem, cost_per_unit: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_per_unit" className="text-sm font-medium">Selling Price (GHS) *</Label>
              <Input
                id="price_per_unit"
                type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                value={Number.isNaN(newItem.price_per_unit) || newItem.price_per_unit === undefined ? '' : newItem.price_per_unit}
                    onChange={e => setNewItem({ ...newItem, price_per_unit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Profit Margin Display */}
              {newItem.cost_per_unit > 0 && newItem.price_per_unit > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-800">Profit Margin:</span>
                    <span className="text-lg font-bold text-green-600">
                      {((newItem.price_per_unit - newItem.cost_per_unit) / newItem.price_per_unit * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Profit: GHS{(newItem.price_per_unit - newItem.cost_per_unit).toFixed(2)} per {newItem.unit || 'unit'}
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Management Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Inventory Management</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimum_stock_level" className="text-sm font-medium">Minimum Stock Level</Label>
                  <Input
                    id="minimum_stock_level"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.minimum_stock_level}
                    onChange={e => setNewItem({ ...newItem, minimum_stock_level: parseFloat(e.target.value) || 5 })}
                    placeholder="5.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maximum_stock_level" className="text-sm font-medium">Maximum Stock Level</Label>
                  <Input
                    id="maximum_stock_level"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.maximum_stock_level}
                    onChange={e => setNewItem({ ...newItem, maximum_stock_level: parseFloat(e.target.value) || 100 })}
                    placeholder="100.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorder_point" className="text-sm font-medium">Reorder Point</Label>
                  <Input
                    id="reorder_point"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.reorder_point}
                    onChange={e => setNewItem({ ...newItem, reorder_point: parseFloat(e.target.value) || 10 })}
                    placeholder="10.00"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Additional Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier" className="text-sm font-medium">Supplier</Label>
                  <Input
                    id="supplier"
                    value={newItem.supplier}
                    onChange={e => setNewItem({ ...newItem, supplier: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode" className="text-sm font-medium">Barcode</Label>
                  <Input
                    id="barcode"
                    value={newItem.barcode}
                    onChange={e => setNewItem({ ...newItem, barcode: e.target.value })}
                    placeholder="Barcode number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch_number" className="text-sm font-medium">Batch Number</Label>
                  <Input
                    id="batch_number"
                    value={newItem.batch_number}
                    onChange={e => setNewItem({ ...newItem, batch_number: e.target.value })}
                    placeholder="Batch or lot number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiration_date" className="text-sm font-medium">Expiration Date</Label>
              <Input
                id="expiration_date"
                type="date"
                value={newItem.expiration_date}
                onChange={e => setNewItem({ ...newItem, expiration_date: e.target.value })}
                    min={format(new Date(), 'yyyy-MM-dd')}
              />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setDialogOpen(false);
                // Reset form
                setNewItem({
                  name: '',
                  category: '',
                  available_quantity: 0,
                  unit: '',
                  price_per_unit: 0,
                  cost_per_unit: 0,
                  minimum_stock_level: 5,
                  maximum_stock_level: 100,
                  reorder_point: 10,
                  supplier: '',
                  barcode: '',
                  batch_number: '',
                  location: 'main',
                  expiration_date: '',
                  date_created: format(new Date(), 'yyyy-MM-dd'),
                });
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Enhanced validation
                const requiredFields = [
                  { field: 'name', label: 'Product Name' },
                  { field: 'category', label: 'Category' },
                  { field: 'unit', label: 'Unit' },
                  { field: 'available_quantity', label: 'Available Quantity' },
                  { field: 'price_per_unit', label: 'Selling Price' },
                  { field: 'cost_per_unit', label: 'Cost Price' },
                  { field: 'location', label: 'Storage Location' }
                ];

                const missingFields = requiredFields.filter(({ field }) => {
                  const value = newItem[field as keyof typeof newItem];
                  return !value || (typeof value === 'number' && value <= 0);
                });

                if (missingFields.length > 0) {
                  toast({
                    title: "Missing Required Fields",
                    description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
                    variant: "destructive"
                  });
                  return;
                }

                // Additional business validation
                if (newItem.price_per_unit <= newItem.cost_per_unit) {
                  toast({
                    title: "Invalid Pricing",
                    description: "Selling price must be higher than cost price for profit.",
                    variant: "destructive"
                  });
                  return;
                }

                if (newItem.maximum_stock_level <= newItem.minimum_stock_level) {
                  toast({
                    title: "Invalid Stock Levels",
                    description: "Maximum stock level must be higher than minimum stock level.",
                    variant: "destructive"
                  });
                  return;
                }

                setLoading(true);
                try {
                  // Insert data (SKU will be auto-generated by database trigger)
                  const { error } = await supabase
                    .from('inventory')
                    .insert([{ 
                      name: newItem.name,
                      category: newItem.category,
                      available_quantity: newItem.available_quantity,
                      total_quantity: newItem.available_quantity, // Set total_quantity to initial stock
                      unit: newItem.unit,
                      cost_per_unit: newItem.cost_per_unit,
                      price_per_unit: newItem.price_per_unit,
                      minimum_stock_level: newItem.minimum_stock_level,
                      maximum_stock_level: newItem.maximum_stock_level,
                      reorder_point: newItem.reorder_point,
                      supplier: newItem.supplier || null,
                      barcode: newItem.barcode || null,
                      batch_number: newItem.batch_number || null,
                      location: newItem.location,
                      expiration_date: newItem.expiration_date || null,
                      is_active: true
                    }]);
                  
                  if (error) throw error;
                  
                  toast({
                    title: "✅ Inventory Item Added",
                    description: `${newItem.name} has been successfully added to inventory with SKU auto-generation.`
                  });
                  
                  setDialogOpen(false);
                  
                  // Refresh the list
                  const { data, error: fetchError } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('is_active', true)
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
                    cost_per_unit: 0,
                    minimum_stock_level: 5,
                    maximum_stock_level: 100,
                    reorder_point: 10,
                    supplier: '',
                    barcode: '',
                    batch_number: '',
                    location: 'main',
                    expiration_date: '',
                    date_created: format(new Date(), 'yyyy-MM-dd'),
                  });
                } catch (err: any) {
                  toast({
                    title: "Error Adding Item",
                    description: err.message || "Failed to add inventory item. Please try again.",
                    variant: "destructive"
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="bg-creamello-purple hover:bg-creamello-purple/90"
            >
              {loading ? "Adding..." : "Add to Inventory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={replenishmentDialogOpen} onOpenChange={setReplenishmentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-creamello-purple">Replenish Stock</DialogTitle>
            <DialogDescription>
              Add stock to an existing inventory item.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Replenishment Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product" className="text-sm font-medium">Product *</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-medium">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={replenishmentQuantity}
                    onChange={e => setReplenishmentQuantity(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_cost" className="text-sm font-medium">Unit Cost (GHS)</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={replenishmentUnitCost}
                    onChange={e => setReplenishmentUnitCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_number" className="text-sm font-medium">Reference Number</Label>
                  <Input
                    id="reference_number"
                    value={replenishmentReferenceNumber}
                    onChange={e => setReplenishmentReferenceNumber(e.target.value)}
                    placeholder="Enter reference number"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setReplenishmentDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedProductId || replenishmentQuantity <= 0) {
                  toast({
                    title: "Missing Required Fields",
                    description: "Please select a product and enter a valid quantity.",
                    variant: "destructive"
                  });
                  return;
                }

                setLoading(true);
                try {
                  const { success, error } = await InventoryMovementService.replenishStock({
                    inventory_id: selectedProductId,
                    quantity: replenishmentQuantity,
                    unit_cost: replenishmentUnitCost,
                    reference_number: replenishmentReferenceNumber,
                    created_by: staff.name
                  });

                  if (!success) throw new Error(error);

                  toast({
                    title: "✅ Stock Replenished",
                    description: "Stock has been successfully replenished."
                  });

                  setReplenishmentDialogOpen(false);
                  handleRefresh();
                } catch (err: any) {
                  toast({
                    title: "Error Replenishing Stock",
                    description: err.message || "Failed to replenish stock. Please try again.",
                    variant: "destructive"
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="bg-creamello-purple hover:bg-creamello-purple/90"
            >
              {loading ? "Replenishing..." : "Replenish Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
