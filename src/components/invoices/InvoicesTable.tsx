import React from 'react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Invoice } from '@/types/invoice';
import { Banknote, Lock, AlertTriangle, Eye } from 'lucide-react';
import { formatCurrencyDisplay, formatDateDisplay } from '@/utils/formatters';

interface InvoicesTableProps {
  invoices: Invoice[];
  customers: { id: string; name: string }[];
  salesOrders: { id: string; order_number: string }[];
  onView: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
}

const statusColors: Record<string, string> = {
  unpaid: 'bg-gray-200 text-gray-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-300 text-gray-800',
};

// Business rules for Invoice actions - VIEW ONLY SYSTEM
const canRecordPayment = (invoice: Invoice): boolean => {
  // Can record payments for unpaid, partial, or overdue invoices
  return invoice.status === 'unpaid' || invoice.status === 'partial' || invoice.status === 'overdue';
};

export const InvoicesTable: React.FC<InvoicesTableProps> = ({ 
  invoices, 
  customers, 
  salesOrders, 
  onView, 
  onRecordPayment 
}) => {
  const handleRowClick = (invoice: Invoice) => {
    onView(invoice);
  };

  const handleRecordPayment = (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation(); // Prevent row click
    if (canRecordPayment(invoice)) {
      onRecordPayment(invoice);
    }
  };

  const getPaymentTooltip = (invoice: Invoice): string => {
    return canRecordPayment(invoice) ? 'Record Payment' : `Cannot record payment - invoice is ${invoice.status}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Invoices</h2>
        <div className="text-sm text-gray-600">
          Invoices are generated from Sales Orders
        </div>
      </div>

      {/* Info box about business rules */}
      <div className="bg-green-50 border-l-4 border-green-400 p-3 mb-4 text-sm">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 text-green-600 mr-2" />
          <span className="font-medium text-green-800">Invoice Management:</span>
        </div>
        <div className="text-green-700 mt-1">
          • Click any row to view invoice details and print • Invoices are <strong>automatically generated</strong> from Sales Orders • <strong>View-only system</strong> - no manual editing • Record payments for <strong>Unpaid</strong>, <strong>Partial</strong>, or <strong>Overdue</strong> invoices
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Invoice #</th>
              <th className="py-2 px-2 text-left">SO #</th>
              <th className="py-2 px-2 text-left">Customer</th>
              <th className="py-2 px-2 text-left">Issue Date</th>
              <th className="py-2 px-2 text-left">Due Date</th>
              <th className="py-2 px-2 text-right">Amount</th>
              <th className="py-2 px-2 text-left">Status</th>
              <th className="py-2 px-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">
                  No invoices found. Generate invoices from Sales Orders.
                </td>
              </tr>
            )}
            {invoices.map(invoice => (
              <tr 
                key={invoice.id} 
                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(invoice)}
              >
                <td className="py-2 px-2 font-mono font-semibold text-blue-600">{invoice.invoice_number}</td>
                <td className="py-2 px-2 font-mono">
                  {invoice.sales_order_id ? 
                    (salesOrders.find(so => so.id === invoice.sales_order_id)?.order_number || invoice.sales_order_id) : 
                    '-'
                  }
                </td>
                <td className="py-2 px-2">{customers.find(c => c.id === invoice.customer_id)?.name || '-'}</td>
                <td className="py-2 px-2">{formatDateDisplay(invoice.issue_date)}</td>
                <td className="py-2 px-2">{invoice.due_date ? formatDateDisplay(invoice.due_date) : '-'}</td>
                <td className="py-2 px-2 text-right font-semibold">{formatCurrencyDisplay(invoice.total_amount)}</td>
                <td className="py-2 px-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[invoice.status] || 'bg-gray-100 text-gray-800'}`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <div className="flex justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRowClick(invoice)} 
                      title="View Invoice Details"
                      className="h-8 w-8"
                    >
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>

                    {canRecordPayment(invoice) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleRecordPayment(e, invoice)} 
                        title={getPaymentTooltip(invoice)}
                        className="h-8 w-8"
                      >
                        <Banknote className="h-4 w-4 text-green-600" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title={getPaymentTooltip(invoice)}
                        className="h-8 w-8"
                      >
                        <Lock className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 