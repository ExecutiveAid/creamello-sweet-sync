import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { SalesOrder, SalesOrderItem, SalesOrderStatus } from '@/types/salesOrder';
import { updateSalesOrderStatus } from '@/services/salesOrderService';
import { toast } from '@/hooks/use-toast';

interface SalesOrderViewModalProps {
  open: boolean;
  onClose: () => void;
  salesOrder: SalesOrder | null;
  customers: { id: string; name: string }[];
  inventoryItems: { id: string; name: string; unit: string }[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  closed: 'bg-gray-300 text-gray-800',
  cancelled: 'bg-red-100 text-red-700',
};

const statusOptions: SalesOrderStatus[] = [
  'draft', 'confirmed', 'partially_fulfilled', 'fulfilled', 'closed', 'cancelled'
];

export const SalesOrderViewModal: React.FC<SalesOrderViewModalProps> = ({ open, onClose, salesOrder, customers, inventoryItems }) => {
  const [status, setStatus] = useState<SalesOrderStatus>(salesOrder?.status || 'draft');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setStatus(salesOrder?.status || 'draft');
  }, [salesOrder]);

  if (!salesOrder) return null;
  const customer = customers.find(c => c.id === salesOrder.customer_id)?.name || '-';
  const isFinal = status === 'closed' || status === 'cancelled';

  const handleStatusChange = async (newStatus: SalesOrderStatus) => {
    setSaving(true);
    try {
      await updateSalesOrderStatus(salesOrder.id, newStatus);
      setStatus(newStatus);
      toast({ title: 'Status Updated', description: `Order status changed to ${newStatus.replace(/_/g, ' ')}.`, variant: 'default' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update status.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sales Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Order #</div>
              <div className="font-mono font-bold text-lg">{salesOrder.order_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="font-semibold">{customer}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Order Date</div>
              <div>{format(new Date(salesOrder.order_date), 'MMM dd, yyyy')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Delivery Date</div>
              <div>{salesOrder.delivery_date ? format(new Date(salesOrder.delivery_date), 'MMM dd, yyyy') : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[status]}>{status.replace(/_/g, ' ')}</Badge>
                <Select
                  value={status}
                  onValueChange={v => handleStatusChange(v as SalesOrderStatus)}
                  disabled={isFinal || saving}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold">GHS {salesOrder.total_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          {salesOrder.notes && (
            <div>
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="bg-gray-50 rounded p-2 text-sm">{salesOrder.notes}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Line Items</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2 text-left">Product</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-2 text-right">Total</th>
                    <th className="py-2 px-2 text-left">Status</th>
                    <th className="py-2 px-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(salesOrder.items || []).map((item: SalesOrderItem, idx) => {
                    const product = inventoryItems.find(i => i.id === item.inventory_item_id)?.name || '-';
                    return (
                      <tr key={item.id || idx} className="border-b">
                        <td className="py-2 px-2">{product}</td>
                        <td className="py-2 px-2 text-right">{item.quantity}</td>
                        <td className="py-2 px-2 text-right">GHS {item.unit_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-right">GHS {(item.quantity * item.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">
                          <Badge className={statusColors[item.status]}>{item.status.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="py-2 px-2">{item.description || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Created: {salesOrder.created_at ? format(new Date(salesOrder.created_at), 'MMM dd, yyyy HH:mm') : '-'}<br />
            Last Updated: {salesOrder.updated_at ? format(new Date(salesOrder.updated_at), 'MMM dd, yyyy HH:mm') : '-'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 