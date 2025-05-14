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
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { FilePieChart, FileSpreadsheet, TrendingUp, CalendarRange, FileText, Download, BarChart3, Loader2, FileDown, User } from 'lucide-react';
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
  const [timePeriod, setTimePeriod] = useState("day");
  
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
        .eq('status', 'completed');

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
      } else if (reportType === 'employee') {
        // Sales by Employee report
        const employeeSummary: Record<string, {
          employeeName: string, 
          orderCount: number,
          totalSales: number,
          averageOrderValue: number
        }> = {};
        
        (orders || []).forEach(order => {
          const staffId = order.staff_id;
          const staffName = staffMap[staffId] || 'Unknown';
          
          if (!employeeSummary[staffId]) {
            employeeSummary[staffId] = {
              employeeName: staffName,
              orderCount: 0,
              totalSales: 0,
              averageOrderValue: 0
            };
          }
          
          employeeSummary[staffId].orderCount += 1;
          employeeSummary[staffId].totalSales += order.total;
        });
        
        // Calculate average order value
        Object.values(employeeSummary).forEach(emp => {
          emp.averageOrderValue = emp.orderCount > 0 ? emp.totalSales / emp.orderCount : 0;
          reportData.push(emp);
        });
      } else if (reportType === 'payment') {
        // Sales by Payment Method report
        const paymentSummary: Record<string, {
          paymentMethod: string,
          orderCount: number,
          totalSales: number,
          percentage: number
        }> = {};
        
        let totalOrderCount = 0;
        let grandTotal = 0;
        
        // First calculate totals
        (orders || []).forEach(order => {
          const method = order.payment_method || 'Unknown';
          
          if (!paymentSummary[method]) {
            paymentSummary[method] = {
              paymentMethod: method,
              orderCount: 0,
              totalSales: 0,
              percentage: 0
            };
          }
          
          paymentSummary[method].orderCount += 1;
          paymentSummary[method].totalSales += order.total;
          
          totalOrderCount += 1;
          grandTotal += order.total;
        });
        
        // Calculate percentages
        Object.values(paymentSummary).forEach(payment => {
          payment.percentage = grandTotal > 0 ? (payment.totalSales / grandTotal) * 100 : 0;
          reportData.push(payment);
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
      } else if (reportType === 'summary') {
        columns = [
          { key: 'date', label: 'Date' },
          { key: 'totalSales', label: 'Total Sales' },
          { key: 'orderCount', label: 'Order Count' },
        ];
      } else if (reportType === 'employee') {
        columns = [
          { key: 'employeeName', label: 'Employee Name' },
          { key: 'orderCount', label: 'Orders Completed' },
          { key: 'totalSales', label: 'Total Sales (GHS)' },
          { key: 'averageOrderValue', label: 'Average Order Value (GHS)' },
        ];
      } else if (reportType === 'payment') {
        columns = [
          { key: 'paymentMethod', label: 'Payment Method' },
          { key: 'orderCount', label: 'Number of Orders' },
          { key: 'totalSales', label: 'Total Sales (GHS)' },
          { key: 'percentage', label: 'Percentage of Sales (%)' },
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
      // Build production batches query
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
        { key: 'production_date', label: 'Production Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Total Quantity' },
        { key: 'available_quantity', label: 'Available Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'status', label: 'Status' },
        { 
          key: 'last_replenished_at', 
          label: 'Last Replenished',
          formatter: (val) => val ? format(new Date(val), 'yyyy-MM-dd HH:mm:ss') : 'Never'
        },
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

  // Generate staff hours report
  const generateStaffHoursReport = async () => {
    setLoading(true);
    try {
      // Get staff data for mapping IDs to names
      const { data: staffMembers, error: staffError } = await supabase
        .from('staff')
        .select('id, name, role');
        
      if (staffError) throw staffError;

      // Create staff lookup map
      const staffMap = (staffMembers || []).reduce((acc: Record<string, any>, member: any) => {
        acc[member.id] = { name: member.name, role: member.role };
        return acc;
      }, {});

      // Build query to get staff attendance records instead of staff_hours
      let query = supabase
        .from('staff_attendance')
        .select('*');

      // Add date filters if set
      if (startDate) {
        const formattedStartDate = formatDate(startDate);
        query = query.gte('login_time', `${formattedStartDate}T00:00:00`);
      }
      
      if (endDate) {
        const formattedEndDate = formatDate(endDate);
        query = query.lte('login_time', `${formattedEndDate}T23:59:59`);
      }

      // Execute query
      const { data: attendanceRecords, error } = await query.order('login_time', { ascending: false });
      
      if (error) throw error;

      // Process the data based on selected time period
      const reportData = [];
      const staffHoursSummary: Record<string, Record<string, any>> = {};
      
      // Initialize data structure
      (attendanceRecords || []).forEach(record => {
        const staffId = record.staff_id;
        const staffName = staffMap[staffId]?.name || 'Unknown';
        const staffRole = staffMap[staffId]?.role || 'Unknown';
        
        // Calculate hours worked (only if logout_time exists)
        let hoursWorked = 0;
        if (record.login_time && record.logout_time) {
          const loginTime = new Date(record.login_time);
          const logoutTime = new Date(record.logout_time);
          hoursWorked = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        }
        
        // Skip records with no hours (no logout)
        if (hoursWorked <= 0) return;
        
        const loginDate = new Date(record.login_time);
        
        let periodKey;
        if (timePeriod === 'day') {
          // Daily report - group by staff and date
          periodKey = format(loginDate, 'yyyy-MM-dd');
        } else if (timePeriod === 'week') {
          // Weekly report - group by staff and week
          const weekStart = format(startOfWeek(loginDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          const weekEnd = format(endOfWeek(loginDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          periodKey = `${weekStart} to ${weekEnd}`;
        } else if (timePeriod === 'month') {
          // Monthly report - group by staff and month
          periodKey = format(loginDate, 'yyyy-MM');
        }
        
        const key = `${staffId}_${periodKey}`;
        
        if (!staffHoursSummary[key]) {
          staffHoursSummary[key] = {
            staffId,
            staffName,
            staffRole,
            period: periodKey,
            totalHours: 0,
            shifts: 0
          };
        }
        
        staffHoursSummary[key].totalHours += hoursWorked;
        staffHoursSummary[key].shifts += 1;
      });
      
      // Convert to array for report
      Object.values(staffHoursSummary).forEach(summary => {
        reportData.push({
          ...summary,
          totalHours: Number(summary.totalHours.toFixed(2)) // Round to 2 decimal places
        });
      });
      
      // Generate filename
      const dateRange = startDate && endDate 
        ? `_${formatDate(startDate)}_to_${formatDate(endDate)}` 
        : '';
      
      const filename = `staff_hours_${timePeriod}${dateRange}.csv`;
      
      // Define columns based on time period
      let periodLabel;
      if (timePeriod === 'day') {
        periodLabel = 'Date';
      } else if (timePeriod === 'week') {
        periodLabel = 'Week';
      } else if (timePeriod === 'month') {
        periodLabel = 'Month';
      }
      
      const columns = [
        { key: 'staffName', label: 'Employee Name' },
        { key: 'staffRole', label: 'Role' },
        { key: 'period', label: periodLabel },
        { key: 'totalHours', label: 'Total Hours' },
        { key: 'shifts', label: 'Shifts Worked' },
      ];
      
      // Export to CSV
      exportToCSV(reportData, filename, columns);
      
      toast({
        title: 'Staff Hours Report Generated',
        description: `Your ${timePeriod}ly staff hours report has been downloaded.`
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
      case 'staffHours':
        generateStaffHoursReport();
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
        <TabsList className="grid w-full md:w-[600px] grid-cols-5">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="staffHours">Staff Hours</TabsTrigger>
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
                      <SelectItem value="employee">Sales by Employee</SelectItem>
                      <SelectItem value="payment">Sales by Payment Method</SelectItem>
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
              <CardDescription>Generate reports on production batches and product availability including replenishment dates</CardDescription>
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

        <TabsContent value="staffHours" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-creamello-purple" />
                Staff Hours Report
              </CardTitle>
              <CardDescription>Generate reports on employee work hours by day, week, or month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timePeriod">Time Period</Label>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger id="timePeriod">
                      <SelectValue placeholder="Select time period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily Hours</SelectItem>
                      <SelectItem value="week">Weekly Hours</SelectItem>
                      <SelectItem value="month">Monthly Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="staffHoursReportFormat">Report Format</Label>
                  <Select value={reportFormat} onValueChange={setReportFormat}>
                    <SelectTrigger id="staffHoursReportFormat">
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