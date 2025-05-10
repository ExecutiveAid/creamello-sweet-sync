import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { FilePieChart, FileSpreadsheet, TrendingUp, CalendarRange, FileText, Download, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const Reports = () => {
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager';

  // State for date ranges
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("sales");
  const [reportFormat, setReportFormat] = useState("csv");
  const [reportType, setReportType] = useState("daily");
  const [loading, setLoading] = useState(false);
  
  // Helper function to format dates for display
  const formatDate = (date?: Date) => {
    return date ? format(date, 'yyyy-MM-dd') : '';
  };

  // Clear date range
  const clearDateRange = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Generate sales report
  const generateSalesReport = async () => {
    setLoading(true);
    try {
      // Base query
      let query = supabase
        .from('orders')
        .select('id, created_at, payment_method, total, staff_id, status, order_items(id, flavor_id, flavor_name, scoops, price)')
        .eq('status', 'delivered');

      // Add date filters if set
      if (startDate) {
        const formattedStartDate = formatDate(startDate);
        query = query.gte('created_at', `${formattedStartDate}T00:00:00`);
      }
      
      if (endDate) {
        const formattedEndDate = formatDate(endDate);
        query = query.lte('created_at', `${formattedEndDate}T23:59:59`);
      }

      // Execute query
      const { data: orders, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get staff data for mapping IDs to names
      const { data: staffMembers, error: staffError } = await supabase
        .from('staff')
        .select('id, name');
        
      if (staffError) throw staffError;

      // Create staff lookup map
      const staffMap = (staffMembers || []).reduce((acc: Record<string, string>, member: any) => {
        acc[member.id] = member.name;
        return acc;
      }, {});

      // Process the data into a flat structure for the report
      const reportData = [];
      
      if (reportType === 'daily' || reportType === 'detailed') {
        // Detailed report: individual sales items
        (orders || []).forEach(order => {
          const orderDate = new Date(order.created_at);
          (order.order_items || []).forEach(item => {
            reportData.push({
              orderDate: format(orderDate, 'yyyy-MM-dd'),
              orderTime: format(orderDate, 'HH:mm:ss'),
              orderId: order.id,
              product: item.flavor_name || item.flavor_id || 'N/A',
              quantity: item.scoops || 1,
              unitPrice: item.price,
              total: item.price * (item.scoops || 1),
              paymentMethod: order.payment_method || 'N/A',
              staff: staffMap[order.staff_id] || 'Unknown',
            });
          });
        });
      } else if (reportType === 'summary') {
        // Summary report: aggregated by day
        const dailySummary: Record<string, {date: string, totalSales: number, orderCount: number}> = {};
        
        (orders || []).forEach(order => {
          const day = format(new Date(order.created_at), 'yyyy-MM-dd');
          
          if (!dailySummary[day]) {
            dailySummary[day] = {
              date: day,
              totalSales: 0,
              orderCount: 0
            };
          }
          
          dailySummary[day].totalSales += order.total;
          dailySummary[day].orderCount += 1;
        });
        
        Object.values(dailySummary).forEach(summary => {
          reportData.push(summary);
        });
      }

      // Generate the appropriate filename
      const dateRange = startDate && endDate 
        ? `_${formatDate(startDate)}_to_${formatDate(endDate)}` 
        : '';
      
      const filename = `sales_report_${reportType}${dateRange}.csv`;
      
      // Define columns based on report type
      let columns;
      
      if (reportType === 'detailed') {
        columns = [
          { key: 'orderDate', label: 'Date' },
          { key: 'orderTime', label: 'Time' },
          { key: 'orderId', label: 'Order ID' },
          { key: 'product', label: 'Product' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'unitPrice', label: 'Unit Price' },
          { key: 'total', label: 'Total' },
          { key: 'paymentMethod', label: 'Payment Method' },
          { key: 'staff', label: 'Staff Member' },
        ];
      } else if (reportType === 'daily') {
        columns = [
          { key: 'orderDate', label: 'Date' },
          { key: 'product', label: 'Product' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'total', label: 'Total' },
          { key: 'staff', label: 'Staff Member' },
        ];
      } else { // summary
        columns = [
          { key: 'date', label: 'Date' },
          { key: 'totalSales', label: 'Total Sales' },
          { key: 'orderCount', label: 'Order Count' },
        ];
      }
      
      // Export to CSV
      exportToCSV(reportData, filename, columns);
      
      toast({
        title: 'Report Generated',
        description: `Your ${reportType} report has been downloaded.`
      });
    } catch (err: any) {
      toast({
        title: 'Error Generating Report',
        description: err.message || 'An error occurred generating the report.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate inventory report
  const generateInventoryReport = async () => {
    setLoading(true);
    try {
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      const filename = 'inventory_report.csv';
      const columns = [
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'available_quantity', label: 'Available Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'price_per_unit', label: 'Price per Unit' },
        { key: 'threshold', label: 'Low Stock Threshold' },
        { key: 'last_updated', label: 'Last Updated' }
      ];
      
      exportToCSV(inventory || [], filename, columns);
      
      toast({
        title: 'Inventory Report Generated',
        description: 'Your inventory report has been downloaded.'
      });
    } catch (err: any) {
      toast({
        title: 'Error Generating Report',
        description: err.message || 'An error occurred generating the report.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate production report
  const generateProductionReport = async () => {
    setLoading(true);
    try {
      // Build query based on date range
      let query = supabase
        .from('production_batches')
        .select('*');

      if (startDate) {
        const formattedStartDate = formatDate(startDate);
        query = query.gte('production_date', formattedStartDate);
      }
      
      if (endDate) {
        const formattedEndDate = formatDate(endDate);
        query = query.lte('production_date', formattedEndDate);
      }

      const { data: batches, error } = await query.order('production_date', { ascending: false });
      
      if (error) throw error;
      
      const dateRange = startDate && endDate 
        ? `_${formatDate(startDate)}_to_${formatDate(endDate)}` 
        : '';
      
      const filename = `production_report${dateRange}.csv`;
      const columns = [
        { key: 'production_date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'available_quantity', label: 'Available Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' }
      ];
      
      exportToCSV(batches || [], filename, columns);
      
      toast({
        title: 'Production Report Generated',
        description: 'Your production report has been downloaded.'
      });
    } catch (err: any) {
      toast({
        title: 'Error Generating Report',
        description: err.message || 'An error occurred generating the report.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate orders report
  const generateOrdersReport = async () => {
    setLoading(true);
    try {
      // Base query
      let query = supabase
        .from('orders')
        .select('id, created_at, updated_at, customer_name, table_number, payment_method, total, staff_id, status');

      // Add date filters if set
      if (startDate) {
        const formattedStartDate = formatDate(startDate);
        query = query.gte('created_at', `${formattedStartDate}T00:00:00`);
      }
      
      if (endDate) {
        const formattedEndDate = formatDate(endDate);
        query = query.lte('created_at', `${formattedEndDate}T23:59:59`);
      }

      // Execute query
      const { data: orders, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get staff data for mapping IDs to names
      const { data: staffMembers, error: staffError } = await supabase
        .from('staff')
        .select('id, name');
        
      if (staffError) throw staffError;

      // Create staff lookup map
      const staffMap = (staffMembers || []).reduce((acc: Record<string, string>, member: any) => {
        acc[member.id] = member.name;
        return acc;
      }, {});

      // Process orders to include staff names
      const processedOrders = (orders || []).map(order => ({
        id: order.id,
        created_at: format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
        updated_at: order.updated_at ? format(new Date(order.updated_at), 'yyyy-MM-dd HH:mm:ss') : '',
        customer_name: order.customer_name || 'N/A',
        table_number: order.table_number || 'N/A',
        payment_method: order.payment_method || 'N/A',
        total: order.total,
        staff_name: staffMap[order.staff_id] || 'Unknown',
        staff_id: order.staff_id,
        status: order.status
      }));
      
      const dateRange = startDate && endDate 
        ? `_${formatDate(startDate)}_to_${formatDate(endDate)}` 
        : '';
      
      const filename = `orders_report${dateRange}.csv`;
      
      const columns = [
        { key: 'id' as const, label: 'Order ID' },
        { key: 'created_at' as const, label: 'Created At' },
        { key: 'customer_name' as const, label: 'Customer' },
        { key: 'table_number' as const, label: 'Table' },
        { key: 'total' as const, label: 'Total' },
        { key: 'payment_method' as const, label: 'Payment Method' },
        { key: 'staff_name' as const, label: 'Staff Member' },
        { key: 'status' as const, label: 'Status' }
      ];
      
      exportToCSV(processedOrders, filename, columns);
      
      toast({
        title: 'Orders Report Generated',
        description: 'Your orders report has been downloaded.'
      });
    } catch (err: any) {
      toast({
        title: 'Error Generating Report',
        description: err.message || 'An error occurred generating the report.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler for different report types
  const handleGenerateReport = () => {
    switch(activeTab) {
      case 'sales':
        generateSalesReport();
        break;
      case 'inventory':
        generateInventoryReport();
        break;
      case 'production':
        generateProductionReport();
        break;
      case 'orders':
        generateOrdersReport();
        break;
      default:
        generateSalesReport();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md mb-6">
        <div className="flex items-center">
          <FileSpreadsheet className="h-5 w-5 text-blue-500 mr-3" />
          <h3 className="text-lg font-medium text-blue-700">Centralized Reporting</h3>
        </div>
        <p className="mt-2 text-blue-700">
          All reporting functionality has been consolidated in this section. You can generate detailed reports for Sales, Inventory, Production, and Orders from here.
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-creamello-purple" />
                Sales Reports
              </CardTitle>
              <CardDescription>Generate detailed or summary reports for your sales data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reportType">Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger id="reportType">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detailed">Detailed (Item by Item)</SelectItem>
                      <SelectItem value="daily">Daily Sales</SelectItem>
                      <SelectItem value="summary">Summary by Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reportFormat">Report Format</Label>
                  <Select value={reportFormat} onValueChange={setReportFormat}>
                    <SelectTrigger id="reportFormat">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label>Date Range</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="startDate" className="min-w-20">From:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="endDate" className="min-w-20">To:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button variant="outline" onClick={clearDateRange}>
                    Clear Dates
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-creamello-purple" />
                Inventory Reports
              </CardTitle>
              <CardDescription>Generate reports on current inventory levels and stock status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inventoryReportFormat">Report Format</Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger id="inventoryReportFormat">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePieChart className="h-5 w-5 text-creamello-purple" />
                Production Reports
              </CardTitle>
              <CardDescription>Generate reports on production batches and product availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productionReportFormat">Report Format</Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger id="productionReportFormat">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label>Date Range (Optional)</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="startDate" className="min-w-20">From:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="endDate" className="min-w-20">To:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button variant="outline" onClick={clearDateRange}>
                    Clear Dates
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-creamello-purple" />
                Orders Reports
              </CardTitle>
              <CardDescription>Generate reports on customer orders and their status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ordersReportFormat">Report Format</Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger id="ordersReportFormat">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label>Date Range (Optional)</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="startDate" className="min-w-20">From:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="endDate" className="min-w-20">To:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                          <CalendarRange className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button variant="outline" onClick={clearDateRange}>
                    Clear Dates
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button 
          onClick={handleGenerateReport} 
          disabled={loading}
          className="bg-creamello-purple hover:bg-creamello-purple-dark"
          size="lg"
        >
          <Download className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>
    </div>
  );
};

export default Reports; 