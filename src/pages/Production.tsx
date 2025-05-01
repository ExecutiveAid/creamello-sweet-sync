import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ProductionBatch, Recipe, generateProductionBatches, generateRecipes } from '@/data/mockData';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useIngredientInventory } from '@/context/IngredientInventoryContext';

const Production = () => {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<ProductionBatch[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newBatch, setNewBatch] = useState<Partial<ProductionBatch>>({
    recipeId: '',
    recipeName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: 0,
    producedBy: '',
    notes: '',
    status: 'planned',
  });

  const { deductIngredient } = useIngredientInventory();

  // Load mock data
  useEffect(() => {
    const batchData = generateProductionBatches();
    const recipeData = generateRecipes();
    setBatches(batchData);
    setFilteredBatches(batchData);
    setRecipes(recipeData);
  }, []);

  // Handle search
  useEffect(() => {
    if (searchQuery) {
      const filtered = batches.filter(batch => 
        batch.recipeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.producedBy.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBatches(filtered);
    } else {
      setFilteredBatches(batches);
    }
  }, [searchQuery, batches]);

  const handleRecipeChange = (recipeId: string) => {
    const selectedRecipe = recipes.find(recipe => recipe.id === recipeId);
    if (selectedRecipe) {
      setNewBatch({
        ...newBatch,
        recipeId,
        recipeName: selectedRecipe.name,
        quantity: selectedRecipe.outputQuantity,
      });
    }
  };

  const handleAddBatch = () => {
    if (!newBatch.recipeId || !newBatch.date || !newBatch.producedBy) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const newId = (Math.max(...batches.map(b => parseInt(b.id))) + 1).toString();
    const batchToAdd: ProductionBatch = {
      id: newId,
      recipeId: newBatch.recipeId!,
      recipeName: newBatch.recipeName!,
      date: newBatch.date!,
      quantity: newBatch.quantity!,
      producedBy: newBatch.producedBy!,
      notes: newBatch.notes || '',
      status: newBatch.status as 'completed' | 'in-progress' | 'planned',
    };

    setBatches([...batches, batchToAdd]);
    setDialogOpen(false);
    toast({
      title: "Production Batch Added",
      description: `${batchToAdd.recipeName} batch has been added to production schedule.`
    });

    // Reset form
    setNewBatch({
      recipeId: '',
      recipeName: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      quantity: 0,
      producedBy: '',
      notes: '',
      status: 'planned',
    });

    if (batchToAdd.status === 'completed') {
      const recipe = recipes.find(r => r.id === batchToAdd.recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          deductIngredient(ing.ingredientId, ing.quantity * batchToAdd.quantity / recipe.outputQuantity);
        });
      }
    }
  };

  const handleRefresh = () => {
    const data = generateProductionBatches();
    setBatches(data);
    setFilteredBatches(data);
    toast({
      title: "Data Refreshed",
      description: "Production data has been refreshed."
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'planned':
        return <Badge className="bg-amber-500">Planned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Production</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Production Batch
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredBatches}
        columns={[
          {
            header: "Recipe",
            accessorKey: "recipeName",
          },
          {
            header: "Date",
            accessorKey: "date",
          },
          {
            header: "Quantity",
            cell: (row) => <div>{row.quantity} liters</div>,
            accessorKey: "quantity"
          },
          {
            header: "Produced By",
            accessorKey: "producedBy",
          },
          {
            header: "Status",
            cell: (row) => getStatusBadge(row.status),
            accessorKey: "status"
          },
          {
            header: "Notes",
            accessorKey: "notes",
          },
        ]}
        title="Production Batches"
        searchable={true}
        onSearch={setSearchQuery}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Production Batch</DialogTitle>
            <DialogDescription>
              Schedule a new production batch for gelato making.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recipe" className="text-right">
                Recipe *
              </Label>
              <div className="col-span-3">
                <Select 
                  value={newBatch.recipeId} 
                  onValueChange={handleRecipeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map(recipe => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={newBatch.date}
                onChange={(e) => setNewBatch({...newBatch, date: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity (L)
              </Label>
              <Input
                id="quantity"
                type="number"
                value={newBatch.quantity || ''}
                onChange={(e) => setNewBatch({...newBatch, quantity: parseFloat(e.target.value)})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="producer" className="text-right">
                Produced By *
              </Label>
              <Input
                id="producer"
                value={newBatch.producedBy || ''}
                onChange={(e) => setNewBatch({...newBatch, producedBy: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select 
                value={newBatch.status} 
                onValueChange={(value) => setNewBatch({...newBatch, status: value as 'completed' | 'in-progress' | 'planned'})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={newBatch.notes || ''}
                onChange={(e) => setNewBatch({...newBatch, notes: e.target.value})}
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBatch}>Add Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Production;
