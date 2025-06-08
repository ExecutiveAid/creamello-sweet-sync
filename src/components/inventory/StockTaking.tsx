import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  FileText,
  Calendar,
  User,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckSquare,
  XCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { StockTakingService } from '@/services/stockTakingService';
import {
  StockTake,
  StockTakeItem,
  StockAdjustment,
  CreateStockTakeRequest,
  StockTakeWithItems,
  StockTakeVarianceReport,
  STOCK_TAKE_STATUSES,
  ADJUSTMENT_STATUSES
} from '@/types/stockTaking';

interface StockTakingProps {
  onClose?: () => void;
}

const StockTaking: React.FC<StockTakingProps> = ({ onClose }) => {
  const { staff } = useAuth();
  const isManager = staff?.role === 'manager' || staff?.role === 'admin';
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [selectedStockTake, setSelectedStockTake] = useState<StockTakeWithItems | null>(null);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [varianceReport, setVarianceReport] = useState<StockTakeVarianceReport | null>(null);
  
  // Dialog states
  const [createStockTakeOpen, setCreateStockTakeOpen] = useState(false);
  const [viewStockTakeOpen, setViewStockTakeOpen] = useState(false);
  const [countItemOpen, setCountItemOpen] = useState(false);
  const [varianceReportOpen, setVarianceReportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockTakeItem | null>(null);
  
  // Form states
  const [newStockTake, setNewStockTake] = useState<CreateStockTakeRequest>({
    title: '',
    description: '',
    location: 'main'
  });
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [countNotes, setCountNotes] = useState('');

  useEffect(() => {
    fetchStockTakes();
    fetchAdjustments();
  }, []);

  const fetchStockTakes = async () => {
    try {
      setLoading(true);
      const data = await StockTakingService.getStockTakes();
      setStockTakes(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const data = await StockTakingService.getStockAdjustments({ status: 'pending' });
      setAdjustments(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleCreateStockTake = async () => {
    if (!staff?.id) return;
    
    try {
      setLoading(true);
      await StockTakingService.createStockTake(newStockTake, staff.id);
      toast({
        title: 'Success',
        description: 'Stock take created successfully'
      });
      setCreateStockTakeOpen(false);
      setNewStockTake({ title: '', description: '', location: 'main' });
      fetchStockTakes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartStockTake = async (stockTakeId: string) => {
    if (!staff?.id) return;
    
    try {
      setLoading(true);
      await StockTakingService.startStockTake(stockTakeId, staff.id);
      toast({
        title: 'Success',
        description: 'Stock take started successfully'
      });
      fetchStockTakes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewStockTake = async (stockTakeId: string) => {
    try {
      setLoading(true);
      const items = await StockTakingService.getStockTakeItems(stockTakeId);
      setStockTakeItems(items);
      
      const stockTake = stockTakes.find(st => st.id === stockTakeId);
      if (stockTake) {
        setSelectedStockTake({ ...stockTake, items });
        setViewStockTakeOpen(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCountDialog = (item: StockTakeItem) => {
    setSelectedItem(item);
    setPhysicalCount(item.physical_quantity || 0);
    setCountNotes(item.notes || '');
    setCountItemOpen(true);
  };

  const handleUpdateCount = async () => {
    if (!selectedItem || !staff?.id) return;
    
    try {
      setLoading(true);
      await StockTakingService.updateStockTakeItem(
        selectedItem.id,
        { physical_quantity: physicalCount, notes: countNotes },
        staff.id
      );
      
      toast({
        title: 'Success',
        description: 'Count updated successfully'
      });
      
      setCountItemOpen(false);
      
      // Refresh the stock take items
      if (selectedStockTake) {
        const updatedItems = await StockTakingService.getStockTakeItems(selectedStockTake.id);
        setStockTakeItems(updatedItems);
        setSelectedStockTake({ ...selectedStockTake, items: updatedItems });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStockTake = async (stockTakeId: string) => {
    if (!staff?.id) return;
    
    try {
      setLoading(true);
      await StockTakingService.completeStockTake(stockTakeId, staff.id);
      toast({
        title: 'Success',
        description: 'Stock take completed successfully'
      });
      fetchStockTakes();
      setViewStockTakeOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVarianceReport = async (stockTakeId: string) => {
    try {
      setLoading(true);
      const report = await StockTakingService.generateVarianceReport(stockTakeId);
      setVarianceReport(report);
      setVarianceReportOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdjustments = async (stockTakeId: string) => {
    if (!staff?.id) return;
    
    try {
      setLoading(true);
      const adjustments = await StockTakingService.createAdjustmentsFromStockTake(stockTakeId, staff.id);
      toast({
        title: 'Success',
        description: `Created ${adjustments.length} stock adjustments for approval`
      });
      fetchAdjustments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAdjustment = async (adjustmentId: string) => {
    if (!staff?.id) return;
    
    try {
      setLoading(true);
      await StockTakingService.approveStockAdjustment(adjustmentId, staff.id);
      toast({
        title: 'Success',
        description: 'Stock adjustment approved and applied'
      });
      fetchAdjustments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-500',
      in_progress: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    };
    return <Badge className={colors[status as keyof typeof colors]}>{status.replace('_', ' ')}</Badge>;
  };

  const getAdjustmentTypeBadge = (type: string) => {
    const colors = {
      increase: 'bg-green-500',
      decrease: 'bg-red-500',
      correction: 'bg-yellow-500'
    };
    return <Badge className={colors[type as keyof typeof colors]}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Stock Taking System</h2>
        <div className="flex gap-2">
          <Button onClick={() => setCreateStockTakeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Stock Take
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stocktakes">Stock Takes</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Stock Takes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stockTakes.filter(st => st.status === 'in_progress').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed This Month</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stockTakes.filter(st => 
                    st.status === 'completed' && 
                    new Date(st.completed_at || '').getMonth() === new Date().getMonth()
                  ).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Adjustments</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adjustments.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stock Takes</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockTakes.length}</div>
              </CardContent>
            </Card>
          </div>

          {adjustments.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have {adjustments.length} pending stock adjustments requiring approval.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="stocktakes" className="space-y-4">
          <DataTable
            data={stockTakes}
            columns={[
              {
                header: "Reference",
                accessorKey: "reference_number"
              },
              {
                header: "Title",
                accessorKey: "title"
              },
              {
                header: "Status",
                cell: (row: StockTake) => getStatusBadge(row.status)
              },
              {
                header: "Initiated By",
                accessorKey: "initiated_by"
              },
              {
                header: "Created",
                cell: (row: StockTake) => format(parseISO(row.created_at), 'MMM dd, yyyy')
              },
              {
                header: "Variance Value",
                cell: (row: StockTake) => (
                  <div className={row.total_variance_value !== 0 ? "font-medium" : ""}>
                    GHS {row.total_variance_value.toFixed(2)}
                  </div>
                )
              },
              {
                header: "Actions",
                cell: (row: StockTake) => (
                  <div className="flex gap-2">
                    {row.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleStartStockTake(row.id)}
                        disabled={loading}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {(row.status === 'in_progress' || row.status === 'completed') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewStockTake(row.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    )}
                    {row.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateVarianceReport(row.id)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Report
                      </Button>
                    )}
                  </div>
                )
              }
            ]}
            title="Stock Takes"
            searchable={true}
            maxHeight="600px"
          />
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-4">
          <DataTable
            data={adjustments}
            columns={[
              {
                header: "Reference",
                accessorKey: "reference_number"
              },
              {
                header: "Item",
                accessorKey: "inventory_item_name"
              },
              {
                header: "Type",
                cell: (row: StockAdjustment) => getAdjustmentTypeBadge(row.adjustment_type)
              },
              {
                header: "Quantity Change",
                cell: (row: StockAdjustment) => (
                  <div className="flex items-center">
                    {(row.adjustment_quantity || 0) > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    {Math.abs(row.adjustment_quantity || 0)}
                  </div>
                )
              },
              {
                header: "Value Impact",
                cell: (row: StockAdjustment) => (
                  <div className={(row.adjustment_value || 0) !== 0 ? "font-medium" : ""}>
                    GHS {(row.adjustment_value || 0).toFixed(2)}
                  </div>
                )
              },
              {
                header: "Reason",
                accessorKey: "reason"
              },
              {
                header: "Created",
                cell: (row: StockAdjustment) => format(parseISO(row.created_at), 'MMM dd, yyyy')
              },
              {
                header: "Actions",
                cell: (row: StockAdjustment) => (
                  <div className="flex gap-2">
                    {isManager && row.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveAdjustment(row.id)}
                        disabled={loading}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                    )}
                  </div>
                )
              }
            ]}
            title="Stock Adjustments"
            searchable={true}
            maxHeight="600px"
          />
        </TabsContent>
      </Tabs>

      {/* Create Stock Take Dialog */}
      <Dialog open={createStockTakeOpen} onOpenChange={setCreateStockTakeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Stock Take</DialogTitle>
            <DialogDescription>
              Create a new stock take session to count and verify inventory levels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newStockTake.title}
                onChange={(e) => setNewStockTake({...newStockTake, title: e.target.value})}
                placeholder="e.g., Monthly Stock Take - January 2024"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newStockTake.description}
                onChange={(e) => setNewStockTake({...newStockTake, description: e.target.value})}
                placeholder="Optional description..."
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Select
                value={newStockTake.location}
                onValueChange={(value) => setNewStockTake({...newStockTake, location: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main Location</SelectItem>
                  <SelectItem value="storage">Storage Room</SelectItem>
                  <SelectItem value="display">Display Area</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateStockTakeOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateStockTake} 
              disabled={!newStockTake.title || loading}
            >
              Create Stock Take
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Stock Take Dialog */}
      <Dialog open={viewStockTakeOpen} onOpenChange={setViewStockTakeOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Stock Take: {selectedStockTake?.reference_number}</DialogTitle>
            <DialogDescription>
              {selectedStockTake?.title} - {getStatusBadge(selectedStockTake?.status || '')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedStockTake && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Items Counted:</strong> {stockTakeItems.filter(item => item.physical_quantity !== null).length} / {stockTakeItems.length}
                </div>
                <div>
                  <strong>Total Variance:</strong> GHS {selectedStockTake.total_variance_value.toFixed(2)}
                </div>
                <div>
                  <strong>Started:</strong> {selectedStockTake.started_at ? format(parseISO(selectedStockTake.started_at), 'MMM dd, yyyy HH:mm') : 'Not started'}
                </div>
              </div>

              <DataTable
                data={stockTakeItems}
                columns={[
                  {
                    header: "Item",
                    accessorKey: "inventory_item_name"
                  },
                  {
                    header: "Category",
                    accessorKey: "inventory_item_category"
                  },
                  {
                    header: "System Qty",
                    accessorKey: "system_quantity"
                  },
                  {
                    header: "Physical Qty",
                    cell: (row: StockTakeItem) => (
                      row.physical_quantity !== null ? row.physical_quantity : 'Not counted'
                    )
                  },
                  {
                    header: "Variance",
                    cell: (row: StockTakeItem) => {
                      if (row.physical_quantity === null) return '-';
                      const variance = row.variance_quantity || 0;
                      return (
                        <div className={variance !== 0 ? "font-medium" : ""}>
                          {variance > 0 && <TrendingUp className="inline h-3 w-3 text-green-500 mr-1" />}
                          {variance < 0 && <TrendingDown className="inline h-3 w-3 text-red-500 mr-1" />}
                          {variance}
                        </div>
                      );
                    }
                  },
                  {
                    header: "Counted By",
                    accessorKey: "counted_by"
                  },
                  {
                    header: "Actions",
                    cell: (row: StockTakeItem) => (
                      selectedStockTake.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenCountDialog(row)}
                        >
                          Count
                        </Button>
                      )
                    )
                  }
                ]}
                title="Stock Take Items"
                searchable={true}
                maxHeight="400px"
              />

              <div className="flex justify-between">
                <div className="flex gap-2">
                  {selectedStockTake.status === 'completed' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleGenerateVarianceReport(selectedStockTake.id)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Variance Report
                      </Button>
                      <Button
                        onClick={() => handleCreateAdjustments(selectedStockTake.id)}
                        disabled={loading}
                      >
                        Create Adjustments
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {selectedStockTake.status === 'in_progress' && (
                    <Button
                      onClick={() => handleCompleteStockTake(selectedStockTake.id)}
                      disabled={loading}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Stock Take
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setViewStockTakeOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Count Item Dialog */}
      <Dialog open={countItemOpen} onOpenChange={setCountItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Physical Count</DialogTitle>
            <DialogDescription>
              Count the physical quantity for: {selectedItem?.inventory_item_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>System Quantity:</strong> {selectedItem.system_quantity}
                </div>
                <div>
                  <strong>Category:</strong> {selectedItem.inventory_item_category}
                </div>
              </div>
              
              <div>
                <Label htmlFor="physicalCount">Physical Quantity *</Label>
                <Input
                  id="physicalCount"
                  type="number"
                  step="0.01"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(parseFloat(e.target.value) || 0)}
                />
              </div>
              
              <div>
                <Label htmlFor="countNotes">Notes</Label>
                <Textarea
                  id="countNotes"
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  placeholder="Optional notes about this count..."
                />
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm">
                  <strong>Variance Preview:</strong> {physicalCount - selectedItem.system_quantity}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCount} disabled={loading}>
              Update Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variance Report Dialog */}
      <Dialog open={varianceReportOpen} onOpenChange={setVarianceReportOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Variance Report</DialogTitle>
            <DialogDescription>
              Stock take variance analysis for {varianceReport?.stock_take.reference_number}
            </DialogDescription>
          </DialogHeader>
          
          {varianceReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{varianceReport.total_items}</div>
                    <div className="text-sm text-muted-foreground">Total Items</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-amber-600">{varianceReport.items_with_variance}</div>
                    <div className="text-sm text-muted-foreground">With Variance</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{varianceReport.positive_variances}</div>
                    <div className="text-sm text-muted-foreground">Overages</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">{varianceReport.negative_variances}</div>
                    <div className="text-sm text-muted-foreground">Shortages</div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-md">
                <div className="text-2xl font-bold">
                  GHS {varianceReport.total_variance_value.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Total Variance Value</div>
              </div>

              {varianceReport.variance_items.length > 0 && (
                <DataTable
                  data={varianceReport.variance_items}
                  columns={[
                    {
                      header: "Item",
                      accessorKey: "inventory_item_name"
                    },
                    {
                      header: "System",
                      accessorKey: "system_quantity"
                    },
                    {
                      header: "Physical",
                      accessorKey: "physical_quantity"
                    },
                    {
                      header: "Variance",
                      cell: (row: StockTakeItem) => (
                        <div className={`font-medium ${(row.variance_quantity || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.variance_quantity}
                        </div>
                      )
                    },
                    {
                      header: "Value Impact",
                      cell: (row: StockTakeItem) => (
                        <div className={`font-medium ${(row.variance_value || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          GHS {(row.variance_value || 0).toFixed(2)}
                        </div>
                      )
                    }
                  ]}
                  title="Variance Details"
                  searchable={true}
                  maxHeight="300px"
                />
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setVarianceReportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockTaking; 