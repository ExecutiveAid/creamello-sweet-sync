
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Product, generateProducts } from '@/data/mockData';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load mock data
  useEffect(() => {
    const data = generateProducts();
    setProducts(data);
    setFilteredProducts(data);
  }, []);

  // Handle search
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

  const handleRefresh = () => {
    const data = generateProducts();
    setProducts(data);
    setFilteredProducts(data);
    toast({
      title: "Data Refreshed",
      description: "Inventory data has been refreshed."
    });
  };

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
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>View Stock Alerts</Button>
        </div>
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
              <div>${row.pricePerUnit.toFixed(2)}</div>
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
