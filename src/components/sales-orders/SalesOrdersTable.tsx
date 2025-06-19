import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Pencil, Trash2, Plus, FileText, Lock, AlertTriangle, Receipt } from 'lucide-react';
import { SalesOrder, SalesOrderStatus } from '@/types/salesOrder';
import { formatCurrencyDisplay, formatDateDisplay } from '@/utils/formatters';

interface SalesOrdersTableProps {
  salesOrders: SalesOrder[];
  customers: { id: string; name: string }[];
  onCreate: () => void;
  onEdit: (so: SalesOrder) => void;
  onDelete: (so: SalesOrder) => void;
  onView: (so: SalesOrder) => void;
  onGenerateInvoice: (so: SalesOrder) => void;
}

const statusColors: Record<SalesOrderStatus, string> = {
  draft: 'bg-gray-200 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  closed: 'bg-gray-300 text-gray-800',
  cancelled: 'bg-red-100 text-red-700',
};

// Industry-standard business rules for SO actions
const canEdit = (so: SalesOrder): boolean => {
  // Cannot edit if invoice has been generated or if delivered/cancelled
  if (so.invoice_generated) return false;
  return so.status === 'draft' || so.status === 'confirmed';
};

const canDelete = (so: SalesOrder): boolean => {
  // Cannot delete if invoice has been generated or if not draft
  if (so.invoice_generated) return false;
  return so.status === 'draft';
};

const canGenerateInvoice = (so: SalesOrder): boolean => {
  // Can generate invoice for confirmed, partially_fulfilled, or fulfilled orders that don't have invoices yet
  if (so.invoice_generated) return false;
  return so.status === 'confirmed' || so.status === 'partially_fulfilled' || so.status === 'fulfilled';
};

const canCancel = (so: SalesOrder): boolean => {
  // Cannot cancel if invoice generated or already fulfilled/closed/cancelled
  if (so.invoice_generated) return false;
  return so.status !== 'fulfilled' && so.status !== 'closed' && so.status !== 'cancelled';
};

export const SalesOrdersTable: React.FC<SalesOrdersTableProps> = ({ 
  salesOrders, 
  customers, 
  onCreate, 
  onEdit, 
  onDelete, 
  onView,
  onGenerateInvoice
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const filtered = salesOrders.filter(so => {
    if (statusFilter !== 'all' && so.status !== statusFilter) return false;
    if (customerFilter !== 'all' && so.customer_id !== customerFilter) return false;
    if (dateFilter && so.order_date !== dateFilter) return false;
    if (search && !so.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleRowClick = (so: SalesOrder) => {
    onView(so);
  };

  const handleEdit = (e: React.MouseEvent, so: SalesOrder) => {
    e.stopPropagation(); // Prevent row click
    if (canEdit(so)) {
      onEdit(so);
    }
  };

  const handleDelete = (e: React.MouseEvent, so: SalesOrder) => {
    e.stopPropagation(); // Prevent row click
    if (canDelete(so)) {
      if (window.confirm('Are you sure you want to delete this draft sales order? This action cannot be undone.')) {
        onDelete(so);
      }
    }
  };

  const handleGenerateInvoice = (e: React.MouseEvent, so: SalesOrder) => {
    e.stopPropagation(); // Prevent row click
    if (canGenerateInvoice(so)) {
      if (window.confirm(`Generate invoice for Sales Order ${so.order_number}? This will create an invoice and lock the sales order.`)) {
        onGenerateInvoice(so);
      }
    }
  };

  const getActionTooltip = (so: SalesOrder, action: 'edit' | 'delete' | 'invoice'): string => {
    if (so.invoice_generated && (action === 'edit' || action === 'delete')) {
      return `Cannot ${action} - invoice has been generated`;
    }
    
    switch (action) {
      case 'edit':
        return canEdit(so) ? 'Edit Order' : `Cannot edit - order is past ${so.status} stage`;
      case 'delete':
        return canDelete(so) ? 'Delete Draft Order' : 'Cannot delete - only draft orders can be deleted';
      case 'invoice':
        if (so.invoice_generated) return 'Invoice already generated';
        return canGenerateInvoice(so) ? 'Generate Invoice' : 'Cannot generate invoice - order must be confirmed first';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search Order #"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-40"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-36"
          />
        </div>
        
        <Button onClick={onCreate} className="bg-brand-primary text-white">
          <Plus className="h-4 w-4 mr-1" /> New Sales Order
        </Button>
      </div>

      {/* Info box about business rules */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 text-sm">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 text-blue-600 mr-2" />
          <span className="font-medium text-blue-800">Business Rules:</span>
        </div>
        <div className="text-blue-700 mt-1">
          • Click any row to view details • Generate invoices directly from <strong>Confirmed</strong> orders • <strong>No changes allowed</strong> once invoice is generated • Only <strong>Draft</strong> orders can be deleted
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Order #</th>
              <th className="py-2 px-2 text-left">Customer</th>
              <th className="py-2 px-2 text-left">Order Date</th>
              <th className="py-2 px-2 text-left">Status</th>
              <th className="py-2 px-2 text-center">Invoice</th>
              <th className="py-2 px-2 text-right">Total</th>
              <th className="py-2 px-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">No sales orders found.</td>
              </tr>
            )}
            {filtered.map(so => (
              <tr 
                key={so.id} 
                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(so)}
              >
                <td className="py-2 px-2 font-mono">{so.order_number}</td>
                <td className="py-2 px-2">{customers.find(c => c.id === so.customer_id)?.name || '-'}</td>
                <td className="py-2 px-2">{formatDateDisplay(so.order_date)}</td>
                <td className="py-2 px-2">
                  <Badge className={statusColors[so.status]}>{so.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="py-2 px-2 text-center">
                  {so.invoice_generated ? (
                    <Badge className="bg-green-100 text-green-700">
                      <FileText className="h-3 w-3 mr-1" />
                      Generated
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600">
                      Pending
                    </Badge>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-semibold">{formatCurrencyDisplay(so.total_amount)}</td>
                <td className="py-2 px-2 text-center">
                  <div className="flex justify-center gap-1">
                    {canEdit(so) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleEdit(e, so)} 
                        title={getActionTooltip(so, 'edit')}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title={getActionTooltip(so, 'edit')}
                        className="h-8 w-8"
                      >
                        <Lock className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}

                    {canGenerateInvoice(so) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleGenerateInvoice(e, so)} 
                        title={getActionTooltip(so, 'invoice')}
                        className="h-8 w-8"
                      >
                        <Receipt className="h-4 w-4 text-green-600" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title={getActionTooltip(so, 'invoice')}
                        className="h-8 w-8"
                      >
                        {so.invoice_generated ? (
                          <FileText className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    )}
                    
                    {canDelete(so) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleDelete(e, so)} 
                        title={getActionTooltip(so, 'delete')}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title={getActionTooltip(so, 'delete')}
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