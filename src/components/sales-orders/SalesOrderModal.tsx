import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { SalesOrder, SalesOrderItem } from '@/types/salesOrder';
import { useAuth } from '@/context/AuthContext';

interface SalesOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (so: Partial<SalesOrder>, items: Partial<SalesOrderItem>[]) => void;
  initialData?: Partial<SalesOrder>;
  customers: { id: string; name: string }[];
  inventoryItems: { id: string; name: string; unit: string }[];
}

const emptyItem = { inventory_item_id: '', description: '', quantity: 1, unit_price: 0 };

export const SalesOrderModal: React.FC<SalesOrderModalProps> = ({ open, onClose, onSave, initialData, customers, inventoryItems }) => {
  const { staff } = useAuth();
  const [customerId, setCustomerId] = useState(initialData?.customer_id || '');
  const [orderDate, setOrderDate] = useState(initialData?.order_date || new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(initialData?.delivery_date || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [items, setItems] = useState<Partial<SalesOrderItem>[]>(initialData?.items || [ { ...emptyItem } ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialData) {
      setCustomerId(initialData.customer_id || '');
      setOrderDate(initialData.order_date || new Date().toISOString().slice(0, 10));
      setDeliveryDate(initialData.delivery_date || '');
      setNotes(initialData.notes || '');
      setItems(initialData.items && initialData.items.length > 0 ? initialData.items : [ { ...emptyItem } ]);
    } else if (open) {
      setCustomerId('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setDeliveryDate('');
      setNotes('');
      setItems([ { ...emptyItem } ]);
    }
  }, [open, initialData]);

  const handleItemChange = (idx: number, field: keyof SalesOrderItem, value: any) => {
    setItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleAddItem = () => {
    setItems(items => [ ...items, { ...emptyItem } ]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items => items.length > 1 ? items.filter((_, i) => i !== idx) : items);
  };

  const handleSave = async () => {
    setError(null);
    if (!customerId) {
      setError('Customer is required.');
      return;
    }
    if (items.some(item => !item.inventory_item_id || !item.quantity || !item.unit_price)) {
      setError('All line items must have a product, quantity, and unit price.');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          customer_id: customerId,
          order_date: orderDate,
          delivery_date: deliveryDate,
          notes,
          created_by: staff?.id, // Add the current user's staff ID
        },
        items
      );
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save sales order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Sales Order' : 'New Sales Order'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Customer</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Order Date</label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Delivery Date</label>
              <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Line Items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={item.inventory_item_id || ''}
                    onValueChange={v => handleItemChange(idx, 'inventory_item_id', v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={item.quantity || ''}
                    onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                    placeholder="Qty"
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={item.unit_price || ''}
                    onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                    placeholder="Unit Price"
                  />
                  <Input
                    className="w-32"
                    value={item.description || ''}
                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Description"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddItem} className="mt-2">
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-brand-primary hover:bg-brand-primary-dark text-white">
            {saving ? 'Saving...' : initialData ? 'Update SO' : 'Create SO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 