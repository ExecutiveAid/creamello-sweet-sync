import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ingredient, generateIngredients } from '@/data/mockData';
import { Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, addDays, differenceInDays } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIngredientInventory } from '@/context/IngredientInventoryContext';

const Ingredients = () => {
  const { ingredients } = useIngredientInventory();
  const [filteredIngredients, setFilteredIngredients] = useState(ingredients);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
    name: '',
    unit: 'kg',
    quantity: 0,
    threshold: 0,
    expirationDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    supplier: '',
    pricePerUnit: 0,
  });

  useEffect(() => {
    setFilteredIngredients(ingredients);
  }, [ingredients]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = ingredients.filter(ingredient => 
        ingredient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ingredient.supplier.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredIngredients(filtered);
    } else {
      setFilteredIngredients(ingredients);
    }
  }, [searchQuery, ingredients]);

  useEffect(() => {
    ingredients.forEach(ingredient => {
      if (ingredient.quantity <= ingredient.threshold) {
        toast({
          title: 'Low Stock Alert',
          description: `${ingredient.name} is low in stock (${ingredient.quantity} left).`,
          variant: 'destructive',
        });
      }
      const daysToExpiry = differenceInDays(parseISO(ingredient.expirationDate), new Date());
      if (daysToExpiry >= 0 && daysToExpiry <= 7) {
        toast({
          title: 'Expiry Alert',
          description: `${ingredient.name} expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}!`,
          variant: 'default',
        });
      }
    });
    // Only run on initial mount
    // eslint-disable-next-line
  }, []);

  const handleAddIngredient = () => {
    if (!newIngredient.name || !newIngredient.quantity || !newIngredient.unit) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const newId = (Math.max(...ingredients.map(i => parseInt(i.id))) + 1).toString();
    const ingredientToAdd: Ingredient = {
      id: newId,
      name: newIngredient.name,
      unit: newIngredient.unit!,
      quantity: newIngredient.quantity!,
      threshold: newIngredient.threshold || 0,
      expirationDate: newIngredient.expirationDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      supplier: newIngredient.supplier || 'Not specified',
      lastRestocked: format(new Date(), 'yyyy-MM-dd'),
      pricePerUnit: newIngredient.pricePerUnit || 0,
    };

    // Assuming you have a function to add a new ingredient to the context
    // This is a placeholder and should be replaced with the actual implementation
    toast({
      title: "Ingredient Added",
      description: `${ingredientToAdd.name} has been added to inventory.`
    });

    // Reset form
    setNewIngredient({
      name: '',
      unit: 'kg',
      quantity: 0,
      threshold: 0,
      expirationDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      supplier: '',
      pricePerUnit: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Ingredients</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => {}}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Ingredient
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredIngredients}
        columns={[
          {
            header: "Name",
            accessorKey: "name",
          },
          {
            header: "Quantity",
            cell: (row) => (
              <div className={row.quantity <= row.threshold ? "text-red-500 font-medium" : ""}>
                {row.quantity} {row.unit}
                {row.quantity <= row.threshold && (
                  <AlertTriangle className="inline ml-2 h-4 w-4" />
                )}
              </div>
            ),
            accessorKey: "quantity"
          },
          {
            header: "Threshold",
            cell: (row) => (
              <div>{row.threshold} {row.unit}</div>
            ),
            accessorKey: "threshold"
          },
          {
            header: "Supplier",
            accessorKey: "supplier",
          },
          {
            header: "Expiration Date",
            cell: (row) => {
              const expiryDate = parseISO(row.expirationDate);
              const isExpiringSoon = isAfter(expiryDate, new Date()) && 
                isAfter(addDays(new Date(), 14), expiryDate);
              const isExpired = isAfter(new Date(), expiryDate);
              
              return (
                <div className={`
                  ${isExpired ? "text-red-500" : ""} 
                  ${isExpiringSoon ? "text-amber-500" : ""}
                  ${!isExpiringSoon && !isExpired ? "" : "font-medium"}
                `}>
                  {format(parseISO(row.expirationDate), 'MMM dd, yyyy')}
                  {(isExpiringSoon || isExpired) && (
                    <AlertTriangle className="inline ml-2 h-4 w-4" />
                  )}
                </div>
              );
            },
            accessorKey: "expirationDate"
          },
          {
            header: "Price",
            cell: (row) => (
              <div>GHS{row.pricePerUnit.toFixed(2)} / {row.unit}</div>
            ),
            accessorKey: "pricePerUnit"
          },
        ]}
        title="Ingredients Inventory"
        searchable={true}
        onSearch={setSearchQuery}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Ingredient</DialogTitle>
            <DialogDescription>
              Enter the details of the ingredient to add to inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name *
              </Label>
              <Input
                id="name"
                value={newIngredient.name}
                onChange={(e) => setNewIngredient({...newIngredient, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                value={newIngredient.quantity || ''}
                onChange={(e) => setNewIngredient({...newIngredient, quantity: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unit *
              </Label>
              <Select 
                value={newIngredient.unit} 
                onValueChange={(value) => setNewIngredient({...newIngredient, unit: value})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="g">Grams (g)</SelectItem>
                  <SelectItem value="liters">Liters (L)</SelectItem>
                  <SelectItem value="ml">Milliliters (ml)</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="threshold" className="text-right">
                Threshold
              </Label>
              <Input
                id="threshold"
                type="number"
                value={newIngredient.threshold || ''}
                onChange={(e) => setNewIngredient({...newIngredient, threshold: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiry" className="text-right">
                Expiry Date
              </Label>
              <Input
                id="expiry"
                type="date"
                value={newIngredient.expirationDate}
                onChange={(e) => setNewIngredient({...newIngredient, expirationDate: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="supplier" className="text-right">
                Supplier
              </Label>
              <Input
                id="supplier"
                value={newIngredient.supplier || ''}
                onChange={(e) => setNewIngredient({...newIngredient, supplier: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price / Unit
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newIngredient.pricePerUnit || ''}
                onChange={(e) => setNewIngredient({...newIngredient, pricePerUnit: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddIngredient}>Add Ingredient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ingredients;
