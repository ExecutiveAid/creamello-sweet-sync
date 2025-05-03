import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const Sales = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthlySales, setMonthlySales] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSalesData = async () => {
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
            });
          });
        });
        setSales(salesRows);
        setFilteredSales(salesRows);

        // Monthly sales (last 6 months)
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
      } catch (err: any) {
        setError(err.message || 'Failed to load sales data');
      } finally {
        setLoading(false);
      }
    };
    fetchSalesData();
  }, []);

  // Handle search and date filtering
  useEffect(() => {
    let filtered = sales;
    if (searchQuery) {
      filtered = filtered.filter(sale => sale.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (startDate) {
      filtered = filtered.filter(sale => sale.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(sale => sale.date <= endDate);
    }
    setFilteredSales(filtered);
  }, [searchQuery, sales, startDate, endDate]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Re-fetch data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, payment_method, total, order_items(id, flavor_id, flavor_name, scoops, price)')
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });
      if (ordersError) throw ordersError;
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
          });
        });
      });
      setSales(salesRows);
      setFilteredSales(salesRows);
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

  const currentMonthSales = sales.filter(sale => {
    const saleDate = parseISO(sale.date);
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return saleDate >= monthStart && saleDate <= monthEnd;
  }).reduce((acc, sale) => acc + sale.total, 0);

  const avgOrderValue = sales.length > 0 
    ? sales.reduce((acc, sale) => acc + sale.total, 0) / sales.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => exportToCSV(
              filteredSales,
              'sales_report.csv',
              [
                { key: 'date', label: 'Date' },
                { key: 'productName', label: 'Product' },
                { key: 'quantity', label: 'Quantity' },
                { key: 'unitPrice', label: 'Unit Price' },
                { key: 'total', label: 'Total' },
                { key: 'paymentMethod', label: 'Payment Method' },
              ]
            )}
            disabled={loading}
          >
            Generate Report
          </Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS{todaySales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month to Date</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS{currentMonthSales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
            <CardDescription className="text-2xl font-bold">GHS{avgOrderValue.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Monthly Sales</CardTitle>
          <CardDescription>Revenue over the past 6 months</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={loading ? [] : monthlySales}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" stroke="#888888" />
              <YAxis stroke="#888888" />
              <Tooltip />
              <Bar dataKey="amount" name="Sales Revenue" fill="#9b87f5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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
      <Button
        variant="outline"
        onClick={() => exportToCSV(
          filteredSales,
          'sales.csv',
          [
            { key: 'date', label: 'Date' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'total', label: 'Total' },
            { key: 'paymentMethod', label: 'Payment Method' },
          ]
        )}
        disabled={loading}
      >
        Export CSV
      </Button>
      <DataTable
        data={loading ? [] : filteredSales}
        columns={[
          {
            header: "Date",
            accessorKey: "date",
          },
          {
            header: "Product",
            accessorKey: "productName",
          },
          {
            header: "Quantity",
            accessorKey: "quantity",
          },
          {
            header: "Unit Price",
            cell: (row: any) => <div>GHS{row.unitPrice.toFixed(2)}</div>,
            accessorKey: "unitPrice"
          },
          {
            header: "Total",
            cell: (row: any) => <div className="font-medium">GHS{row.total.toFixed(2)}</div>,
            accessorKey: "total"
          },
          {
            header: "Payment",
            cell: (row: any) => <div className="capitalize">{row.paymentMethod}</div>,
            accessorKey: "paymentMethod"
          },
        ]}
        title="Sales Transactions"
        searchable={true}
        onSearch={setSearchQuery}
      />
    </div>
  );
};

export default Sales;
