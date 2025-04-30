
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sale, generateSales, generateDashboardStats } from '@/data/mockData';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthlySales, setMonthlySales] = useState<any[]>([]);

  // Load mock data
  useEffect(() => {
    const salesData = generateSales();
    const stats = generateDashboardStats();
    setSales(salesData);
    setFilteredSales(salesData);
    setMonthlySales(stats.monthlySales);
  }, []);

  // Handle search
  useEffect(() => {
    if (searchQuery) {
      const filtered = sales.filter(sale => 
        sale.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSales(filtered);
    } else {
      setFilteredSales(sales);
    }
  }, [searchQuery, sales]);

  const handleRefresh = () => {
    const salesData = generateSales();
    setSales(salesData);
    setFilteredSales(salesData);
    toast({
      title: "Data Refreshed",
      description: "Sales data has been refreshed."
    });
  };

  // Calculate sales statistics
  const todaySales = sales.filter(sale => 
    sale.date === format(new Date(), 'yyyy-MM-dd')
  ).reduce((acc, sale) => acc + sale.total, 0);

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
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>Generate Report</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <CardDescription className="text-2xl font-bold">${todaySales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month to Date</CardTitle>
            <CardDescription className="text-2xl font-bold">${currentMonthSales.toFixed(2)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
            <CardDescription className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</CardDescription>
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
              data={monthlySales}
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

      <DataTable
        data={filteredSales}
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
            cell: (row) => <div>${row.unitPrice.toFixed(2)}</div>,
            accessorKey: "unitPrice"
          },
          {
            header: "Total",
            cell: (row) => <div className="font-medium">${row.total.toFixed(2)}</div>,
            accessorKey: "total"
          },
          {
            header: "Payment",
            cell: (row) => <div className="capitalize">{row.paymentMethod}</div>,
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
