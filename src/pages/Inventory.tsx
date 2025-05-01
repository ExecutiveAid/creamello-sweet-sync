import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Product, generateProducts } from '@/data/mockData';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, addDays, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useProductInventory } from '@/context/ProductInventoryContext';
import { exportToCSV } from '@/utils/exportCSV';
import { Input } from '@/components/ui/input';

const Inventory = () => {
  const { products } = useProductInventory();
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  useEffect(() => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(product => product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.category.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (startDate) {
      filtered = filtered.filter(product => product.dateCreated >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(product => product.dateCreated <= endDate);
    }
    setFilteredProducts(filtered);
  }, [searchQuery, products, startDate, endDate]);

  useEffect(() => {
    // Low stock notifications
    products.forEach(product => {
      if (product.availableQuantity <= 6) {
        toast({
          title: 'Low Stock Alert',
          description: `${product.name} is low in stock (${product.availableQuantity} left).`,
          variant: 'destructive',
        });
      }
      // Expiry notifications
      const daysToExpiry = differenceInDays(parseISO(product.expirationDate), new Date());
      if (daysToExpiry >= 0 && daysToExpiry <= 7) {
        toast({
          title: 'Expiry Alert',
          description: `${product.name} expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}!`,
          variant: 'default',
        });
      }
    });
    // Only run on initial mount
    // eslint-disable-next-line
  }, []);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'gelato':
        return <Badge className="bg-creamello-purple text-white">Gelato</Badge>;
      case 'sorbet':
        return <Badge className="bg-creamello-blue text-foreground">Sorbet</Badge>;
      case 'specialty':
        return <Badge className="bg-creamello-pink text-foreground">Specialty</Badge>;
      default:
        return <Badge>{category}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>View Stock Alerts</Button>
          <Button
            variant="outline"
            onClick={() => exportToCSV(
              filteredProducts,
              'inventory.csv',
              [
                { key: 'name', label: 'Name' },
                { key: 'category', label: 'Category' },
                { key: 'availableQuantity', label: 'Available' },
                { key: 'unit', label: 'Unit' },
                { key: 'pricePerUnit', label: 'Price' },
                { key: 'expirationDate', label: 'Expiration Date' },
              ]
            )}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-2 items-center mb-2">
        <label>From:</label>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{maxWidth: 160}} />
        <label>To:</label>
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{maxWidth: 160}} />
        <Button
          variant="outline"
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
          disabled={!startDate && !endDate}
        >Clear</Button>
      </div>

      <DataTable
        data={filteredProducts}
        columns={[
          {
            header: "Product",
            accessorKey: "name",
          },
          {
            header: "Category",
            cell: (row) => getCategoryBadge(row.category),
            accessorKey: "category"
          },
          {
            header: "Available",
            cell: (row) => (
              <div className={row.availableQuantity < 6 ? "text-amber-500 font-medium" : ""}>
                {row.availableQuantity} {row.unit}
                {row.availableQuantity < 6 && (
                  <AlertTriangle className="inline ml-2 h-4 w-4" />
                )}
              </div>
            ),
            accessorKey: "availableQuantity"
          },
          {
            header: "Price",
            cell: (row) => (
              <div>GHS{row.pricePerUnit.toFixed(2)}</div>
            ),
            accessorKey: "pricePerUnit"
          },
          {
            header: "Created",
            accessorKey: "dateCreated",
            cell: (row) => format(parseISO(row.dateCreated), 'MMM dd, yyyy')
          },
          {
            header: "Expires",
            accessorKey: "expirationDate",
            cell: (row) => {
              const expiryDate = parseISO(row.expirationDate);
              const isExpiringSoon = isAfter(expiryDate, new Date()) && 
                isAfter(addDays(new Date(), 5), expiryDate);
              
              return (
                <div className={isExpiringSoon ? "text-amber-500 font-medium" : ""}>
                  {format(expiryDate, 'MMM dd, yyyy')}
                  {isExpiringSoon && (
                    <AlertTriangle className="inline ml-2 h-4 w-4" />
                  )}
                </div>
              );
            }
          },
        ]}
        title="Product Inventory"
        searchable={true}
        onSearch={setSearchQuery}
      />
    </div>
  );
};

export default Inventory;
