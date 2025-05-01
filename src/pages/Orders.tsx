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
  { id: "staff1", name: "Sarah Johnson", role: "Waitress" },
  { id: "staff2", name: "Michael Lee", role: "Waitress" },
  { id: "staff3", name: "Anita Patel", role: "Waitress" },
  { id: "staff4", name: "David Osei", role: "Manager" },
];

// 1. Define the new menu structure
const MENU_CATEGORIES = [
  'Flavors',
  'Toppings',
  'Waffles & Pancakes',
  'Sundaes',
  'Milkshakes',
  'Juice',
];

const MENU_ITEMS = [
  // Flavors
  { id: 'flavor-vanilla', name: 'Vanilla', category: 'Flavors', price: 30 },
  { id: 'flavor-chocolate', name: 'Chocolate', category: 'Flavors', price: 30 },
  { id: 'flavor-strawberry', name: 'Strawberry', category: 'Flavors', price: 30 },
  { id: 'flavor-oreo', name: 'Oreo', category: 'Flavors', price: 30 },
  { id: 'flavor-pistachios', name: 'Pistachios', category: 'Flavors', price: 30 },
  { id: 'flavor-kitkat', name: 'Kitkat', category: 'Flavors', price: 30 },
  // Toppings
  { id: 'topping-haribo', name: 'Haribo', category: 'Toppings', price: 10 },
  { id: 'topping-sourjellies', name: 'Sour Jellies', category: 'Toppings', price: 10 },
  { id: 'topping-sprinkles', name: 'Sprinkles', category: 'Toppings', price: 10 },
  { id: 'topping-smarties', name: 'Smarties', category: 'Toppings', price: 10 },
  // Waffles & Pancakes
  { id: 'waffle-bubble', name: 'Bubble Waffle', category: 'Waffles & Pancakes', price: 20 },
  { id: 'waffle-stick', name: 'Waffle Stick', category: 'Waffles & Pancakes', price: 15 },
  { id: 'pancake-mini', name: 'Mini Pancake (10 pieces)', category: 'Waffles & Pancakes', price: 20 },
  // Sundaes
  { id: 'sundae-turtle', name: 'Turtle', category: 'Sundaes', price: 90, description: '2 scoops of ice cream topped with hot fudge or caramel sauce and 2 waffle sticks' },
  { id: 'sundae-tinroof', name: 'Tin Roof', category: 'Sundaes', price: 90, description: '2 scoops of ice cream drizzled with any 2 toppings and 10 pieces of mini pancakes' },
  { id: 'sundae-bubblecream', name: 'Bubble Cream', category: 'Sundaes', price: 70, description: '1 scoop of ice cream with bubble waffle, 1 topping and caramel or chocolate sauce' },
  { id: 'cone', name: 'Cone', category: 'Sundaes', price: 10 },
  // Milkshakes
  { id: 'milkshake-vanilla', name: 'Vanilla Milkshake', category: 'Milkshakes', price: 60 },
  { id: 'milkshake-oreo', name: 'Oreo Milkshake', category: 'Milkshakes', price: 60 },
  { id: 'milkshake-chocolate', name: 'Chocolate Milkshake', category: 'Milkshakes', price: 60 },
  { id: 'milkshake-strawberry', name: 'Strawberry Milkshake', category: 'Milkshakes', price: 60 },
  // Juice
  { id: 'juice-orange', name: 'Orange Juice', category: 'Juice', price: 30 },
  { id: 'juice-pineapple', name: 'Pineapple Juice', category: 'Juice', price: 30 },
  { id: 'juice-watermelon', name: 'Watermelon Juice', category: 'Juice', price: 30 },
];

// 2. Add payment method state
const PAYMENT_METHODS = ['Cash', 'Card', 'Mobile Money'];

const Receipt = ({
  shopName = "CREAMELLO",
  address = "123 Ice Cream Lane, Accra",
  phone = "055-123-4567",
  orderId,
  date,
  staff,
  table,
  customer,
  paymentMethod,
  items,
  total,
  paid,
  change,
}) => (
  <div className="receipt-print" style={{
    width: 320,
    fontFamily: 'monospace',
    background: '#fff',
    color: '#222',
    padding: 16,
    margin: '0 auto'
  }}>
    <div style={{textAlign: 'center', fontWeight: 'bold', fontSize: 18}}>{shopName}</div>
    <div style={{textAlign: 'center', fontSize: 12}}>{address}<br/>Tel: {phone}</div>
    <hr />
    <div style={{textAlign: 'center', fontWeight: 'bold'}}>CASH RECEIPT</div>
    <div style={{fontSize: 12, margin: '8px 0'}}>
      Order: {orderId} <br/>
      Date: {date} <br/>
      Staff: {staff} <br/>
      {table && <>Table: {table} <br/></>}
      {customer && <>Customer: {customer} <br/></>}
      Payment: {paymentMethod}
    </div>
    <hr />
    <div style={{display: 'flex', fontWeight: 'bold'}}>
      <span style={{flex: 2}}>Item</span>
      <span style={{flex: 1, textAlign: 'center'}}>Qty</span>
      <span style={{flex: 1, textAlign: 'right'}}>Price</span>
      <span style={{flex: 1, textAlign: 'right'}}>Total</span>
    </div>
    {items.map(item => (
      <div key={item.id} style={{display: 'flex', fontSize: 12}}>
        <span style={{flex: 2}}>{item.name}</span>
        <span style={{flex: 1, textAlign: 'center'}}>{item.quantity}</span>
        <span style={{flex: 1, textAlign: 'right'}}>GHS {item.price.toFixed(2)}</span>
        <span style={{flex: 1, textAlign: 'right'}}>GHS {(item.price * item.quantity).toFixed(2)}</span>
      </div>
    ))}
    <hr />
    <div style={{display: 'flex', fontWeight: 'bold', fontSize: 16}}>
      <span style={{flex: 3}}>TOTAL</span>
      <span style={{flex: 1, textAlign: 'right'}}>GHS {total.toFixed(2)}</span>
    </div>
    {paymentMethod === 'Cash' && (
      <>
        <div style={{display: 'flex', fontSize: 12}}>
          <span style={{flex: 3}}>Paid</span>
          <span style={{flex: 1, textAlign: 'right'}}>GHS {paid ? paid.toFixed(2) : total.toFixed(2)}</span>
        </div>
        <div style={{display: 'flex', fontSize: 12}}>
          <span style={{flex: 3}}>Change</span>
          <span style={{flex: 1, textAlign: 'right'}}>GHS {change ? change.toFixed(2) : '0.00'}</span>
        </div>
      </>
    )}
    <hr />
    <div style={{textAlign: 'center', fontWeight: 'bold', margin: '12px 0'}}>THANK YOU!</div>
  </div>
);

const Orders = () => {
  // All hooks must be declared here, inside the component:
  const [activeCategory, setActiveCategory] = useState(MENU_CATEGORIES[0]);
  const [cart, setCart] = useState([]); // { id, name, price, quantity }
  const [orderTotal, setOrderTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [showReceipt, setShowReceipt] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<string>("");
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

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cart logic
  const addToCart = (item) => {
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

  // Print receipt
  const printReceipt = () => {
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
    if (startDate) {
      filtered = filtered.filter(order => {
        const date = typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString().slice(0, 10);
        return date >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter(order => {
        const date = typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString().slice(0, 10);
        return date <= endDate;
      });
    }
    setFilteredOrders(filtered);
  }, [orderContext.orders, statusFilter, startDate, endDate]);

  const placeOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Cannot place order",
        description: "Please add at least one item to your order",
        variant: "destructive"
      });
      return;
    }
    if (!selectedStaff) {
      toast({
        title: "Staff selection required",
        description: "Please select a staff member to assign this order",
        variant: "destructive"
      });
      return;
    }
    const staffMember = staffMembers.find(s => s.id === selectedStaff);
    const newOrder = {
      id: `ORD-${Math.floor(Math.random() * 10000)}`,
      items: [...cart],
      total: orderTotal,
      status: 'pending' as 'pending',
      createdAt: new Date(),
      staffId: selectedStaff,
      staffName: staffMember?.name || "Unknown staff",
      tableNumber: tableNumber || undefined,
      customerName: customerName || undefined,
      paymentMethod,
    };
    const insufficientStock = cart.find(item => {
      const product = products.find(p => p.id === item.id);
      return !product || product.availableQuantity < item.quantity;
    });
    if (insufficientStock) {
      toast({
        title: "Insufficient Stock",
        description: `Not enough stock for ${insufficientStock.name}. Please adjust the quantity or restock.`,
        variant: "destructive"
      });
      return;
    }
    orderContext.addOrder(newOrder);
    setLastOrder({ ...newOrder, paid: amountPaid, change });
    setCart([]);
    setTableNumber("");
    setCustomerName("");
    setShowReceipt(true); // Only show, don't print yet
    cart.forEach(item => {
      deductStock(item.id, item.quantity);
      const product = products.find(p => p.id === item.id);
      if (product && product.availableQuantity - item.quantity <= (product as any).threshold) {
        toast({
          title: "Low Stock Alert",
          description: `${product.name} is now low in stock!`,
          variant: "default"
        });
      }
    });
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    // Use the OrderContext to update order status
    orderContext.updateOrderStatus(orderId, newStatus);

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
      accessorKey: "staffName" as keyof Order
    },
    {
      header: "Table/Customer",
      accessorKey: (row: Order) => row.tableNumber ? `Table ${row.tableNumber}` : row.customerName || "N/A"
    },
    {
      header: "Items",
      accessorKey: (row: Order) => `${row.items.reduce((sum, item) => sum + item.scoops, 0)} scoops`
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
          row.status === 'delivered' ? 'bg-purple-500' :
          'bg-red-500'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: "Created",
      accessorKey: (row: Order) => new Date(row.createdAt).toLocaleTimeString()
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof Order,
      cell: (row: Order) => (
        <div className="flex space-x-2">
          {row.status !== 'delivered' && row.status !== 'cancelled' && (
            <Select
              onValueChange={(value) => updateOrderStatus(row.id, value as Order['status'])}
              defaultValue={row.status}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Update" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Change Status</SelectLabel>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={row.status === 'delivered' || row.status === 'cancelled'}
            onClick={() => handleCancelOrder(row)}
          >
            Cancel
          </Button>
        </div>
      )
    },
  ];

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
            {MENU_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full font-bold text-lg transition-colors ${activeCategory === cat ? 'bg-creamello-purple text-white' : 'bg-muted text-creamello-purple border border-creamello-purple'}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Product Grid */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {MENU_ITEMS.filter(item => item.category === activeCategory).map(item => {
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
                    <span className="text-xl font-semibold text-creamello-gray">GHS {item.price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
            {/* Order Cart/Sidebar */}
            <div className="w-full md:w-96 bg-muted rounded-xl shadow-lg flex flex-col p-4 sticky top-4 self-start min-h-[400px] max-h-[80vh] overflow-y-auto">
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
              <label className="block text-sm font-medium mb-1">Staff Member*</label>
              <Select onValueChange={setSelectedStaff} value={selectedStaff}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select waitress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Staff Members</SelectLabel>
                    {staffMembers.map(staff => (
                      <SelectItem key={staff.id} value={staff.id}>{staff.name} ({staff.role})</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
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
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-secondary'}`}
            >
              Pending
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('preparing')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'preparing' ? 'bg-blue-500 text-white' : 'bg-secondary'}`}
            >
              Preparing
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('ready')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'ready' ? 'bg-green-500 text-white' : 'bg-secondary'}`}
            >
              Ready
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('delivered')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'delivered' ? 'bg-purple-500 text-white' : 'bg-secondary'}`}
            >
              Delivered
            </Badge>
            <Badge 
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1 cursor-pointer ${statusFilter === 'cancelled' ? 'bg-red-500 text-white' : 'bg-secondary'}`}
            >
              Cancelled
            </Badge>
          </div>
          
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
            <Button
              onClick={() => exportToCSV(
                filteredOrders,
                'orders_report.csv',
                [
                  { key: 'id', label: 'Order ID' },
                  { key: 'staffName', label: 'Staff' },
                  { key: 'tableNumber', label: 'Table' },
                  { key: 'customerName', label: 'Customer' },
                  { key: 'status', label: 'Status' },
                  { key: 'createdAt', label: 'Created' },
                  { key: 'total', label: 'Total' },
                  { key: 'paymentMethod', label: 'Payment Method' },
                ]
              )}
            >Generate Report</Button>
          </div>
          
          <DataTable 
            data={filteredOrders}
            columns={orderColumns}
            title="Order Management"
            searchable={true}
            onSearch={(query) => {
              // Implement search functionality for orders
            }}
            onRowClick={handleOrderRowClick}
          />

          {activeTab === 'manage' && (
            <Button
              variant="outline"
              onClick={() => exportToCSV(
                filteredOrders,
                'orders.csv',
                [
                  { key: 'id', label: 'Order ID' },
                  { key: 'staffName', label: 'Staff' },
                  { key: 'tableNumber', label: 'Table' },
                  { key: 'customerName', label: 'Customer' },
                  { key: 'status', label: 'Status' },
                  { key: 'createdAt', label: 'Created' },
                  { key: 'total', label: 'Total' },
                  { key: 'paymentMethod', label: 'Payment Method' },
                ]
              )}
              className="mb-2"
            >
              Export CSV
            </Button>
          )}

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
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(255,255,255,0.98)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <Receipt
            shopName="CREAMELLO"
            address="123 Ice Cream Lane, Accra"
            phone="055-123-4567"
            orderId={lastOrder.id}
            date={lastOrder.createdAt.toLocaleString()}
            staff={lastOrder.staffName}
            table={lastOrder.tableNumber}
            customer={lastOrder.customerName}
            paymentMethod={lastOrder.paymentMethod}
            items={lastOrder.items}
            total={lastOrder.total}
            paid={lastOrder.paid}
            change={lastOrder.change}
          />
          <div style={{marginTop: 24, display: 'flex', gap: 16}}>
            <button
              onClick={() => {
                window.print();
              }}
              style={{padding: '8px 24px', fontSize: 16, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4}}
            >
              Print
            </button>
            <button
              onClick={() => setShowReceipt(false)}
              style={{padding: '8px 24px', fontSize: 16, background: '#eee', color: '#222', border: 'none', borderRadius: 4}}
            >
              Close
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
              {orderDetails.tableNumber && <div><b>Table:</b> {orderDetails.tableNumber}</div>}
              {orderDetails.customerName && <div><b>Customer:</b> {orderDetails.customerName}</div>}
              <div><b>Created:</b> {orderDetails.createdAt?.toLocaleString?.() || String(orderDetails.createdAt)}</div>
              <div><b>Items:</b></div>
              <ul style={{marginLeft: 16}}>
                {orderDetails.items.map(item => (
                  <li key={item.id || item.flavorId}>
                    {item.name || item.flavorName} x{item.quantity || item.scoops} (GHS {(item.price || 0).toFixed(2)})
                  </li>
                ))}
              </ul>
              <div><b>Total:</b> GHS {orderDetails.total?.toFixed(2)}</div>
              <div><b>Payment:</b> {orderDetails.paymentMethod || 'N/A'}</div>
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
