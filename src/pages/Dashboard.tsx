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
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Type definitions for dashboard data
interface MonthlySalesRow {
  month: string;
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
  const [monthlySales, setMonthlySales] = useState<MonthlySalesRow[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceRow[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all delivered orders and their items
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, created_at, payment_method, total, order_items(id, flavor_id, flavor_name, scoops, price)')
          .eq('status', 'delivered')
          .order('created_at', { ascending: false });
        if (ordersError) throw ordersError;

        // Today's Sales
        const today = format(new Date(), 'yyyy-MM-dd');
        const todaySalesSum = (orders || [])
          .filter(order => order.created_at.slice(0, 10) === today)
          .reduce((sum, order) => sum + (order.total || 0), 0);
        setTodaySales(todaySalesSum);

        // Monthly Sales (last 6 months)
        const salesByMonth: Record<string, number> = {};
        (orders || []).forEach(order => {
          const d = new Date(order.created_at);
          const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
          salesByMonth[key] = (salesByMonth[key] || 0) + (order.total || 0);
        });
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
          months.push({
            month: d.toLocaleString('default', { month: 'short' }),
            amount: salesByMonth[key] || 0
          });
        }
        setMonthlySales(months);

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

        // Recent Sales (last 5 items from delivered orders)
        const sales = [];
        (orders || []).forEach(order => {
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
        setRecentSales(sales.slice(0, 5));
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
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
          value={loading ? 'Loading...' : `GHS${todaySales.toFixed(2)}`}
          description="Revenue generated today"
          icon={null}
          trend="neutral"
          trendValue=""
        />
        <DashboardCard
          title="Monthly Sales"
          value={loading ? 'Loading...' : `GHS${monthlySales.reduce((acc, m) => acc + m.amount, 0).toFixed(2)}`}
          description="Revenue this month"
          icon={null}
          trend="neutral"
          trendValue=""
        />
        <DashboardCard
          title="Top Product"
          value={loading || productPerformance.length === 0 ? 'Loading...' : productPerformance[0].name}
          description="Best selling menu item"
          icon={null}
          trend="up"
          trendValue=""
        />
        <DashboardCard
          title="Recent Sales"
          value={loading ? 'Loading...' : recentSales.length}
          description="Transactions today"
          icon={null}
          trend="neutral"
          trendValue=""
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
            <CardDescription>Sales revenue over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={loading ? [] : monthlySales}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9b87f5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#9b87f5" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#888888" />
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
          <CardDescription>Latest transactions</CardDescription>
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
                cell: (row: RecentSaleRow) => <div className="font-medium">GHS{row.total.toFixed(2)}</div>,
                accessorKey: "total"
              },
              {
                header: "Payment",
                cell: (row: RecentSaleRow) => (
                  <div className="capitalize">{row.paymentMethod}</div>
                ),
                accessorKey: "paymentMethod"
              }
            ]}
          />
          {loading && <div className="text-center text-muted-foreground py-4">Loading recent sales...</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
