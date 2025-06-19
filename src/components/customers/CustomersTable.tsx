import React from 'react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Customer } from '@/types/customer';

interface CustomersTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onCreate: () => void;
}

export const CustomersTable: React.FC<CustomersTableProps> = ({ customers, onEdit, onDelete, onCreate }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Customers</h2>
        <Button onClick={onCreate} className="bg-brand-primary text-white">
          <Plus className="h-4 w-4 mr-1" /> New Customer
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-2 text-left">Name</th>
              <th className="py-2 px-2 text-left">Email</th>
              <th className="py-2 px-2 text-left">Phone</th>
              <th className="py-2 px-2 text-left">Address</th>
              <th className="py-2 px-2 text-left">Created</th>
              <th className="py-2 px-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">No customers found.</td>
              </tr>
            )}
            {customers.map(customer => (
              <tr key={customer.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-2 font-medium">{customer.name}</td>
                <td className="py-2 px-2">{customer.email || '-'}</td>
                <td className="py-2 px-2">{customer.phone || '-'}</td>
                <td className="py-2 px-2">{customer.address || '-'}</td>
                <td className="py-2 px-2">{customer.created_at ? (
                  isNaN(new Date(customer.created_at).getTime())
                    ? '-'
                    : format(new Date(customer.created_at), 'MMM dd, yyyy')
                ) : '-'}</td>
                <td className="py-2 px-2 text-center">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(customer)} title="Edit">
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(customer)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 