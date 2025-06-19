import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Payment } from '@/types/invoice';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payment: Partial<Payment>) => void;
  invoiceId: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ open, onClose, onSave, invoiceId }) => {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentMethods = ['Cash', 'Card', 'Bank', 'Mobile Money'];

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]); // Auto-fill today's date
      setMethod('Cash'); // Default to Cash
      setReference('');
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setError(null);
    if (!amount || !paymentDate) {
      setError('Amount and date are required.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        invoice_id: invoiceId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        method,
        reference,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment Date *</label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded p-2">
              {paymentMethods.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Receipt #, Bank Ref..." />
          </div>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-brand-primary hover:bg-brand-primary-dark text-white">
            {saving ? 'Saving...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 