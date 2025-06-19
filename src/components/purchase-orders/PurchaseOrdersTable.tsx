import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Pencil, Trash2, Plus, Lock, AlertTriangle } from 'lucide-react';
import { PurchaseOrder, PurchaseOrderStatus } from '@/types/purchaseOrder';
import { formatCurrencyDisplay, formatDateDisplay } from '@/utils/formatters';

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: { id: string; name: string }[];
  onCreate: () => void;
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
  onView: (po: PurchaseOrder) => void;
}

const statusColors: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-200 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-gray-300 text-gray-800',
  cancelled: 'bg-red-100 text-red-700',
};

// Industry-standard business rules for PO actions
const canEdit = (status: PurchaseOrderStatus): boolean => {
  // Only draft and sent orders can be edited
  return status === 'draft' || status === 'sent';
};

const canDelete = (status: PurchaseOrderStatus): boolean => {
  // Only draft orders can be deleted
  return status === 'draft';
};

const canCancel = (status: PurchaseOrderStatus): boolean => {
  // Can cancel draft, sent, or partially received orders
  return status === 'draft' || status === 'sent' || status === 'partially_received';
};

export const PurchaseOrdersTable: React.FC<PurchaseOrdersTableProps> = ({ 
  purchaseOrders, 
  suppliers, 
  onCreate, 
  onEdit, 
  onDelete, 
  onView 
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const filtered = purchaseOrders.filter(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false;
    if (supplierFilter !== 'all' && po.supplier_id !== supplierFilter) return false;
    if (dateFilter && po.order_date !== dateFilter) return false;
    if (search && !po.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleRowClick = (po: PurchaseOrder) => {
    onView(po);
  };

  const handleEdit = (e: React.MouseEvent, po: PurchaseOrder) => {
    e.stopPropagation(); // Prevent row click
    if (canEdit(po.status)) {
      onEdit(po);
    }
  };

  const handleDelete = (e: React.MouseEvent, po: PurchaseOrder) => {
    e.stopPropagation(); // Prevent row click
    if (canDelete(po.status)) {
      if (window.confirm('Are you sure you want to delete this draft purchase order? This action cannot be undone.')) {
        onDelete(po);
      }
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
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partially_received">Partially Received</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
          <Plus className="h-4 w-4 mr-1" /> New Purchase Order
        </Button>
      </div>

      {/* Info box about business rules */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 text-sm">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 text-blue-600 mr-2" />
          <span className="font-medium text-blue-800">Business Rules:</span>
        </div>
        <div className="text-blue-700 mt-1">
          • Click any row to view details • Only <strong>Draft</strong> orders can be deleted • Only <strong>Draft</strong> and <strong>Sent</strong> orders can be edited
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Order #</th>
              <th className="py-2 px-2 text-left">Supplier</th>
              <th className="py-2 px-2 text-left">Order Date</th>
              <th className="py-2 px-2 text-left">Status</th>
              <th className="py-2 px-2 text-right">Total</th>
              <th className="py-2 px-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">No purchase orders found.</td>
              </tr>
            )}
            {filtered.map(po => (
              <tr 
                key={po.id} 
                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(po)}
              >
                <td className="py-2 px-2 font-mono">{po.order_number}</td>
                <td className="py-2 px-2">{suppliers.find(s => s.id === po.supplier_id)?.name || '-'}</td>
                <td className="py-2 px-2">{formatDateDisplay(po.order_date)}</td>
                <td className="py-2 px-2">
                  <Badge className={statusColors[po.status]}>{po.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="py-2 px-2 text-right font-semibold">{formatCurrencyDisplay(po.total_amount)}</td>
                <td className="py-2 px-2 text-center">
                  <div className="flex justify-center gap-1">
                    {canEdit(po.status) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleEdit(e, po)} 
                        title="Edit Order"
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title="Cannot edit - order is past draft/sent stage"
                        className="h-8 w-8"
                      >
                        <Lock className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                    
                    {canDelete(po.status) ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleDelete(e, po)} 
                        title="Delete Draft Order"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled 
                        title="Cannot delete - only draft orders can be deleted"
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