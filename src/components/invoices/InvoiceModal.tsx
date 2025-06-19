import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Invoice } from '@/types/invoice';
import { getNextInvoiceNumber } from '@/services/invoiceService';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (invoice: Partial<Invoice>) => void;
  initialData?: Partial<Invoice>;
  customers: { id: string; name: string }[];
  salesOrders: { id: string; order_number: string; customer_id?: string; total_amount: number }[];
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ open, onClose, onSave, initialData, customers, salesOrders }) => {
  const [customerId, setCustomerId] = useState(initialData?.customer_id || '');
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number || '');
  const [issueDate, setIssueDate] = useState(initialData?.issue_date || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [totalAmount, setTotalAmount] = useState(initialData?.total_amount?.toString() || '');
  const [status, setStatus] = useState(initialData?.status || 'unpaid');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesOrderId, setSalesOrderId] = useState(initialData?.sales_order_id || '');
  const [invoiceLayout, setInvoiceLayout] = useState({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '',
    footer: 'Thank you for your business!'
  });

  // Load invoice layout settings
  useEffect(() => {
    const fetchLayout = async () => {
      const { data } = await supabase.from('settings').select('invoice_layout').limit(1).maybeSingle();
      if (data && data.invoice_layout) setInvoiceLayout(data.invoice_layout);
    };
    fetchLayout();
  }, []);

  useEffect(() => {
    if (open && initialData) {
      setCustomerId(initialData.customer_id || '');
      setInvoiceNumber(initialData.invoice_number || '');
      setIssueDate(initialData.issue_date || '');
      setDueDate(initialData.due_date || '');
      setTotalAmount(initialData.total_amount?.toString() || '');
      setStatus(initialData.status || 'unpaid');
      setSalesOrderId(initialData.sales_order_id || '');
    } else if (open) {
      // Reset form for new invoice
      setCustomerId('');
      setInvoiceNumber('');
      setTotalAmount('');
      setStatus('unpaid');
      setSalesOrderId('');
      
      // Auto-fill dates for new invoice
      const today = new Date();
      const dueInThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      setIssueDate(today.toISOString().split('T')[0]);
      setDueDate(dueInThirtyDays.toISOString().split('T')[0]);
      
      // Get next invoice number
      getNextInvoiceNumber().then(setInvoiceNumber);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (salesOrderId) {
      const so = salesOrders.find(so => so.id === salesOrderId);
      if (so) {
        setCustomerId(so.customer_id || '');
        setTotalAmount(so.total_amount?.toString() || '');
      }
    }
  }, [salesOrderId]);

  const handleSave = async () => {
    setError(null);
    if (!customerId || !invoiceNumber || !issueDate || !totalAmount) {
      setError('All required fields must be filled.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        customer_id: customerId,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate,
        total_amount: parseFloat(totalAmount),
        status,
        sales_order_id: salesOrderId,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Edit Invoice' : 'New Invoice'}
            {invoiceLayout.businessName && (
              <div className="text-sm font-normal text-muted-foreground mt-1">
                {invoiceLayout.businessName}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border rounded p-2">
              <option value="">Select customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Invoice Number *</label>
            <Input value={invoiceNumber} readOnly placeholder="INV-00001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Issue Date *</label>
            <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Amount *</label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border rounded p-2">
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sales Order</label>
            <select value={salesOrderId} onChange={e => setSalesOrderId(e.target.value)} className="w-full border rounded p-2">
              <option value="">(Optional) Link to Sales Order</option>
              {salesOrders.map(so => (
                <option key={so.id} value={so.id}>{so.order_number}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-brand-primary hover:bg-brand-primary-dark text-white">
            {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 