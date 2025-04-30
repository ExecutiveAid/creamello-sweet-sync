
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, IceCreamCone, CircleDollarSign } from 'lucide-react';

// Types for our ice cream ordering system
interface IceCreamFlavor {
  id: string;
  name: string;
  description: string;
  pricePerScoop: number;
  image: string;
  category: string; // e.g., "Classic", "Special", "Seasonal"
  available: boolean;
}

interface OrderItem {
  flavorId: string;
  flavorName: string;
  scoops: number;
  price: number;
}

// Sample ice cream flavor data
const iceCreamFlavors: IceCreamFlavor[] = [
  {
    id: "vanilla",
    name: "Classic Vanilla",
    description: "Rich and creamy classic vanilla bean",
    pricePerScoop: 12.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "chocolate",
    name: "Double Chocolate",
    description: "Decadent chocolate with chocolate chips",
    pricePerScoop: 14.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "strawberry",
    name: "Fresh Strawberry",
    description: "Made with fresh strawberries and cream",
    pricePerScoop: 14.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  },
  {
    id: "caramel",
    name: "Salted Caramel",
    description: "Sweet caramel with a touch of sea salt",
    pricePerScoop: 16.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "mint",
    name: "Mint Chocolate Chip",
    description: "Refreshing mint with dark chocolate chips",
    pricePerScoop: 15.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "mango",
    name: "Mango Sorbet",
    description: "Tropical mango sorbet, dairy-free",
    pricePerScoop: 15.99,
    image: "/placeholder.svg",
    category: "Seasonal",
    available: true
  },
  {
    id: "pistachio",
    name: "Pistachio Cream",
    description: "Premium pistachio flavor with real nuts",
    pricePerScoop: 17.99,
    image: "/placeholder.svg",
    category: "Special",
    available: true
  },
  {
    id: "coffee",
    name: "Coffee Espresso",
    description: "Rich coffee ice cream with espresso swirls",
    pricePerScoop: 16.99,
    image: "/placeholder.svg",
    category: "Classic",
    available: true
  }
];

const Orders = () => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    // Extract unique categories
    const uniqueCategories = Array.from(new Set(iceCreamFlavors.map(flavor => flavor.category)));
    setCategories(uniqueCategories);
    
    // Set default category
    if (uniqueCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(uniqueCategories[0]);
    }

    // Calculate order total
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    setOrderTotal(total);
  }, [cart, selectedCategory]);

  const addToCart = (flavor: IceCreamFlavor) => {
    const existingItem = cart.find(item => item.flavorId === flavor.id);
    
    if (existingItem) {
      // Update quantity if already in cart
      setCart(cart.map(item => 
        item.flavorId === flavor.id 
          ? { ...item, scoops: item.scoops + 1, price: (item.scoops + 1) * flavor.pricePerScoop } 
          : item
      ));
    } else {
      // Add new item to cart
      setCart([...cart, {
        flavorId: flavor.id,
        flavorName: flavor.name,
        scoops: 1,
        price: flavor.pricePerScoop
      }]);
    }

    toast({
      title: "Added to order",
      description: `1 scoop of ${flavor.name} added`
    });
  };

  const removeFromCart = (flavorId: string) => {
    const itemToRemove = cart.find(item => item.flavorId === flavorId);
    if (!itemToRemove) return;

    if (itemToRemove.scoops > 1) {
      // Reduce quantity
      setCart(cart.map(item => 
        item.flavorId === flavorId 
          ? { 
              ...item, 
              scoops: item.scoops - 1, 
              price: (item.scoops - 1) * iceCreamFlavors.find(f => f.id === flavorId)!.pricePerScoop 
            } 
          : item
      ));
    } else {
      // Remove item completely
      setCart(cart.filter(item => item.flavorId !== flavorId));
    }
  };

  const getScoopCount = (flavorId: string): number => {
    const item = cart.find(item => item.flavorId === flavorId);
    return item ? item.scoops : 0;
  };

  const clearCart = () => {
    setCart([]);
    toast({
      title: "Order cleared",
      description: "All items have been removed from the order"
    });
  };

  const placeOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Cannot place order",
        description: "Please add at least one item to your order",
        variant: "destructive"
      });
      return;
    }

    // Here you would normally send the order to a backend
    toast({
      title: "Order placed!",
      description: `Total: GHS ${orderTotal.toFixed(2)}. Your ice cream will be ready soon!`
    });
    setCart([]);
  };

  const filteredFlavors = selectedCategory 
    ? iceCreamFlavors.filter(flavor => flavor.category === selectedCategory)
    : iceCreamFlavors;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ice Cream Orders</h1>
          <p className="text-muted-foreground">Create and manage customer orders</p>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <Badge 
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 cursor-pointer ${
              selectedCategory === category 
                ? 'bg-creamello-purple text-white' 
                : 'bg-secondary'
            }`}
          >
            {category}
          </Badge>
        ))}
        <Badge 
          onClick={() => setSelectedCategory(null)}
          variant="outline" 
          className="px-3 py-1 cursor-pointer"
        >
          All Flavors
        </Badge>
      </div>

      {/* Main content: Flavors grid and Order summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Flavors Grid - Takes 2/3 of the space on desktop */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlavors.map(flavor => (
            <Card key={flavor.id} className={`overflow-hidden transition-all duration-200 ${!flavor.available ? 'opacity-60' : ''}`}>
              <div className="h-40 bg-muted flex items-center justify-center">
                <IceCreamCone className="h-16 w-16 text-creamello-purple" />
              </div>
              <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{flavor.name}</CardTitle>
                  <Badge className="bg-creamello-purple">{flavor.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{flavor.description}</p>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <CircleDollarSign className="h-4 w-4 mr-1 text-creamello-gray" />
                    <span className="font-medium">GHS {flavor.pricePerScoop.toFixed(2)}/scoop</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between items-center">
                {getScoopCount(flavor.id) > 0 ? (
                  <div className="flex items-center gap-3">
                    <Button 
                      size="icon"
                      variant="outline" 
                      onClick={() => removeFromCart(flavor.id)}
                      className="h-8 w-8"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold">{getScoopCount(flavor.id)}</span>
                    <Button 
                      size="icon"
                      variant="outline" 
                      onClick={() => addToCart(flavor)}
                      className="h-8 w-8"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => addToCart(flavor)}
                    className="bg-creamello-purple hover:bg-creamello-purple-dark"
                    disabled={!flavor.available}
                  >
                    Add to Order
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Order Summary - Takes 1/3 of the space on desktop */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Order Summary</CardTitle>
                <ShoppingCart className="h-5 w-5 text-creamello-purple" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-30" />
                  <p>Your order is empty</p>
                  <p className="text-sm">Add some delicious ice cream to get started!</p>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.flavorId} className="flex justify-between items-center pb-2 border-b">
                      <div>
                        <p className="font-medium">{item.flavorName}</p>
                        <p className="text-sm text-muted-foreground">{item.scoops} {item.scoops === 1 ? 'scoop' : 'scoops'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>GHS {item.price.toFixed(2)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeFromCart(item.flavorId)}
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 font-bold">
                    <span>Total</span>
                    <span>GHS {orderTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button 
                className="w-full bg-creamello-purple hover:bg-creamello-purple-dark"
                onClick={placeOrder}
                disabled={cart.length === 0}
              >
                Place Order
              </Button>
              {cart.length > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearCart}
                >
                  Clear Order
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Orders;
