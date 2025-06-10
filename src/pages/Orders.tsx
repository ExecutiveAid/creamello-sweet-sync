import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, IceCreamCone, CircleDollarSign, User } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { useOrderContext, Order, OrderItem } from '@/context/OrderContext';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useProductInventory } from '@/context/ProductInventoryContext';
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';
import { format, subDays, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Receipt, { ReceiptTemplate, ReceiptOrder } from '@/components/Receipt';
import { printReceipt } from '@/utils/receiptPrinter';
import { SundaeDeductionService } from '@/services/sundaeDeductionService';
import { isSundae } from '@/config/sundaeRecipes';

// Types for our ice cream ordering system
interface IceCreamFlavor {
  id: string;
  name: string;
  description: string;
  pricePerScoop: number;
  image: string;
  category: string; // e.g., "Classic", "Special", "Seasonal"
  available: boolean;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

// Sample ice cream flavor data
const iceCreamFlavors: IceCreamFlavor[] = [
  {
    id: "vanilla",
    name: "Classic Vanilla",
    description: "Rich and creamy classic vanilla bean",
    pricePerScoop: 12.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "chocolate",
    name: "Double Chocolate",
    description: "Decadent chocolate with chocolate chips",
    pricePerScoop: 14.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "strawberry",
    name: "Fresh Strawberry",
    description: "Made with fresh strawberries and cream",
    pricePerScoop: 14.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "caramel",
    name: "Salted Caramel",
    description: "Sweet caramel with a touch of sea salt",
    pricePerScoop: 16.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "mint",
    name: "Mint Chocolate Chip",
    description: "Refreshing mint with dark chocolate chips",
    pricePerScoop: 15.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "mango",
    name: "Mango Sorbet",
    description: "Tropical mango sorbet, dairy-free",
    pricePerScoop: 15.99,
    image: "/placeholder.svg",
    category: "Seasonal",
    available: true
  },
  {
    id: "pistachio",
    name: "Pistachio Cream",
    description: "Premium pistachio flavor with real nuts",
    pricePerScoop: 17.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "coffee",
    name: "Coffee Espresso",
    description: "Rich coffee ice cream with espresso swirls",
    pricePerScoop: 16.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  }
];

// Sample staff data
const staffMembers: Staff[] = [
  { id: "staff1", name: "Sarah Johnson", role: "staff" },
  { id: "staff2", name: "Michael Lee", role: "staff" },
  { id: "staff3", name: "Anita Patel", role: "staff" },
  { id: "staff4", name: "David Osei", role: "manager" },
];

// Default menu categories (will be loaded from settings)
const DEFAULT_MENU_CATEGORIES = [
  'Flavors',
  'Toppings',
  'Waffles & Pancakes',
  'Sundaes',
  'Milkshakes',
  'Juice',
];

const PAYMENT_METHODS = ['Cash', 'Card', 'Mobile Money'];

// Removed old hardcoded Receipt component - now using configurable Receipt from components

const Orders = () => {
  // All hooks must be declared here, inside the component:
  const [menuCategories, setMenuCategories] = useState<string[]>(DEFAULT_MENU_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(DEFAULT_MENU_CATEGORIES[0]);
  const [cart, setCart] = useState([]); // { id, name, price, quantity }
  const [orderTotal, setOrderTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [showReceipt, setShowReceipt] = useState(false);

  const [tableNumber, setTableNumber] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("create");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const orderContext = useOrderContext();

  // Track the last order for receipt
  const [lastOrder, setLastOrder] = useState(null);

  const [amountPaid, setAmountPaid] = useState(0);
  const change = paymentMethod === 'Cash' ? Math.max(0, amountPaid - orderTotal) : 0;

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  const { products, deductStock } = useProductInventory();

  // Set default start date to 24 hours ago
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;

  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [staffList, setStaffList] = useState<{ [id: string]: string }>({});

  // Receipt template state
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate>({
    shopName: 'CREAMELLO',
    address: '123 Ice Cream Lane, Accra',
    phone: '055-123-4567',
    width: 48,
    showHeader: true,
    showFooter: true,
    showQrCode: false,
    headerText: 'CASH RECEIPT',
    footerText: 'Thank you for your business!\nVisit us again soon!',
    customMessage: '',
    showOrderDetails: true,
    showStaffInfo: true,
    showDateTime: true,
    showTableInfo: true,
    showCustomerInfo: true,
    paperSize: '80mm',
    encoding: 'utf-8',
    cutType: 'full',
  });

  const [receiptSettings, setReceiptSettings] = useState({
    autoPrint: false,
    showLogo: true,
    footerText: 'Thank you for visiting Creamello!'
  });

  useEffect(() => {
    const fetchMenuItems = async () => {
      setLoadingMenu(true);
      const { data, error } = await supabase
        .from('menu_items')
        .select('*');
      if (error) {
        toast({ title: 'Error loading menu', description: error.message, variant: 'destructive' });
    } else {
        setMenuItems(data);
      }
      setLoadingMenu(false);
    };
    fetchMenuItems();
  }, []);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase.from('staff').select('id, name');
      if (data) {
        const map: { [id: string]: string } = {};
        data.forEach((s: { id: string; name: string }) => {
          map[s.id] = s.name;
        });
        setStaffList(map);
      }
    };
    fetchStaff();
  }, []);

  // Load receipt settings and menu categories from database
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
      if (data) {
        setReceiptTemplate(data.receipt_template || receiptTemplate);
        setReceiptSettings(data.receipt_settings || receiptSettings);
        
        // Load menu categories
        const categories = data.menu_categories || DEFAULT_MENU_CATEGORIES;
        setMenuCategories(categories);
        
        // Update active category if current one doesn't exist
        if (!categories.includes(activeCategory)) {
          setActiveCategory(categories[0] || DEFAULT_MENU_CATEGORIES[0]);
        }
      }
    };
    fetchSettings();
  }, []);

  // Cart logic
  const addToCart = async (item) => {
    // Check sundae availability before adding to cart
    if (item.category === 'Sundaes' && isSundae(item.name)) {
      const existing = cart.find(ci => ci.id === item.id);
      const newQuantity = existing ? existing.quantity + 1 : 1;
      
      const availability = await SundaeDeductionService.checkSundaeAvailability(item.name, newQuantity);
      
      if (!availability.available) {
        toast({
          title: "Sundae Unavailable",
          description: `Cannot add ${item.name}: ${availability.reason}`,
          variant: "destructive"
        });
        return;
      }
    }
    
    setCart(prev => {
      const found = prev.find(ci => ci.id === item.id);
      if (found) {
        return prev.map(ci => ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const removeFromCart = (itemId) => {
    setCart(prev => prev.map(ci => ci.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci).filter(ci => ci.quantity > 0));
  };
  const clearCart = () => setCart([]);
  useEffect(() => {
    setOrderTotal(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  }, [cart]);

  // Convert order to ReceiptOrder format
  const convertOrderToReceipt = (order: any): ReceiptOrder => {
    return {
      id: order.id,
      orderNumber: order.id.slice(-6).toUpperCase(),
      items: order.items.map((item: any) => ({
        name: item.flavor_name || item.name || 'Unknown Item',
        quantity: item.scoops || item.quantity || 1,
        price: item.price || 0,
        total: (item.price || 0) * (item.scoops || item.quantity || 1)
      })),
      subtotal: order.total || 0,
      tax: 0, // Add tax calculation if needed
      total: order.total || 0,
      paymentMethod: order.payment_method || 'Cash',
      amountPaid: order.paid || order.total,
      change: order.change || 0,
      customerName: order.customer_name || undefined,
      tableNumber: order.table_number || undefined,
      staffName: staffList[order.staff_id] || staff?.name || 'Unknown',
      createdAt: order.created_at || new Date().toISOString()
    };
  };

  // Print receipt function with auto-print support
  const handlePrintReceipt = async (order: any) => {
    const receiptOrder = convertOrderToReceipt(order);
    
    // Try to print using POS printer if auto-print is enabled
    if (receiptSettings.autoPrint) {
      try {
        const success = await printReceipt(receiptTemplate, receiptOrder, {
          autoCut: receiptTemplate.cutType !== 'none',
          openDrawer: false
        });
        
        if (success) {
          toast({
            title: 'Receipt Printed',
            description: 'Receipt sent to printer successfully.'
          });
          return;
        }
      } catch (error) {
        console.error('Auto-print failed:', error);
      }
    }
    
    // Fallback to showing receipt dialog
    setLastOrder(order);
    setShowReceipt(true);
  };

  // Update the old printReceipt function
  const printReceiptDialog = () => {
    setShowReceipt(true);
    setTimeout(() => {
      window.print();
      setShowReceipt(false);
    }, 100);
  };

  useEffect(() => {
    let filtered = orderContext.orders;
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Always filter by date range (last 24 hours by default)
    if (startDate) {
      filtered = filtered.filter(order => {
        const date = order.created_at.slice(0, 10);
        return date >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter(order => {
        const date = order.created_at.slice(0, 10);
        return date <= endDate;
      });
    }
    
    setFilteredOrders(filtered);
  }, [orderContext.orders, statusFilter, startDate, endDate]);

  const placeOrder = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cannot place order",
        description: "Please add at least one item to your order",
        variant: "destructive"
      });
      return;
    }
    if (!staff) {
      toast({
        title: "Staff selection required",
        description: "Please log in as staff",
        variant: "destructive"
      });
      return;
    }

    // Prepare order items for normalized structure
    const orderItems = cart.map(item => ({
      flavor_id: item.id,
      flavor_name: item.name,
      scoops: item.quantity, // or item.scoops if that's your field
      price: item.price,
    }));

    // Prepare order (omit id, created_at, updated_at, items)
    const order = {
      staff_id: staff.id,
      customer_name: customerName || undefined,
      table_number: tableNumber || undefined,
      total: orderTotal,
      status: 'pending' as const,
      payment_method: paymentMethod,
    };

    await orderContext.addOrder(order, orderItems);
    
    // Show success message instead of receipt
    toast({
      title: "Order Placed Successfully",
      description: `Order for ${cart.length} item(s) has been created. Complete the order to print receipt.`
    });
    
    // Clear cart and form
    setCart([]);
    setTableNumber("");
    setCustomerName("");
    setAmountPaid(0);
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    // Use the OrderContext to update order status
    await orderContext.updateOrderStatus(orderId, newStatus);
    
    // If completing an order, print receipt
    if (newStatus === 'completed') {
      const completedOrder = orderContext.orders.find(o => o.id === orderId);
      if (completedOrder) {
        await handlePrintReceipt(completedOrder);
      }
    }

    toast({
      title: "Order updated",
      description: `Order ${orderId} status changed to ${newStatus}`
    });
  };

  const handleCancelOrder = (order) => {
    setOrderToCancel(order);
    setShowCancelDialog(true);
  };
  const confirmCancelOrder = () => {
    if (orderToCancel) {
      orderContext.updateOrderStatus(orderToCancel.id, 'cancelled');
      setShowCancelDialog(false);
      setOrderToCancel(null);
    }
  };
  const handleOrderRowClick = (order) => {
    setOrderDetails(order);
    setShowOrderDetails(true);
  };

  // Columns for the orders data table - Fixed to use the proper Column<Order> type
  const orderColumns = [
    {
      header: "Order ID",
      accessorKey: "id" as keyof Order
    },
    {
      header: "Staff",
      cell: (row: Order) => staffList[row.staff_id] || row.staff_id,
      accessorKey: "staff_id"
    },
    {
      header: "Table/Customer",
      accessorKey: (row: Order) => row.table_number ? `Table ${row.table_number}` : row.customer_name || "N/A"
    },
    {
      header: "Items",
      accessorKey: (row: Order) => `${row.items.reduce((sum, item) => sum + (item.scoops || 0), 0)} scoops`,
    },
    {
      header: "Total",
      accessorKey: (row: Order) => `GHS ${row.total.toFixed(2)}`
    },
    {
      header: "Status",
      accessorKey: "status" as keyof Order,
      cell: (row: Order) => (
        <Badge className={
          row.status === 'pending' ? 'bg-yellow-500' :
          row.status === 'preparing' ? 'bg-blue-500' :
          row.status === 'ready' ? 'bg-green-500' :
          row.status === 'completed' ? 'bg-purple-500' :
          'bg-red-500'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: "Created",
      accessorKey: (row: Order) => format(new Date(row.created_at), 'HH:mm:ss'),
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof Order,
      cell: (row: Order) => (
        <div className="flex space-x-2">
          {row.status !== 'completed' && row.status !== 'cancelled' && (
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={e => { e.stopPropagation(); updateOrderStatus(row.id, 'completed'); }}
            >
              Complete
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={row.status === 'completed' || row.status === 'cancelled'}
            onClick={e => { e.stopPropagation(); handleCancelOrder(row); }}
          >
            Cancel
          </Button>
        </div>
      )
    },
  ];

  // 1. Sort menuItems so Oreo comes after Kitkat and below Strawberry
  const sortedMenuItems = React.useMemo(() => {
    // Custom order for Flavors category
    if (activeCategory === 'Flavors') {
      const flavorOrder = [
        'Vanilla',
        'Chocolate',
        'Strawberry',
        'Pistachios',
        'Kitkat',
        'Oreo',
      ];
      return menuItems
        .filter(item => item.category === activeCategory)
        .sort((a, b) => {
          const aIdx = flavorOrder.indexOf(a.name);
          const bIdx = flavorOrder.indexOf(b.name);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
    }
    // Default order for other categories
    return menuItems.filter(item => item.category === activeCategory);
  }, [menuItems, activeCategory]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ice Cream Orders</h1>
          <p className="text-muted-foreground">Create and manage customer orders</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="create">Create Order</TabsTrigger>
          <TabsTrigger value="manage">Manage Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4 pt-4">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {menuCategories.map(cat => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full font-bold text-lg transition-colors ${activeCategory === cat ? 'bg-creamello-purple text-white' : 'bg-muted text-creamello-purple border border-creamello-purple'}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Responsive Grid Layout: Product grid left, Order card right */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Product Grid (2/3 width on medium+ screens) */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {loadingMenu ? (
                  <div className="col-span-full text-center text-lg">Loading menu...</div>
                ) : (
                  sortedMenuItems.map(item => {
                    const inCart = cart.find(ci => ci.id === item.id);
                    return (
                      <button
                        key={item.id}
                        className={`relative flex flex-col items-center justify-between rounded-xl border border-muted bg-white shadow-md p-4 h-44 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-creamello-purple hover:shadow-lg active:scale-95`}
                        onClick={() => addToCart(item)}
                        aria-label={`Add ${item.name} to order`}
                      >
                        {inCart && (
                          <span className="absolute top-2 right-2 bg-creamello-purple text-white rounded-full px-3 py-1 text-lg font-bold shadow-lg z-10">
                            {inCart.quantity}
                          </span>
                        )}
                        <span className="text-lg font-bold text-center mb-1">{item.name}</span>
                        {item.description && <span className="text-xs text-muted-foreground text-center mb-2">{item.description}</span>}
                        <span className="text-xl font-semibold text-creamello-gray">GHS {Number(item.price).toFixed(2)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            {/* Order Card (1/3 width on medium+ screens, much bigger) */}
            <div className="bg-gray-50 rounded-2xl shadow-lg p-8 flex flex-col min-h-[500px] md:min-h-[600px] xl:min-h-[700px] w-full md:w-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Order</h2>
                <ShoppingCart className="h-6 w-6 text-creamello-purple" />
              </div>
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-8">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-30" />
                  <p className="text-lg">No items yet</p>
                  <p className="text-sm">Tap a product to add it to the order</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-4 mb-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex-1">
                          <div className="font-bold text-lg">{item.name}</div>
                          <div className="text-xs text-muted-foreground">GHS {item.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="bg-creamello-purple text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-creamello-purple"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Remove one ${item.name}`}
                            type="button"
                          >
                            –
                          </button>
                          <span className="text-xl font-bold w-8 text-center">{item.quantity}</span>
                          <button
                            className="bg-creamello-purple text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-creamello-purple"
                            onClick={() => addToCart(item)}
                            aria-label={`Add one more ${item.name}`}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                        <div className="ml-4 text-lg font-bold">GHS {(item.price * item.quantity).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xl font-bold border-t pt-4 mt-4">
                    <span>Total</span>
                    <span>GHS {orderTotal.toFixed(2)}</span>
                  </div>
                  {/* Payment Method Selection */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-creamello-purple"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                  {paymentMethod === 'Cash' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">Amount Paid</label>
                      <input
                        type="number"
                        min={orderTotal}
                        step="0.01"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-creamello-purple"
                        value={amountPaid === 0 ? '' : amountPaid}
                        onChange={e => setAmountPaid(Number(e.target.value))}
                        placeholder={`GHS ${orderTotal.toFixed(2)}`}
                      />
                      <div className="flex justify-between mt-2 text-lg font-bold">
                        <span>Change</span>
                        <span>GHS {change.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-6">
                    <Button
                      className="flex-1 bg-creamello-purple hover:bg-creamello-purple-dark text-lg h-14"
                      onClick={placeOrder}
                      disabled={cart.length === 0 || (paymentMethod === 'Cash' && amountPaid < orderTotal)}
                    >
                      Place Order
                    </Button>
                    <Button
                      className="flex-1 h-14 text-lg"
                      variant="outline"
                      onClick={clearCart}
                      disabled={cart.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Staff and Table Selection (moved below for POS flow) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div>
              <label className="block text-sm font-medium mb-1">Table Number</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Table #"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Customer name"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge 
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1 cursor-pointer ${!statusFilter ? 'bg-creamello-purple text-white' : 'bg-secondary'}`}
            >
              All Orders
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'completed' ? 'bg-purple-500 text-white' : 'bg-secondary'}`}
            >
              Completed
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'cancelled' ? 'bg-red-500 text-white' : 'bg-secondary'}`}
            >
              Cancelled
            </Badge>
          </div>
          
          {isAdminOrManager ? (
            <div className="flex gap-2 items-center mb-2">
              {/* Date range picker removed */}
            </div>
          ) : null}
          
          <h2 className="text-xl font-semibold mb-2">
            Orders
          </h2>
          
          <DataTable 
            data={filteredOrders}
            columns={orderColumns}
            title="Order Management"
            searchable={true}
            maxHeight="600px"
            onSearch={(query) => {
              // Implement search functionality for orders
            }}
            onRowClick={handleOrderRowClick}
          />

          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>No orders found</p>
              {statusFilter ? (
                <p className="text-sm">There are no orders with the selected status</p>
              ) : (
                <p className="text-sm">Create a new order to get started</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showReceipt && lastOrder && (
        <div style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh',
          background: 'rgba(0,0,0,0.8)', 
          zIndex: 9999, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <Receipt
              template={receiptTemplate}
              order={convertOrderToReceipt(lastOrder)}
              isPreview={false}
            />
          </div>
          <div style={{
            marginTop: '20px', 
            display: 'flex', 
            gap: '16px'
          }}>
            <button
              onClick={() => {
                window.print();
              }}
              style={{
                padding: '12px 24px', 
                fontSize: '16px', 
                background: '#7c3aed', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🖨️ Print
            </button>
            <button
              onClick={() => setShowReceipt(false)}
              style={{
                padding: '12px 24px', 
                fontSize: '16px', 
                background: '#6b7280', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to cancel order {orderToCancel?.id}?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>No</Button>
            <Button variant="destructive" onClick={confirmCancelOrder}>Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {orderDetails && (
            <div>
              <div><b>Order ID:</b> {orderDetails.id}</div>
              <div><b>Status:</b> {orderDetails.status}</div>
              <div><b>Staff:</b> {orderDetails.staffName}</div>
              {orderDetails.table_number && <div><b>Table:</b> {orderDetails.table_number}</div>}
              {orderDetails.customer_name && <div><b>Customer:</b> {orderDetails.customer_name}</div>}
              <div><b>Created:</b> {orderDetails.created_at ? new Date(orderDetails.created_at).toLocaleString() : ''}</div>
              <div><b>Items:</b></div>
              <ul style={{marginLeft: 16}}>
                {orderDetails.items.map(item => (
                  <li key={item.id || item.flavor_id}>
                    {(item.flavor_name || item.name)} x{item.scoops || item.quantity} (GHS {(item.price || 0).toFixed(2)})
                  </li>
                ))}
              </ul>
              <div><b>Total:</b> GHS {orderDetails.total?.toFixed(2)}</div>
              <div><b>Payment:</b> {orderDetails.payment_method || 'N/A'}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowOrderDetails(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .receipt-print, .receipt-print * { visibility: visible !important; }
        .receipt-print { position: absolute !important; left: 0; top: 0; width: 100vw !important; background: #fff !important; }
      }
      `}</style>
    </div>
  );
};

export default Orders;
