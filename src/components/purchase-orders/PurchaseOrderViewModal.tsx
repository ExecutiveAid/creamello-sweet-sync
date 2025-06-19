import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/types/purchaseOrder';
import { updatePurchaseOrderStatus } from '@/services/purchaseOrderService';
import { toast } from '@/hooks/use-toast';

interface PurchaseOrderViewModalProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null;
  suppliers: { id: string; name: string }[];
  inventoryItems: { id: string; name: string; unit: string }[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-gray-300 text-gray-800',
  cancelled: 'bg-red-100 text-red-700',
};

const statusOptions: PurchaseOrderStatus[] = [
  'draft', 'sent', 'partially_received', 'received', 'closed', 'cancelled'
];

export const PurchaseOrderViewModal: React.FC<PurchaseOrderViewModalProps> = ({ open, onClose, purchaseOrder, suppliers, inventoryItems }) => {
  const [status, setStatus] = useState<PurchaseOrderStatus>(purchaseOrder?.status || 'draft');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setStatus(purchaseOrder?.status || 'draft');
  }, [purchaseOrder]);

  if (!purchaseOrder) return null;
  const supplier = suppliers.find(s => s.id === purchaseOrder.supplier_id)?.name || '-';
  const isFinal = status === 'closed' || status === 'cancelled';

  const handleStatusChange = async (newStatus: PurchaseOrderStatus) => {
    setSaving(true);
    try {
      await updatePurchaseOrderStatus(purchaseOrder.id, newStatus);
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
          <DialogTitle>Purchase Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Order #</div>
              <div className="font-mono font-bold text-lg">{purchaseOrder.order_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Supplier</div>
              <div className="font-semibold">{supplier}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Order Date</div>
              <div>{format(new Date(purchaseOrder.order_date), 'MMM dd, yyyy')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected Delivery</div>
              <div>{purchaseOrder.expected_delivery ? format(new Date(purchaseOrder.expected_delivery), 'MMM dd, yyyy') : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[status]}>{status.replace(/_/g, ' ')}</Badge>
                <Select
                  value={status}
                  onValueChange={v => handleStatusChange(v as PurchaseOrderStatus)}
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
              <div className="font-semibold">GHS {purchaseOrder.total_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          {purchaseOrder.notes && (
            <div>
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="bg-gray-50 rounded p-2 text-sm">{purchaseOrder.notes}</div>
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
                  {(purchaseOrder.items || []).map((item: PurchaseOrderItem, idx) => {
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
            Created: {purchaseOrder.created_at ? format(new Date(purchaseOrder.created_at), 'MMM dd, yyyy HH:mm') : '-'}<br />
            Last Updated: {purchaseOrder.updated_at ? format(new Date(purchaseOrder.updated_at), 'MMM dd, yyyy HH:mm') : '-'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 