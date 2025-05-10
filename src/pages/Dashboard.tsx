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
  YAxis 
} from 'recharts';
import { DataTable } from '@/components/ui/data-table';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [dailySales, setDailySales] = useState<DailySalesRow[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceRow[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Process orders data function
  const processOrdersData = (orders: any[]) => {
    try {
      // Today's Sales
      const today = format(new Date(), 'yyyy-MM-dd');
      const todaySalesSum = (orders || [])
        .filter(order => order.created_at.slice(0, 10) === today)
        .reduce((sum, order) => sum + (order.total || 0), 0);
      setTodaySales(todaySalesSum);

      // Daily Sales (last 14 days)
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

      // 10 Most Recent Sales (completed orders only)
      const sales = [];
      
      // Filter completed orders and sort by date (newest first)
      const completedOrders = (orders || [])
        .filter(order => order.status === 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10); // Take only 10 most recent
      
      completedOrders.forEach(order => {
        (order.order_items || []).forEach(item => {
          sales.push({
            id: item.id,
            productName: item.flavor_name || item.flavor_id || 'N/A',
            date: new Date(order.created_at).toLocaleString(),
            quantity: item.scoops || 1,
            total: item.price * (item.scoops || 1),
            paymentMethod: order.payment_method || 'N/A',
          });
        });
      });
      
      setRecentSales(sales);
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
          .select('id, created_at, payment_method, total, status, order_items(id, flavor_id, flavor_name, scoops, price)')
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
          .select('id, created_at, payment_method, total, status, order_items(id, flavor_id, flavor_name, scoops, price)')
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
          title="Weekly Sales"
          value={loading ? 'Loading...' : `GHS ${dailySales.slice(-7).reduce((acc, d) => acc + d.amount, 0).toFixed(2)}`}
          description="Revenue this week"
          icon={null}
          trend={null}
          trendValue=""
        />
        <DashboardCard
          title="Top Product"
          value={loading || productPerformance.length === 0 ? 'Loading...' : productPerformance[0].name}
          description="Best selling menu item"
          icon={null}
          trend={null}
          trendValue=""
        />
        <DashboardCard
          title="Recent Sales"
          value={loading ? 'Loading...' : recentSales.length}
          description="Transactions today"
          icon={null}
          trend={null}
          trendValue=""
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales</CardTitle>
            <CardDescription>Sales revenue over the past 14 days</CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
          <CardDescription>10 most recent completed orders</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={loading ? [] : recentSales}
            columns={[
              {
                header: "Product",
                accessorKey: "productName",
              },
              {
                header: "Date",
                accessorKey: "date",
              },
              {
                header: "Quantity",
                accessorKey: "quantity",
              },
              {
                header: "Total",
                cell: (row) => <div>GHS {row.total.toFixed(2)}</div>,
                accessorKey: "total",
              },
              {
                header: "Payment",
                cell: (row) => <div className="capitalize">{row.paymentMethod}</div>,
                accessorKey: "paymentMethod"
              }
            ]}
          />
          {loading && <div className="text-center text-muted-foreground py-4">Loading recent sales...</div>}
          {!loading && recentSales.length === 0 && <div className="text-center text-muted-foreground py-4">No completed orders found</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
