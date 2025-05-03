import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Ingredients from "./pages/Ingredients";
import Production from "./pages/Production";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from './pages/Login';
import { OrderProvider } from "./context/OrderContext";
import { ProductInventoryProvider } from "./context/ProductInventoryContext";
import { IngredientInventoryProvider } from "./context/IngredientInventoryContext";
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './pages/Auth';

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { staff, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!staff) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrderProvider>
        <ProductInventoryProvider>
          <IngredientInventoryProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/ingredients" element={<Ingredients />} />
                      <Route path="/production" element={<Production />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </IngredientInventoryProvider>
        </ProductInventoryProvider>
      </OrderProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
