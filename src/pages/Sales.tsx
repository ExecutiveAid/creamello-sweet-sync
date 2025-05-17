import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addDays, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

// COLORS for the graphs
const COLORS = ['#9b87f5', '#f587b3', '#87d3f5', '#93f587', '#f5d687', '#f58787', '#87f5e2', '#c387f5'];

// Define the Peak Hours type
interface HourlyData {
  hour: string;
  orderCount: number;
  revenue: number;
  displayHour: string; // More readable hour format
}

// First add the necessary interface definitions near the top
interface ProductPerformanceRow {
  name: string;
  sales: number;
}

interface PaymentMethodRow {
  name: string;
  value: number;
}

// Add EmployeeSalesRow interface
interface EmployeeSalesRow {
  name: string;
  amount: number;
}

// Add DailySalesRow interface
interface DailySalesRow {
  day: string;
  amount: number;
}

// Add interface for OrderStatusData
interface OrderStatusData {
  name: string;
  value: number;
  color: string;
}

const Sales = () => {
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const navigate = useNavigate();
  
  // Redirect non-admin/non-manager staff to dashboard
  useEffect(() => {
    if (staff && !isAdminOrManager) {
      navigate('/dashboard');
    }
  }, [staff, isAdminOrManager, navigate]);
  
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [totalStockValue, setTotalStockValue] = useState(0);
  
  // Add new state variables for Product Performance and Payment Methods
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  // Add state for employee sales
  const [employeeSales, setEmployeeSales] = useState<EmployeeSalesRow[]>([]);
  // Add state for daily sales
  const [dailySales, setDailySales] = useState<DailySalesRow[]>([]);
  // Add state for order status data
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusData[]>([]);
  
  // Set default date range to past 24 hours (no longer exposed to user)
  const startDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSalesData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all orders including both completed and cancelled
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, created_at, payment_method, total, staff_id, status, order_items(id, flavor_id, flavor_name, scoops, price)')
          .in('status', ['completed', 'cancelled'])
          .order('created_at', { ascending: false });
        if (ordersError) throw ordersError;

        // Fetch staff names to display in the chart
        const { data: staffMembers, error: staffError } = await supabase
          .from('staff')
          .select('id, name');
        if (staffError) throw staffError;

        // Create staff lookup map
        const staffMap = (staffMembers || []).reduce((acc: Record<string, string>, member: any) => {
          acc[member.id] = member.name;
          return acc;
        }, {});

        // Flatten order items into sales rows
        const salesRows: any[] = [];
        (orders || []).forEach(order => {
          (order.order_items || []).forEach(item => {
            salesRows.push({
              id: item.id,
              date: order.created_at.slice(0, 10),
              productName: item.flavor_name || item.flavor_id || 'N/A',
              quantity: item.scoops || 1,
              unitPrice: item.price,
              total: item.price * (item.scoops || 1),
              paymentMethod: order.payment_method || 'N/A',
              staffId: order.staff_id,
              staffName: staffMap[order.staff_id] || 'Unknown',
            });
          });
        });
        setSales(salesRows);
        setFilteredSales(salesRows);

        // Weekly sales (last 8 weeks) - we still calculate this even if not shown
        const salesByWeek: Record<string, number> = {};
        (orders || []).forEach(order => {
          const orderDate = new Date(order.created_at);
          const weekStart = startOfWeek(orderDate, { weekStartsOn: 1 }); // Week starts on Monday
          const key = format(weekStart, 'yyyy-MM-dd');
          salesByWeek[key] = (salesByWeek[key] || 0) + (order.total || 0);
        });

        const weeks = [];
        const now = new Date();
        for (let i = 7; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const key = format(weekStart, 'yyyy-MM-dd');
          
          // Format as "MMM dd-dd" (e.g., "Jul 10-16")
          const weekLabel = `${format(weekStart, 'MMM dd')}-${format(weekEnd, 'dd')}`;
          
          weeks.push({
            week: weekLabel,
            amount: salesByWeek[key] || 0
          });
        }
        setWeeklySales(weeks);
        
        // Daily Sales (last 14 days)
        const salesByDay: Record<string, number> = {};
        (orders || []).forEach(order => {
          const day = order.created_at.slice(0, 10);
          salesByDay[day] = (salesByDay[day] || 0) + (order.total || 0);
        });
        
        const days = [];
        for (let i = 13; i >= 0; i--) {
          const d = subDays(now, i);
          const key = format(d, 'yyyy-MM-dd');
          days.push({
            day: format(d, 'dd MMM'),
            amount: salesByDay[key] || 0
          });
        }
        setDailySales(days);
        
        // Calculate hourly data for peak hours graph
        const hourlyStats: Record<string, { orderCount: number, revenue: number }> = {};
        
        // Initialize all 24 hours of the day with zero values
        for (let i = 0; i < 24; i++) {
          const hourLabel = i.toString().padStart(2, '0') + ':00';
          hourlyStats[hourLabel] = { orderCount: 0, revenue: 0 };
        }
        
        // Populate with real data
        (orders || []).forEach(order => {
          if (order.status === 'completed') {
            try {
              // Extract hour from the timestamp
              // Ensure we're parsing the timestamp correctly
              let orderDate;
              if (order.created_at.includes('T')) {
                // ISO string format
                orderDate = new Date(order.created_at);
              } else {
                // Add time if it's just a date
                orderDate = new Date(order.created_at + (order.created_at.includes(':') ? '' : 'T00:00:00'));
              }
              
              const hour = orderDate.getHours();
              const hourLabel = hour.toString().padStart(2, '0') + ':00';
              
              // Increment the order count and add to revenue for this hour
              hourlyStats[hourLabel].orderCount += 1;
              hourlyStats[hourLabel].revenue += (order.total || 0);
            } catch (err) {
              console.error("Error processing order timestamp:", err, order);
            }
          }
        });
        
        // Convert to array for the chart
        const hourlyDataArray = Object.entries(hourlyStats)
          .map(([hour, data]) => {
            // Create more readable display hour format (12-hour format with AM/PM)
            const hourNum = parseInt(hour.split(':')[0]);
            const displayHour = hourNum === 0 ? '12 AM' : 
                                hourNum < 12 ? `${hourNum} AM` : 
                                hourNum === 12 ? '12 PM' : 
                                `${hourNum - 12} PM`;
            
            return {
              hour,
              orderCount: data.orderCount,
              revenue: data.revenue,
              displayHour
            };
          })
          .sort((a, b) => {
            // Sort by hour (00:00 to 23:00)
            return parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0]);
          });
        
        setHourlyData(hourlyDataArray);

        // Product Performance (top-selling menu items)
        const itemSales: Record<string, { name: string, sales: number }> = {};
        (orders || []).forEach(order => {
          (order.order_items || []).forEach(item => {
            const name = item.flavor_name || item.flavor_id || 'N/A';
            itemSales[name] = itemSales[name] || { name, sales: 0 };
            itemSales[name].sales += item.scoops || 1;
          });
        });
        const perf = Object.values(itemSales)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4);
        setProductPerformance(perf);

        // Calculate payment method distribution
        const paymentMethodCounts: Record<string, number> = {};
        (orders || []).forEach(order => {
          if (order.status === 'completed') {
            const method = order.payment_method || 'Unknown';
            paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
          }
        });

        // Convert to array for the chart
        const paymentMethodsArray = Object.entries(paymentMethodCounts)
          .map(([name, value]) => ({ 
            name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
            value 
          }))
          .sort((a, b) => b.value - a.value);

        setPaymentMethods(paymentMethodsArray);
        
        // Calculate sales per employee
        const salesByEmployee: Record<string, number> = {};
        (orders || []).forEach(order => {
          if (order.staff_id) {
            const employeeName = staffMap[order.staff_id] || `Staff ID: ${order.staff_id}`;
            salesByEmployee[employeeName] = (salesByEmployee[employeeName] || 0) + (order.total || 0);
          }
        });
        
        // Convert to array and sort by sales amount
        const employeeSalesArray = Object.entries(salesByEmployee)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);
          
        setEmployeeSales(employeeSalesArray);
        
        // Process orders by status (completed vs cancelled)
        const ordersByStatus: Record<string, number> = {};
        (orders || []).forEach(order => {
          const status = order.status || 'unknown';
          ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
        });
        
        // Prepare data for the chart with specific colors
        const statusColors: Record<string, string> = {
          completed: "#4CAF50", // green
          cancelled: "#F44336", // red
          unknown: "#9E9E9E"    // gray
        };
        
        const statusData = Object.entries(ordersByStatus)
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
            value,
            color: statusColors[name] || "#9E9E9E" // Default to gray if status not in our color map
          }))
          .sort((a, b) => b.value - a.value);
          
        setOrderStatusData(statusData);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load sales data');
      } finally {
        setLoading(false);
      }
    };
    fetchSalesData();
    fetchInventoryData();
  }, []);

  // Update filtering to use fixed 24 hour window
  useEffect(() => {
    let filtered = sales;
    if (searchQuery) {
      filtered = filtered.filter(sale => sale.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    // Filter to only show last 24 hours of sales
    const oneDayAgo = subDays(new Date(), 1);
    filtered = filtered.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= oneDayAgo;
    });
    
    setFilteredSales(filtered);
  }, [searchQuery, sales]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Re-fetch data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, payment_method, total, staff_id, status, order_items(id, flavor_id, flavor_name, scoops, price)')
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });
      if (ordersError) throw ordersError;

      // Re-fetch staff names
      const { data: staffMembers, error: staffError } = await supabase
        .from('staff')
        .select('id, name');
      if (staffError) throw staffError;

      // Create staff lookup map
      const staffMap = (staffMembers || []).reduce((acc: Record<string, string>, member: any) => {
        acc[member.id] = member.name;
        return acc;
      }, {});
      
      const salesRows: any[] = [];
      (orders || []).forEach(order => {
        (order.order_items || []).forEach(item => {
          salesRows.push({
            id: item.id,
            date: order.created_at.slice(0, 10),
            productName: item.flavor_name || item.flavor_id || 'N/A',
            quantity: item.scoops || 1,
            unitPrice: item.price,
            total: item.price * (item.scoops || 1),
            paymentMethod: order.payment_method || 'N/A',
            staffId: order.staff_id,
            staffName: staffMap[order.staff_id] || 'Unknown',
          });
        });
      });
      setSales(salesRows);
      setFilteredSales(salesRows);
      
      // Weekly sales (last 8 weeks)
      const salesByWeek: Record<string, number> = {};
      (orders || []).forEach(order => {
        const orderDate = new Date(order.created_at);
        const weekStart = startOfWeek(orderDate, { weekStartsOn: 1 }); // Week starts on Monday
        const key = format(weekStart, 'yyyy-MM-dd');
        salesByWeek[key] = (salesByWeek[key] || 0) + (order.total || 0);
      });

      const weeks = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const key = format(weekStart, 'yyyy-MM-dd');
        
        // Format as "MMM dd-dd" (e.g., "Jul 10-16")
        const weekLabel = `${format(weekStart, 'MMM dd')}-${format(weekEnd, 'dd')}`;
        
        weeks.push({
          week: weekLabel,
          amount: salesByWeek[key] || 0
        });
      }
      setWeeklySales(weeks);
      
      // Calculate hourly data
      const hourlyStats: Record<string, { orderCount: number, revenue: number }> = {};
      
      // Initialize all 24 hours
      for (let i = 0; i < 24; i++) {
        const hourLabel = i.toString().padStart(2, '0') + ':00';
        hourlyStats[hourLabel] = { orderCount: 0, revenue: 0 };
      }
      
      // Populate with real data
      (orders || []).forEach(order => {
        if (order.status === 'completed') {
          try {
            // Extract hour from the timestamp
            // Ensure we're parsing the timestamp correctly
            let orderDate;
            if (order.created_at.includes('T')) {
              // ISO string format
              orderDate = new Date(order.created_at);
            } else {
              // Add time if it's just a date
              orderDate = new Date(order.created_at + (order.created_at.includes(':') ? '' : 'T00:00:00'));
            }
            
            const hour = orderDate.getHours();
            const hourLabel = hour.toString().padStart(2, '0') + ':00';
            
            // Increment the order count and add to revenue for this hour
            hourlyStats[hourLabel].orderCount += 1;
            hourlyStats[hourLabel].revenue += (order.total || 0);
          } catch (err) {
            console.error("Error processing order timestamp:", err, order);
          }
        }
      });
      
      // Convert to array for the chart
      const hourlyDataArray = Object.entries(hourlyStats)
        .map(([hour, data]) => {
          // Create more readable display hour format (12-hour format with AM/PM)
          const hourNum = parseInt(hour.split(':')[0]);
          const displayHour = hourNum === 0 ? '12 AM' : 
                              hourNum < 12 ? `${hourNum} AM` : 
                              hourNum === 12 ? '12 PM' : 
                              `${hourNum - 12} PM`;
          
          return {
            hour,
            orderCount: data.orderCount,
            revenue: data.revenue,
            displayHour
          };
        })
        .sort((a, b) => {
          return parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0]);
        });
      
      setHourlyData(hourlyDataArray);
      
      // Also refresh the inventory data
      await fetchInventoryData();
      
      // Process orders by status (completed vs cancelled)
      const ordersByStatus: Record<string, number> = {};
      (orders || []).forEach(order => {
        const status = order.status || 'unknown';
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      });
      
      // Prepare data for the chart with specific colors
      const statusColors: Record<string, string> = {
        completed: "#4CAF50", // green
        cancelled: "#F44336", // red
        unknown: "#9E9E9E"    // gray
      };
      
      const statusData = Object.entries(ordersByStatus)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
          value,
          color: statusColors[name] || "#9E9E9E" // Default to gray if status not in our color map
        }))
        .sort((a, b) => b.value - a.value);
        
      setOrderStatusData(statusData);
      
      toast({
        title: 'Data Refreshed',
        description: 'Sales data has been refreshed.'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to refresh sales data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate sales statistics
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySales = sales.filter(sale => sale.date === today).reduce((acc, sale) => acc + sale.total, 0);

  // Current month sales
  const currentMonthSales = sales.filter(sale => {
    const saleDate = parseISO(sale.date);
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return saleDate >= monthStart && saleDate <= monthEnd;
  }).reduce((acc, sale) => acc + sale.total, 0);

  // Calculate average order value
  const avgOrderValue = sales.length > 0 
    ? sales.reduce((acc, sale) => acc + sale.total, 0) / sales.length
    : 0;

  // Add a function to fetch inventory data and calculate total stock value
  const fetchInventoryData = async () => {
    try {
      const { data: inventoryItems, error } = await supabase
        .from('inventory')
        .select('*');
      
      if (error) {
        console.error("Error fetching inventory:", error);
        return;
      }
      
      // Calculate total stock value
      const stockValue = (inventoryItems || []).reduce((total, item) => {
        return total + (item.available_quantity * item.price_per_unit);
      }, 0);
      
      setTotalStockValue(stockValue);
    } catch (err) {
      console.error("Error in fetchInventoryData:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {isAdminOrManager ? 'Admin Dashboard' : 'Sales'}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS {todaySales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month to Date</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS {currentMonthSales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Sales Value</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS {avgOrderValue.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock Value</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS {totalStockValue.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales</CardTitle>
            <CardDescription>Revenue over the past 14 days</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={loading ? [] : dailySales}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9b87f5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#9b87f5" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#888888" />
                <YAxis stroke="#888888" />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#9b87f5" 
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours & Slow Hours</CardTitle>
            <CardDescription>Order volume by hour of day</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={loading ? [] : hourlyData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayHour" 
                  stroke="#888888"
                  tick={{ fontSize: 11 }}
                  interval={1}
                />
                <YAxis stroke="#888888" />
                <Tooltip
                  formatter={(value) => [`${value} orders`, 'Order Count']}
                  labelFormatter={(displayHour) => `Time: ${displayHour}`}
                />
                <Bar 
                  dataKey="orderCount" 
                  name="Order Count" 
                  fill="#9b87f5" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Move Product Performance and Payment Methods chart above the table */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Sales for top products</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={loading ? [] : productPerformance}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="name" stroke="#888888" />
                <YAxis stroke="#888888" />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <Tooltip />
                <Bar dataKey="sales" name="Sales" fill="#9b87f5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Sales per Employee</CardTitle>
            <CardDescription>Distribution of sales by staff member</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loading ? [] : employeeSales}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                  nameKey="name"
                >
                  {employeeSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `GHS${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Payment Methods and Order Status charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Distribution of payment types</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loading ? [] : paymentMethods}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `${value} orders`}
                  labelFormatter={(name) => `Payment: ${name}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Add Order Status chart */}
        <Card>
          <CardHeader>
            <CardTitle>Order Completion</CardTitle>
            <CardDescription>Completed vs. Cancelled Orders</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={loading ? [] : orderStatusData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(value) => `${value} orders`} />
                <Legend />
                <Bar dataKey="value" name="Orders">
                  {orderStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Move the sales table to the bottom and make its content scrollable */}
      <h2 className="text-xl font-semibold mb-2">
        Sales from the past 24 hours
      </h2>
      
      <Card>
        <CardContent>
          <div style={{ 
            maxHeight: '500px',
            overflow: 'auto',
            borderRadius: '0.5rem'
          }}>
            <table className="w-full">
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                backgroundColor: 'white',
                zIndex: 10,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
              }}>
                <tr>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Product</th>
                  <th className="p-3 text-left font-medium">Quantity</th>
                  <th className="p-3 text-left font-medium">Unit Price</th>
                  <th className="p-3 text-left font-medium">Total</th>
                  <th className="p-3 text-left font-medium">Payment</th>
                  <th className="p-3 text-left font-medium">Staff</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-4">Loading sales data...</td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-4">No sales data found</td>
                  </tr>
                ) : (
                  filteredSales.map((sale, index) => (
                    <tr key={sale.id || index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="p-3 border-t">{sale.date}</td>
                      <td className="p-3 border-t">{sale.productName}</td>
                      <td className="p-3 border-t">{sale.quantity}</td>
                      <td className="p-3 border-t">GHS {sale.unitPrice.toFixed(2)}</td>
                      <td className="p-3 border-t font-medium">GHS {sale.total.toFixed(2)}</td>
                      <td className="p-3 border-t capitalize">{sale.paymentMethod}</td>
                      <td className="p-3 border-t">{sale.staffName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Search input */}
          <div className="mt-4">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Sales;
