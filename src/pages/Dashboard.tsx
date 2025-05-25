import { useEffect, useState } from 'react';
import { ChartPie, Package, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateDashboardStats, generateProducts, generateSales } from '@/data/mockData';
import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { DataTable } from '@/components/ui/data-table';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// COLORS for the employee pie chart
const EMPLOYEE_COLORS = ['#9b87f5', '#f587b3', '#87d3f5', '#93f587', '#f5d687', '#f58787', '#87f5e2', '#c387f5'];

// Type definitions for dashboard data
interface DailySalesRow {
  day: string;
  amount: number;
}

interface ProductPerformanceRow {
  name: string;
  sales: number;
}

interface RecentSaleRow {
  id: string;
  productName: string;
  date: string;
  quantity: number;
  total: number;
  paymentMethod: string;
}

interface EmployeeSalesRow {
  name: string;
  amount: number;
}

// Add interface for OrdersPerEmployeeRow
interface OrdersPerEmployeeRow {
  name: string;
  orders: number;
}

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [dailySales, setDailySales] = useState<DailySalesRow[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleRow[]>([]);
  const [employeeSales, setEmployeeSales] = useState<EmployeeSalesRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [salesPast24Hours, setSalesPast24Hours] = useState(0);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceRow[]>([]);
  // Add state for orders per employee
  const [ordersPerEmployee, setOrdersPerEmployee] = useState<OrdersPerEmployeeRow[]>([]);

  // Process orders data function
  const processOrdersData = (orders: any[]) => {
    try {
      // Today's Sales
      const today = format(new Date(), 'yyyy-MM-dd');
      const todaySalesSum = (orders || [])
        .filter(order => order.created_at.slice(0, 10) === today)
        .reduce((sum, order) => sum + (order.total || 0), 0);
      setTodaySales(todaySalesSum);

      // Count orders from today (same period as Today's Sales)
      const todayOrdersCount = (orders || [])
        .filter(order => {
          return order.created_at.slice(0, 10) === today && order.status === 'completed';
        }).length;
      
      setSalesPast24Hours(todayOrdersCount);

      // Daily Sales (last 14 days) - We'll keep this calculation but not display the chart
      const salesByDay: Record<string, number> = {};
      (orders || []).forEach(order => {
        const day = order.created_at.slice(0, 10);
        salesByDay[day] = (salesByDay[day] || 0) + (order.total || 0);
      });
      
      const days = [];
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, 'yyyy-MM-dd');
        days.push({
          day: format(d, 'dd MMM'),
          amount: salesByDay[key] || 0
        });
      }
      setDailySales(days);

      // 10 Most Recent Individual Sale Items (from completed orders)
      let allSaleItems: any[] = [];
      (orders || []).forEach(order => {
        if (order.status === 'completed') {
          (order.order_items || []).forEach((item: any) => {
            allSaleItems.push({
              id: item.id,
              productName: item.flavor_name || item.flavor_id || 'N/A',
              // Store raw date for accurate sorting, format later if needed or directly in table cell
              date: new Date(order.created_at), 
              quantity: item.scoops || 1,
              total: item.price * (item.scoops || 1),
              paymentMethod: order.payment_method || 'N/A',
            });
          });
        }
      });

      // Sort all sale items by date (newest first)
      allSaleItems.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Take only the 10 most recent sale items and format date for display
      const recentTop10SaleItems = allSaleItems.slice(0, 10).map(saleItem => ({
        ...saleItem,
        date: saleItem.date.toLocaleString(), // Format date for display here
      }));
      
      setRecentSales(recentTop10SaleItems);

      // Employee sales data fetching needs staff info
      const fetchEmployeeSalesData = async () => {
        try {
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
          
          // Calculate sales per employee - Daily reset
          const salesByEmployee: Record<string, number> = {};
          (orders || []).forEach(order => {
            // Only process today's orders
            if (order.created_at.slice(0, 10) !== today) return;
            
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
          
          // Calculate orders per employee (count of orders instead of cash value) - Daily reset
          const ordersByEmployee: Record<string, number> = {};
          (orders || []).forEach(order => {
            // Only process today's orders
            if (order.created_at.slice(0, 10) !== today) return;
            
            if (order.staff_id && order.status === 'completed') {
              const employeeName = staffMap[order.staff_id] || `Staff ID: ${order.staff_id}`;
              ordersByEmployee[employeeName] = (ordersByEmployee[employeeName] || 0) + 1;
            }
          });
          
          // Convert to array and sort by order count
          const ordersPerEmployeeArray = Object.entries(ordersByEmployee)
            .map(([name, orders]) => ({ name, orders }))
            .sort((a, b) => b.orders - a.orders);
            
          setOrdersPerEmployee(ordersPerEmployeeArray);
        } catch (err: any) {
          console.error("Error fetching employee sales data:", err);
        }
      };
  
      fetchEmployeeSalesData();
      
      // Product Performance (top-selling menu items) - Daily reset
      const itemSales: Record<string, { name: string, sales: number }> = {};
      (orders || []).forEach(order => {
        // Only process today's orders
        if (order.created_at.slice(0, 10) !== today) return;
        
        (order.order_items || []).forEach((item: any) => {
          const name = item.flavor_name || item.flavor_id || 'N/A';
          itemSales[name] = itemSales[name] || { name, sales: 0 };
          itemSales[name].sales += item.scoops || 1;
        });
      });
      const perf = Object.values(itemSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 4);
      setProductPerformance(perf);
      
    } catch (err: any) {
      setError(err.message || 'Error processing data');
    }
  };

  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all orders and their items
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, created_at, payment_method, total, status, staff_id, order_items(id, flavor_id, flavor_name, scoops, price)')
          .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        
        // Process the data
        processOrdersData(orders || []);

        // Set up real-time subscription for orders table
        subscription = supabase
          .channel('orders-and-items-changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
          }, handleDataRefresh)
          .on('postgres_changes', {
            event: 'UPDATE',  // Specific to status changes (completed)
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.completed',
          }, handleDataRefresh)
          .subscribe();

      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    // Handler for real-time updates
    const handleDataRefresh = async () => {
      console.log("Real-time update detected, refreshing data...");
      try {
        // Fetch all orders to properly filter in the processOrdersData function
        const { data: refreshedOrders, error } = await supabase
          .from('orders')
          .select('id, created_at, payment_method, total, status, staff_id, order_items(id, flavor_id, flavor_name, scoops, price)')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (refreshedOrders) {
          processOrdersData(refreshedOrders);
        }
      } catch (err: any) {
        console.error("Error refreshing data:", err);
        setError(err.message || 'Error refreshing data');
      }
    };

    fetchDashboardData();

    // Cleanup subscription on component unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Today's Sales"
          value={loading ? 'Loading...' : `GHS ${todaySales.toFixed(2)}`}
          description="Revenue generated today"
          icon={null}
          trend={null}
          trendValue=""
        />
        <DashboardCard
          title="Orders Today"
          value={loading ? 'Loading...' : salesPast24Hours.toString()}
          description="Orders made today"
          icon={null}
          trend={null}
          trendValue=""
        />
        <DashboardCard
          title="Least Selling Product"
          value={loading || !productPerformance.length ? 'Loading...' : productPerformance.length > 0 ? (productPerformance[productPerformance.length - 1]?.name || 'N/A') : 'N/A'}
          description="Product with lowest sales"
          icon={null}
          trend={null}
          trendValue=""
        />
        <DashboardCard
          title="Top Product"
          value={loading || !productPerformance.length ? 'Loading...' : productPerformance[0]?.name || 'N/A'}
          description="Most popular item"
          icon={null}
          trend={null}
          trendValue=""
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders per Employee</CardTitle>
            <CardDescription>Distribution of orders processed by staff member</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loading ? [] : ordersPerEmployee}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="orders"
                  nameKey="name"
                >
                  {ordersPerEmployee.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} orders`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
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
      </div>
    </div>
  );
};

export default Dashboard;
