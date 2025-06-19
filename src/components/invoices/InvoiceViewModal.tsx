import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Invoice, Payment } from '@/types/invoice';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyDisplay, formatDateDisplay } from '@/utils/formatters';

interface InvoiceViewModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  payments: Payment[];
  onRecordPayment: () => void;
  customers: { id: string; name: string }[];
  salesOrders?: { id: string; order_number: string; items?: any[] }[];
  inventoryItems?: { id: string; name: string; unit: string }[];
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({ open, onClose, invoice, payments, onRecordPayment, customers, salesOrders = [], inventoryItems = [] }) => {
  if (!invoice) return null;
  const customerName = customers.find(c => c.id === invoice.customer_id)?.name || invoice.customer_id;
  const soNumber = invoice.sales_order_id ? salesOrders.find(so => so.id === invoice.sales_order_id)?.order_number : null;
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [invoiceLayout, setInvoiceLayout] = useState({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '',
    footer: 'Thank you for your business!'
  });
  useEffect(() => {
    const fetchLayout = async () => {
      try {
        console.log('Fetching invoice layout...');
        const { data, error } = await supabase
          .from('settings')
          .select('invoice_layout')
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching invoice layout:', error);
          return;
        }
        console.log('Settings data received:', data);
        if (data && data.invoice_layout) {
          console.log('Loaded invoice layout:', data.invoice_layout);
          setInvoiceLayout(data.invoice_layout);
        } else {
          console.log('No invoice layout found in settings, using defaults');
          // Keep the default values
        }
      } catch (err) {
        console.error('Error in fetchLayout:', err);
      }
    };
    
    if (open) {
      fetchLayout();
    }
  }, [open]);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice_${invoice.invoice_number}`,
  });
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice #{invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div><strong>Customer:</strong> {customerName}</div>
          {soNumber && <div><strong>Sales Order:</strong> {soNumber}</div>}
          <div><strong>Issue Date:</strong> {invoice.issue_date}</div>
          <div><strong>Due Date:</strong> {invoice.due_date || '-'}</div>
          <div><strong>Total Amount:</strong> GHS {invoice.total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div><strong>Status:</strong> {invoice.status}</div>
        </div>
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Payments</h3>
          {payments.length === 0 ? (
            <div className="text-gray-500">No payments recorded.</div>
          ) : (
            <ul className="space-y-1">
              {payments.map(p => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.payment_date}</span>
                  <span>GHS {p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span>{p.method || '-'}</span>
                  <span>{p.reference || '-'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onRecordPayment} className="bg-brand-primary text-white">Record Payment</Button>
          <Button onClick={handlePrint} variant="outline" disabled={isPrinting}>
            {isPrinting ? 'Printing...' : 'Print'}
          </Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
        {/* Printable invoice layout (off-screen, not display:none) */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={printRef} style={{ padding: 40, fontFamily: 'Arial, sans-serif', color: '#333', width: 800, background: '#fff', fontSize: '14px', lineHeight: '1.4' }}>
            {/* Header */}
            <div style={{ borderBottom: '3px solid #333', paddingBottom: 20, marginBottom: 30, textAlign: 'center' }}>
              {invoiceLayout.logoUrl && (
                <img 
                  src={invoiceLayout.logoUrl} 
                  alt="Company Logo" 
                  style={{ height: 60, margin: '0 auto 15px', objectFit: 'contain' }} 
                />
              )}
              <h1 style={{ margin: 0, fontSize: 36, fontWeight: 'bold', letterSpacing: 3, color: '#333' }}>INVOICE</h1>
              <div style={{ marginTop: 15 }}>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>
                  {invoiceLayout.businessName || 'Your Business Name'}
                </div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 3 }}>
                  {invoiceLayout.address || 'Business Address'}
                </div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 3 }}>
                  Phone: {invoiceLayout.phone || 'Phone Number'}
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  Email: {invoiceLayout.email || 'Email Address'}
                </div>
              </div>
            </div>
            
            {/* Invoice Info and Customer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
              <div style={{ width: '48%' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: 16, fontWeight: 'bold', color: '#333' }}>Bill To:</h3>
                                 <div style={{ padding: 15, backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 5 }}>
                   <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>{customerName}</div>
                 </div>
              </div>
              <div style={{ width: '48%', textAlign: 'right' }}>
                <div style={{ padding: 15, backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 5 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 'bold', fontSize: 16 }}>Invoice #: </span>
                    <span style={{ fontSize: 16, color: '#007bff' }}>{invoice.invoice_number}</span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>Issue Date: </span>
                    <span>{formatDateDisplay(invoice.issue_date)}</span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>Due Date: </span>
                    <span>{invoice.due_date ? formatDateDisplay(invoice.due_date) : 'Not specified'}</span>
                  </div>
                                     {soNumber && (
                     <div style={{ marginBottom: 8 }}>
                       <span style={{ fontWeight: 'bold' }}>Sales Order: </span>
                       <span>{soNumber}</span>
                     </div>
                   )}
                  <div>
                    <span style={{ fontWeight: 'bold' }}>Status: </span>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      fontSize: 12, 
                      fontWeight: 'bold',
                      backgroundColor: invoice.status === 'paid' ? '#d4edda' : 
                                     invoice.status === 'overdue' ? '#f8d7da' : 
                                     invoice.status === 'partial' ? '#fff3cd' : '#e2e3e5',
                      color: invoice.status === 'paid' ? '#155724' : 
                             invoice.status === 'overdue' ? '#721c24' : 
                             invoice.status === 'partial' ? '#856404' : '#383d41'
                    }}>
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Invoice Items Section */}
            <div style={{ marginBottom: 30 }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: 16, fontWeight: 'bold', color: '#333' }}>Invoice Details:</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                    <th style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'center', fontWeight: 'bold', width: '15%' }}>Qty</th>
                    <th style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right', fontWeight: 'bold', width: '20%' }}>Unit Price</th>
                    <th style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right', fontWeight: 'bold', width: '20%' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get sales order items if this invoice is linked to a sales order
                    const salesOrder = invoice.sales_order_id ? salesOrders.find(so => so.id === invoice.sales_order_id) : null;
                    const items = salesOrder?.items || [];
                    
                    if (items.length > 0) {
                      return items.map((item: any, idx: number) => {
                        const product = inventoryItems.find(i => i.id === item.inventory_item_id)?.name || 'Unknown Product';
                        const unitPrice = item.unit_price || 0;
                        const quantity = item.quantity || 0;
                        const total = unitPrice * quantity;
                        
                        return (
                          <tr key={item.id || idx}>
                            <td style={{ border: '1px solid #dee2e6', padding: 12 }}>
                              {product}
                              {item.description && (
                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'center' }}>
                              {quantity}
                            </td>
                            <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right' }}>
                              {formatCurrencyDisplay(unitPrice)}
                            </td>
                            <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right', fontWeight: 'bold' }}>
                              {formatCurrencyDisplay(total)}
                            </td>
                          </tr>
                        );
                      });
                    } else {
                      // Fallback to generic line item if no sales order items
                      return (
                        <tr>
                          <td style={{ border: '1px solid #dee2e6', padding: 12 }}>
                            {soNumber ? `Services as per Sales Order ${soNumber}` : 'Invoice Services'}
                          </td>
                          <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'center' }}>1</td>
                          <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right' }}>
                            {formatCurrencyDisplay(invoice.total_amount)}
                          </td>
                          <td style={{ border: '1px solid #dee2e6', padding: 12, textAlign: 'right', fontWeight: 'bold' }}>
                            {formatCurrencyDisplay(invoice.total_amount)}
                          </td>
                        </tr>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Total Section */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
              <div style={{ width: '300px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333', fontSize: 18 }}>
                        Total Amount:
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333', fontSize: 18, color: '#007bff' }}>
                        {formatCurrencyDisplay(invoice.total_amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Payment History */}
            {payments.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: 16, fontWeight: 'bold', color: '#333' }}>Payment History:</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ border: '1px solid #dee2e6', padding: 10, textAlign: 'left', fontWeight: 'bold' }}>Date</th>
                      <th style={{ border: '1px solid #dee2e6', padding: 10, textAlign: 'right', fontWeight: 'bold' }}>Amount</th>
                      <th style={{ border: '1px solid #dee2e6', padding: 10, textAlign: 'left', fontWeight: 'bold' }}>Method</th>
                      <th style={{ border: '1px solid #dee2e6', padding: 10, textAlign: 'left', fontWeight: 'bold' }}>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ border: '1px solid #dee2e6', padding: 10 }}>
                          {formatDateDisplay(p.payment_date)}
                        </td>
                        <td style={{ border: '1px solid #dee2e6', padding: 10, textAlign: 'right', fontWeight: 'bold', color: '#28a745' }}>
                          {formatCurrencyDisplay(p.amount)}
                        </td>
                        <td style={{ border: '1px solid #dee2e6', padding: 10 }}>{p.method || '-'}</td>
                        <td style={{ border: '1px solid #dee2e6', padding: 10 }}>{p.reference || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Outstanding Balance */}
                <div style={{ marginTop: 15, textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                    Outstanding Balance: 
                    <span style={{ 
                      color: invoice.total_amount - payments.reduce((sum, p) => sum + p.amount, 0) > 0 ? '#dc3545' : '#28a745',
                      marginLeft: 10
                    }}>
                      {formatCurrencyDisplay(invoice.total_amount - payments.reduce((sum, p) => sum + p.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Footer */}
            <div style={{ 
              borderTop: '2px solid #333', 
              paddingTop: 20, 
              marginTop: 40, 
              textAlign: 'center',
              fontSize: 14,
              color: '#666'
            }}>
              <div style={{ marginBottom: 10, fontStyle: 'italic' }}>
                {invoiceLayout.footer || 'Thank you for your business!'}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                This invoice was generated on {formatDateDisplay(new Date())} at {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 