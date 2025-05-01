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
import { formatDistanceToNow, parseISO } from 'date-fns';

const Dashboard = () => {
  const stats = generateDashboardStats();
  const recentSales = generateSales().slice(0, 5);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Total Inventory Value"
          value={`GHS${stats.totalInventoryValue}`}
          description="Total value of all ingredients"
          icon={<Package className="h-4 w-4" />}
          trend="up"
          trendValue="8% "
        />
        <DashboardCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          description="Ingredients below threshold"
          icon={<AlertTriangle className="h-4 w-4" />}
          trend="down"
          trendValue="2 "
        />
        <DashboardCard
          title="Today's Production"
          value={`${stats.todayProduction}L`}
          description="Total gelato produced today"
          icon={<ChartPie className="h-4 w-4" />}
          trend="up"
          trendValue="12% "
        />
        <DashboardCard
          title="Today's Sales"
          value={`GHS${stats.todaySales}`}
          description="Revenue generated today"
          icon={<TrendingUp className="h-4 w-4" />}
          trend="neutral"
          trendValue="3% "
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
                data={stats.monthlySales}
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
            <CardDescription>Sales vs. inventory for top products</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.productPerformance}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="name" stroke="#888888" />
                <YAxis stroke="#888888" />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <Tooltip />
                <Bar dataKey="sales" name="Sales" fill="#9b87f5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inventory" name="Inventory" fill="#FFDEE2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable 
              data={recentSales} 
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
                  cell: (row) => <div className="font-medium">GHS{row.total.toFixed(2)}</div>,
                  accessorKey: "total"
                },
                {
                  header: "Payment",
                  cell: (row) => (
                    <div className="capitalize">{row.paymentMethod}</div>
                  ),
                  accessorKey: "paymentMethod"
                }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Items Expiring Soon</CardTitle>
            <CardDescription>Upcoming expirations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.upcomingExpiry.map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className="mr-4 rounded-full p-2 bg-creamello-yellow">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Expires in {item.daysLeft} days
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
