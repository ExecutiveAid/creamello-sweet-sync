
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  searchable?: boolean;
  onSearch?: (query: string) => void;
  onRowClick?: (row: T) => void;
  actionButtons?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  title,
  searchable = false,
  onSearch,
  onRowClick,
  actionButtons,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className="creamello-card animate-fade-in">
      {(title || searchable || actionButtons) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {searchable && (
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10 w-full sm:w-[200px]"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            )}
            
            {actionButtons && (
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                {actionButtons}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => (
                <TableRow 
                  key={rowIndex} 
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex}>
                      {column.cell 
                        ? column.cell(row)
                        : typeof column.accessorKey === 'function' 
                          ? column.accessorKey(row)
                          : String(row[column.accessorKey] || '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
