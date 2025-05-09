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
import { useEffect, useState } from 'react';

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { staff, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!staff) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { staff, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!staff || staff.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

const App = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  useEffect(() => {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) {
      alert('Installation not available. Either PWA is already installed or not supported in this browser.');
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // Clear the saved prompt since it can't be used again
      setDeferredPrompt(null);
    });
  };

  return (
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
                      </Route>
                    </Route>
                    <Route element={<AdminRoute />}>
                      <Route element={<Layout />}>
                        <Route path="/settings" element={<Settings />} />
                      </Route>
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
                {deferredPrompt && (
                  <button
                    onClick={handleInstallClick}
                    style={{
                      position: 'fixed',
                      bottom: '20px',
                      right: '20px',
                      padding: '10px 15px',
                      backgroundColor: '#9558E3',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      zIndex: 1000
                    }}
                  >
                    Install App
                  </button>
                )}
              </TooltipProvider>
            </IngredientInventoryProvider>
          </ProductInventoryProvider>
        </OrderProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
