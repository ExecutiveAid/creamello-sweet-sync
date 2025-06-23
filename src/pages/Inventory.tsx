import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { AlertTriangle, RefreshCw, Plus, Package2, Trash2, Archive, Package, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, addDays, differenceInDays } from 'date-fns';
import { formatCurrencyDisplay, formatDateDisplay, formatQuantityDisplay } from '@/utils/formatters';
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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PurchaseOrdersTable } from '@/components/purchase-orders/PurchaseOrdersTable';
import { PurchaseOrderModal } from '@/components/purchase-orders/PurchaseOrderModal';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from '@/services/purchaseOrderService';
import { PurchaseOrder } from '@/types/purchaseOrder';
import { PurchaseOrderViewModal } from '@/components/purchase-orders/PurchaseOrderViewModal';
import { SalesOrdersTable } from '@/components/sales-orders/SalesOrdersTable';
import { SalesOrderModal } from '@/components/sales-orders/SalesOrderModal';
import { SalesOrderViewModal } from '@/components/sales-orders/SalesOrderViewModal';
import { getSalesOrders, createSalesOrder, updateSalesOrder, deleteSalesOrder } from '@/services/salesOrderService';
import { SalesOrder } from '@/types/salesOrder';
import { CustomersTable } from '@/components/customers/CustomersTable';
import { CustomerModal } from '@/components/customers/CustomerModal';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customerService';
import { Customer } from '@/types/customer';
import { InvoicesTable } from '@/components/invoices/InvoicesTable';
import { InvoiceModal } from '@/components/invoices/InvoiceModal';
import { InvoiceViewModal } from '@/components/invoices/InvoiceViewModal';
import { PaymentModal } from '@/components/invoices/PaymentModal';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, getPayments, createPayment, getNextInvoiceNumber } from '@/services/invoiceService';
import { Invoice, Payment } from '@/types/invoice';

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

// Default inventory categories and units (fallbacks)
const DEFAULT_INVENTORY_CATEGORIES = [
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

const DEFAULT_INVENTORY_UNITS = [
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
  const [showExpiryItems, setShowExpiryItems] = useState(false);
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
  
  // Dynamic inventory configuration from settings
  const [inventoryCategories, setInventoryCategories] = useState<string[]>(DEFAULT_INVENTORY_CATEGORIES);
  const [inventoryUnits, setInventoryUnits] = useState<string[]>(DEFAULT_INVENTORY_UNITS);
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
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
    supplier_id: 'none',
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
  
  // Archive confirmation dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState<InventoryProduct | null>(null);

  const [showArchived, setShowArchived] = useState(false);

  // Inventory summary state
  const [summary, setSummary] = useState({
    totalActive: 0,
    totalArchived: 0,
    totalStockValue: 0,
    lowStock: 0,
  });

  // Add PO and SO summary state
  const [poSummary, setPoSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    totalValue: 0,
  });
  const [soSummary, setSoSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    totalValue: 0,
  });

  const [activeTab, setActiveTab] = useState<'inventory' | 'purchase-orders' | 'sales-orders' | 'customers' | 'invoices'>('inventory');

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poModalData, setPoModalData] = useState<PurchaseOrder | null>(null);
  const [poLoading, setPoLoading] = useState(false);
  const [poView, setPoView] = useState<PurchaseOrder | null>(null);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; unit: string }[]>([]);

  // Sales Orders state
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soModalOpen, setSoModalOpen] = useState(false);
  const [soModalData, setSoModalData] = useState<SalesOrder | null>(null);
  const [soLoading, setSoLoading] = useState(false);
  const [soView, setSoView] = useState<SalesOrder | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Customers state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerModalData, setCustomerModalData] = useState<Customer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Removed invoice modal state - invoices are now generated from Sales Orders
  const [invoiceView, setInvoiceView] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [invoiceSummary, setInvoiceSummary] = useState({ total: 0, unpaid: 0, paid: 0, overdue: 0, outstanding: 0 });

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
      setCategories(inventoryCategories);
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

  // Load inventory configuration from settings
  const fetchInventorySettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('inventory_categories, inventory_units').limit(1).single();
      if (data) {
        // Load inventory categories
        if (data.inventory_categories) {
          setInventoryCategories(data.inventory_categories);
        }
        
        // Load inventory units - extract just the names from the unit objects
        if (data.inventory_units) {
          const unitNames = data.inventory_units.map((unit: any) => unit.name || unit);
          setInventoryUnits(unitNames);
        }
      }
    } catch (err: any) {
      console.error('Error fetching inventory settings:', err.message);
      // Will use default values
    }
  };

  // Load suppliers from database
  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err.message);
      // Will use empty array as fallback
    }
  };

  // Fetch inventory (active or archived based on toggle)
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('inventory')
          .select('*')
          .eq('is_active', !showArchived)
          .order('name', { ascending: true });
        if (fetchError) throw fetchError;
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
    
    // Load settings first, then inventory data
    fetchInventorySettings().then(() => {
    fetchInventory();
    fetchCategories();
    fetchProductNames();
      fetchSuppliers();
    });
  }, [showArchived]);

  // Filtering
  useEffect(() => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply low stock filter if enabled
    if (showLowStockOnly) {
      filtered = filtered.filter(product => product.available_quantity <= product.minimum_stock_level);
    }
    
    // Apply expiry items filter if enabled
    if (showExpiryItems) {
      filtered = filtered.filter(product => {
        if (!product.expiration_date) return false;
        const daysToExpiry = differenceInDays(parseISO(product.expiration_date), new Date());
        return daysToExpiry >= 0 && daysToExpiry <= 7; // Show items expiring within 7 days
      });
    }
    
    setFilteredProducts(filtered);
  }, [searchQuery, products, showLowStockOnly, showExpiryItems]);

  // Calculate summary stats whenever products change
  useEffect(() => {
    // Always fetch all inventory for summary, not just filtered/toggled set
    const fetchAllInventoryForSummary = async () => {
      const { data: allData, error } = await supabase.from('inventory').select('*');
      if (error) return;
      let totalActive = 0;
      let totalArchived = 0;
      let totalStockValue = 0;
      let lowStock = 0;
      (allData || []).forEach(item => {
        if (item.is_active) {
          totalActive++;
          totalStockValue += (item.available_quantity || 0) * (item.price_per_unit || 0);
          if (item.available_quantity <= item.minimum_stock_level) lowStock++;
        } else {
          totalArchived++;
        }
      });
      setSummary({ totalActive, totalArchived, totalStockValue, lowStock });
    };
    fetchAllInventoryForSummary();
  }, []);

  // Calculate PO summary whenever purchaseOrders changes
  useEffect(() => {
    const total = purchaseOrders.length;
    const open = purchaseOrders.filter(po => ['draft', 'sent', 'partially_received'].includes(po.status)).length;
    const closed = purchaseOrders.filter(po => ['received', 'closed', 'cancelled'].includes(po.status)).length;
    const totalValue = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);
    setPoSummary({ total, open, closed, totalValue });
  }, [purchaseOrders]);

  // Calculate SO summary whenever salesOrders changes
  useEffect(() => {
    const total = salesOrders.length;
    const open = salesOrders.filter(so => ['draft', 'confirmed', 'partially_fulfilled'].includes(so.status)).length;
    const closed = salesOrders.filter(so => ['fulfilled', 'closed', 'cancelled'].includes(so.status)).length;
    const totalValue = salesOrders.reduce((sum, so) => sum + (so.total_amount || 0), 0);
    setSoSummary({ total, open, closed, totalValue });
  }, [salesOrders]);

  // Fetch invoices
  const loadInvoices = async () => {
    const invs = await getInvoices();
    setInvoices(invs);
    // Summary
    let total = invs.length;
    let unpaid = invs.filter(i => i.status === 'unpaid').length;
    let paid = invs.filter(i => i.status === 'paid').length;
    let overdue = invs.filter(i => i.status === 'overdue').length;
    let outstanding = invs.filter(i => i.status === 'unpaid' || i.status === 'overdue').reduce((sum, i) => sum + (i.total_amount || 0), 0);
    setInvoiceSummary({ total, unpaid, paid, overdue, outstanding });
  };
  useEffect(() => {
    if (activeTab === 'invoices') loadInvoices();
  }, [activeTab]);

  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case 'gelato':
        return <Badge className="bg-brand-primary/20 text-brand-primary border-brand-primary/30">Gelato</Badge>;
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
      // Refresh inventory settings (categories and units) first
      await fetchInventorySettings();
      
      // Then refresh inventory data
      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('is_active', !showArchived)
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      console.log('Refreshed inventory items:', data); // Debug log
      setProducts(data || []);
      setFilteredProducts(data || []);
      
      // Also refresh categories, product names, and suppliers
      await fetchCategories();
      await fetchProductNames();
      await fetchSuppliers();
      
      toast({ title: 'Inventory Refreshed', description: 'Inventory data and categories have been refreshed.' });
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

  // Handle archive product
  const handleArchiveProduct = async () => {
    if (!productToArchive || !staff) return;
    
    try {
      setLoading(true);
      
      // Archive the inventory item (soft delete by setting is_active to false + audit trail)
      const { error } = await supabase
        .from('inventory')
        .update({ 
          is_active: false,
          archived_by: staff.id,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', productToArchive.id);
      
      if (error) throw error;
      
      toast({
        title: "📦 Item Archived",
        description: `${productToArchive.name} has been archived by ${staff.name}.`
      });
      
      // Close dialog and reset state
      setArchiveDialogOpen(false);
      setProductToArchive(null);
      
      // Refresh the inventory list
      await handleRefresh();
      
    } catch (err: any) {
      toast({
        title: "Error Archiving Item",
        description: err.message || "Failed to archive inventory item. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch suppliers and inventory items for PO modal
  useEffect(() => {
    const fetchSuppliersAndItems = async () => {
      const { data: supplierData } = await supabase.from('suppliers').select('id, name').order('name');
      setSuppliers(supplierData || []);
      const { data: itemData } = await supabase.from('inventory').select('id, name, unit').eq('is_active', true).order('name');
      setInventoryItems(itemData || []);
    };
    fetchSuppliersAndItems();
  }, []);

  // Fetch purchase orders
  const loadPurchaseOrders = async () => {
    setPoLoading(true);
    try {
      const pos = await getPurchaseOrders();
      setPurchaseOrders(pos);
    } catch (e) {
      // handle error
    } finally {
      setPoLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'purchase-orders') {
      loadPurchaseOrders();
    }
  }, [activeTab]);

  // CRUD handlers
  const handleCreatePO = () => {
    setPoModalData(null);
    setPoModalOpen(true);
  };
  const handleEditPO = (po: PurchaseOrder) => {
    setPoModalData(po);
    setPoModalOpen(true);
  };
  const handleDeletePO = async (po: PurchaseOrder) => {
    if (window.confirm('Delete this purchase order?')) {
      await deletePurchaseOrder(po.id);
      loadPurchaseOrders();
    }
  };
  const handleSavePO = async (po: Partial<PurchaseOrder>, items: any[]) => {
    if (poModalData) {
      await updatePurchaseOrder(poModalData.id, po, items);
      // For simplicity, reload all POs (line item editing can be added later)
    } else {
      await createPurchaseOrder(po, items);
    }
    setPoModalOpen(false);
    loadPurchaseOrders();
  };
  const handleViewPO = (po: PurchaseOrder) => {
    setPoView(po);
  };

  // Fetch customers and inventory items for SO modal
  useEffect(() => {
    const fetchCustomersAndItems = async () => {
      // Only fetch id and name for dropdowns, not for the Customers tab
      const { data: customerData } = await supabase.from('customers').select('id, name').order('name');
      setCustomers(customerData || []);
      const { data: itemData } = await supabase.from('inventory').select('id, name, unit').eq('is_active', true).order('name');
      setInventoryItems(itemData || []);
    };
    fetchCustomersAndItems();
  }, []);

  // Fetch sales orders
  const loadSalesOrders = async () => {
    setSoLoading(true);
    try {
      const sos = await getSalesOrders();
      setSalesOrders(sos);
    } catch (e) {
      // handle error
    } finally {
      setSoLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'sales-orders') {
      loadSalesOrders();
    }
  }, [activeTab]);

  // CRUD handlers for SO
  const handleCreateSO = () => {
    setSoModalData(null);
    setSoModalOpen(true);
  };
  const handleEditSO = (so: SalesOrder) => {
    setSoModalData(so);
    setSoModalOpen(true);
  };
  const handleDeleteSO = async (so: SalesOrder) => {
    if (window.confirm('Delete this sales order?')) {
      await deleteSalesOrder(so.id);
      loadSalesOrders();
    }
  };
  const handleSaveSO = async (so: Partial<SalesOrder>, items: any[]) => {
    if (soModalData) {
      await updateSalesOrder(soModalData.id, so, items);
    } else {
      await createSalesOrder(so, items);
    }
    setSoModalOpen(false);
    loadSalesOrders();
  };
  const handleViewSO = (so: SalesOrder) => {
    setSoView(so);
  };

  // Generate invoice from Sales Order
  const handleGenerateInvoice = async (so: SalesOrder) => {
    try {
      // Get next invoice number
      const invoiceNumber = await getNextInvoiceNumber();
      
      // Create invoice from sales order
      const invoiceData = {
        customer_id: so.customer_id,
        sales_order_id: so.id,
        invoice_number: invoiceNumber,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from today
        total_amount: so.total_amount,
        status: 'unpaid' as const
      };

      await createInvoice(invoiceData);
      
      // Update sales order to mark invoice as generated
      await updateSalesOrder(so.id, { invoice_generated: true }, so.items || []);
      
      // Reload both sales orders and invoices
      loadSalesOrders();
      loadInvoices();
      
      toast({
        title: 'Invoice Generated',
        description: `Invoice ${invoiceNumber} generated successfully for Sales Order ${so.order_number}`,
        variant: 'default'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate invoice',
        variant: 'destructive'
      });
    }
  };

  // Fetch customers for Customers tab (full fields)
  const loadCustomers = async () => {
    setCustomerLoading(true);
    try {
      const cs = await getCustomers(); // This fetches all fields, including created_at
      setCustomers(cs);
    } catch (e) {
      // handle error
    } finally {
      setCustomerLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers();
    }
  }, [activeTab]);

  // CRUD handlers for customers
  const handleCreateCustomer = () => {
    setCustomerModalData(null);
    setCustomerModalOpen(true);
  };
  const handleEditCustomer = (customer: Customer) => {
    setCustomerModalData(customer);
    setCustomerModalOpen(true);
  };
  const handleDeleteCustomer = async (customer: Customer) => {
    if (window.confirm('Delete this customer?')) {
      await deleteCustomer(customer.id);
      loadCustomers();
    }
  };
  const handleSaveCustomer = async (customer: Partial<Customer>) => {
    if (customerModalData) {
      await updateCustomer(customerModalData.id, customer);
    } else {
      await createCustomer(customer);
    }
    setCustomerModalOpen(false);
    loadCustomers();
  };

  // Invoice handlers - VIEW ONLY (invoices generated from Sales Orders)
  // Removed manual invoice creation/editing functionality
  const handleViewInvoice = (invoice: Invoice) => {
    setInvoiceView(invoice);
    loadPayments(invoice.id);
  };
  const loadPayments = async (invoiceId: string) => {
    const pays = await getPayments(invoiceId);
    setPayments(pays);
  };
  const handleRecordPayment = (invoice: Invoice) => {
    setPaymentInvoiceId(invoice.id);
    setPaymentModalOpen(true);
  };
  const handleSavePayment = async (payment: Partial<Payment>) => {
    await createPayment(payment);
    setPaymentModalOpen(false);
    if (paymentInvoiceId) {
      loadPayments(paymentInvoiceId);
      loadInvoices();
    }
  };

  // Removed useEffect for invoice modal - no longer needed

  // Show Stock Taking component if selected
  if (showStockTaking) {
    return <StockTaking onClose={() => setShowStockTaking(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Tabs for Inventory, Purchase Orders, Sales Orders, Customers, Invoices */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="sales-orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Inventory Summary Cards (always visible) */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Items</CardTitle>
              <Package className="h-5 w-5 text-brand-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalActive}</div>
              <CardDescription>Currently in stock</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Archived Items</CardTitle>
              <Archive className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalArchived}</div>
              <CardDescription>Removed from active inventory</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyDisplay(summary.totalStockValue)}</div>
              <CardDescription>Value of all active stock</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.lowStock}</div>
              <CardDescription>At or below minimum level</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'inventory' && (
        <>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <div className="flex gap-2 items-center">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
                className="mr-2"
              />
              <label htmlFor="show-archived" className="text-sm select-none cursor-pointer">
                Show Archived
              </label>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setShowStockTaking(true)}>
                <Package2 className="mr-2 h-4 w-4" /> Stock Taking
              </Button>
              <Button 
                onClick={async () => {
                  await fetchInventorySettings();
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> New Inventory Item
              </Button>
              <Button 
                onClick={() => setReplenishmentDialogOpen(true)}
              >
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
                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary mr-2"
              />
              <label htmlFor="lowStockFilter" className="text-sm font-medium flex items-center">
                <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
                Show Low Stock Only
              </label>
            </div>
            <div className="flex items-center mr-4">
              <input
                type="checkbox"
                id="expiryItemsFilter"
                checked={showExpiryItems}
                onChange={(e) => setShowExpiryItems(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary mr-2"
              />
              <label htmlFor="expiryItemsFilter" className="text-sm font-medium flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                Show Expiry Items (7 days)
              </label>
            </div>
            {showLowStockOnly && filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No low stock items found</p>
            )}
            {showLowStockOnly && (
              <Badge className="bg-amber-500">
                {filteredProducts.length} Low Stock {filteredProducts.length === 1 ? 'Item' : 'Items'}
              </Badge>
            )}
            {showExpiryItems && filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No items expiring within 7 days</p>
            )}
            {showExpiryItems && (
              <Badge className="bg-red-500">
                {filteredProducts.length} Expiring {filteredProducts.length === 1 ? 'Item' : 'Items'}
              </Badge>
            )}
          </div>
          
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
                        Total: {formatQuantityDisplay(Number(row.total_quantity || 0), row.unit)}
                      </div>
                      <div className={isLowStock ? "text-red-600 font-medium" : "text-black font-medium"}>
                        Available: {formatQuantityDisplay(Number(row.available_quantity), row.unit)}
                        {isLowStock && (
                          <AlertTriangle className="inline ml-1 h-3 w-3 text-red-500" />
                        )}
                      </div>
                      {isLowStock && (
                        <div className="text-xs text-red-500">
                          Low Stock (Min: {formatQuantityDisplay(row.minimum_stock_level, row.unit)})
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
                      {formatCurrencyDisplay(Number(row.cost_per_unit || 0))}
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
                      {formatCurrencyDisplay(Number(row.price_per_unit))}
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
                  formatDateDisplay(row.date_created) : 
                  formatDateDisplay(new Date())
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
                      {formatDateDisplay(expiryDate)}
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
              {
                header: "Status",
                cell: (row: InventoryProduct) => (
                  row.is_active ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                  ) : (
                    <Badge className="bg-gray-200 text-gray-600 border-gray-300">Archived</Badge>
                  )
                ),
                accessorKey: "is_active"
              },
              {
                header: "Actions",
                cell: (row: InventoryProduct) => (
                  <div className="flex gap-2 justify-center">
                    {isAdminOrManager && row.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProductToArchive(row);
                          setArchiveDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0 bg-transparent hover:bg-brand-primary/20"
                        title="Archive Item"
                      >
                        <Archive className="h-4 w-4 text-brand-primary hover:text-brand-primary-dark transition-colors" />
                      </Button>
                    )}
                  </div>
                ),
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
                            <DialogTitle className="text-xl font-bold text-brand-primary">Add New Inventory Item</DialogTitle>
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
                                            {inventoryCategories.map((category) => (
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
                                        {inventoryUnits.map((unit) => (
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
                      <Select
                        value={newItem.supplier_id}
                        onValueChange={v => setNewItem({ ...newItem, supplier_id: v })}
                      >
                        <SelectTrigger id="supplier">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No supplier</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name} ({supplier.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      supplier_id: 'none',
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
                          supplier_id: newItem.supplier_id === 'none' ? null : newItem.supplier_id || null,
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
                        .eq('is_active', !showArchived)
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
                        supplier_id: 'none',
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
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {loading ? "Adding..." : "Add to Inventory"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={replenishmentDialogOpen} onOpenChange={setReplenishmentDialogOpen}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-brand-primary">Replenish Stock</DialogTitle>
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
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {loading ? "Replenishing..." : "Replenish Stock"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Archive Confirmation Dialog */}
          <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive Inventory Item</DialogTitle>
                <DialogDescription>
                  Are you sure you want to archive this inventory item? This will remove it from active inventory but keep it for records.
                </DialogDescription>
              </DialogHeader>
              
              {productToArchive && (
                <div className="py-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                      <span className="font-semibold text-orange-800">Item to be archived:</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Name:</strong> {productToArchive.name}</div>
                      <div><strong>SKU:</strong> {productToArchive.sku}</div>
                      <div><strong>Category:</strong> {productToArchive.category}</div>
                      <div><strong>Available Quantity:</strong> {productToArchive.available_quantity} {productToArchive.unit}</div>
                    </div>
                    <div className="mt-3 p-2 bg-orange-100 rounded text-sm">
                      <strong>Archive Info:</strong> This action will be logged with your user account ({staff?.name}) and timestamp.
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setArchiveDialogOpen(false);
                    setProductToArchive(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleArchiveProduct}
                  disabled={loading}
                  className="bg-brand-primary hover:bg-brand-primary-dark text-white"
                >
                  {loading ? "Archiving..." : "Archive Item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {activeTab === 'purchase-orders' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total POs</CardTitle>
                <Package className="h-5 w-5 text-brand-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{poSummary.total}</div>
                <CardDescription>All purchase orders</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Open POs</CardTitle>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{poSummary.open}</div>
                <CardDescription>Draft, sent, or partial</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Closed/Received</CardTitle>
                <Archive className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{poSummary.closed}</div>
                <CardDescription>Received, closed, or cancelled</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total PO Value</CardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {poSummary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <CardDescription>Sum of all POs</CardDescription>
              </CardContent>
            </Card>
          </div>
          <PurchaseOrdersTable
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            onCreate={handleCreatePO}
            onEdit={handleEditPO}
            onDelete={handleDeletePO}
            onView={handleViewPO}
          />
          <PurchaseOrderModal
            open={poModalOpen}
            onClose={() => setPoModalOpen(false)}
            onSave={handleSavePO}
            initialData={poModalData || undefined}
            suppliers={suppliers}
            inventoryItems={inventoryItems}
          />
          <PurchaseOrderViewModal
            open={!!poView}
            onClose={() => setPoView(null)}
            purchaseOrder={poView}
            suppliers={suppliers}
            inventoryItems={inventoryItems}
          />
        </>
      )}
      {activeTab === 'sales-orders' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total SOs</CardTitle>
                <Package className="h-5 w-5 text-brand-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{soSummary.total}</div>
                <CardDescription>All sales orders</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Open SOs</CardTitle>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{soSummary.open}</div>
                <CardDescription>Draft, confirmed, or partial</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Closed/Fulfilled</CardTitle>
                <Archive className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{soSummary.closed}</div>
                <CardDescription>Fulfilled, closed, or cancelled</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total SO Value</CardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {soSummary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <CardDescription>Sum of all SOs</CardDescription>
              </CardContent>
            </Card>
          </div>
          <SalesOrdersTable
            salesOrders={salesOrders}
            customers={customers}
            onCreate={handleCreateSO}
            onEdit={handleEditSO}
            onDelete={handleDeleteSO}
            onView={handleViewSO}
            onGenerateInvoice={handleGenerateInvoice}
          />
          <SalesOrderModal
            open={soModalOpen}
            onClose={() => setSoModalOpen(false)}
            onSave={handleSaveSO}
            initialData={soModalData || undefined}
            customers={customers}
            inventoryItems={inventoryItems}
          />
          <SalesOrderViewModal
            open={!!soView}
            onClose={() => setSoView(null)}
            salesOrder={soView}
            customers={customers}
            inventoryItems={inventoryItems}
          />
        </>
      )}
      {activeTab === 'customers' && (
        <>
          {customerLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading customers...</div>
          ) : (
            <CustomersTable
              customers={Array.isArray(customers) ? customers : []}
              onCreate={handleCreateCustomer}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
            />
          )}
          <CustomerModal
            open={customerModalOpen}
            onClose={() => setCustomerModalOpen(false)}
            onSave={handleSaveCustomer}
            initialData={customerModalData || undefined}
          />
        </>
      )}
      {activeTab === 'invoices' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoiceSummary.total}</div>
                <CardDescription>All invoices</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoiceSummary.unpaid}</div>
                <CardDescription>Awaiting payment</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoiceSummary.paid}</div>
                <CardDescription>Fully paid</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoiceSummary.overdue}</div>
                <CardDescription>Past due date</CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {invoiceSummary.outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <CardDescription>Unpaid + overdue</CardDescription>
              </CardContent>
            </Card>
          </div>
          <InvoicesTable
            invoices={invoices}
            customers={customers}
            salesOrders={salesOrders.map(so => ({ id: so.id, order_number: so.order_number }))}
            onView={handleViewInvoice}
            onRecordPayment={handleRecordPayment}
          />
          {/* Invoice Modal removed - invoices are now generated from Sales Orders */}
          <InvoiceViewModal
            open={!!invoiceView}
            onClose={() => setInvoiceView(null)}
            invoice={invoiceView}
            payments={payments}
            onRecordPayment={() => invoiceView && handleRecordPayment(invoiceView)}
            customers={customers}
            salesOrders={salesOrders.map(so => ({ id: so.id, order_number: so.order_number, items: so.items }))}
            inventoryItems={inventoryItems}
          />
          <PaymentModal
            open={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
            onSave={handleSavePayment}
            invoiceId={paymentInvoiceId || ''}
          />
        </>
      )}
    </div>
  );
};

export default Inventory;
