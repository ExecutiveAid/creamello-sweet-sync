import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Package, Database, ChartPie, Settings, ShoppingCart, ClipboardList, IceCreamCone, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';

type NavItemProps = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  exact?: boolean;
  highlighted?: boolean;
};

const NavItem = ({ to, icon: Icon, children, exact = false, highlighted = false }: NavItemProps) => {
  const { state } = useSidebar();
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-4 rounded-lg transition-colors hover:bg-sidebar-accent group",
          isActive
            ? "bg-sidebar-accent text-brand-primary font-bold"
            : "text-sidebar-foreground hover:text-sidebar-foreground font-bold",
          highlighted && !isActive && "text-brand-primary font-bold",
          state === 'collapsed' && 'justify-center px-0'
        )
      }
      end={exact}
    >
      <Icon className={cn("h-7 w-7", highlighted && "text-brand-primary")} />
      {state !== 'collapsed' && <span className="text-lg">{children}</span>}
    </NavLink>
  );
};

export const AppSidebar = () => {
  const { staff } = useAuth();
  const role = staff?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isStaff = role === 'staff';
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  // Branding state
  const [brandingSettings, setBrandingSettings] = useState({
    customShopName: 'Razorbill IMS',
    logoUrl: '',
    primaryColor: '#8B5CF6',
    useCustomLogo: false
  });

  // Load branding settings
  useEffect(() => {
    const loadBrandingSettings = async () => {
      try {
        console.log('🔄 Loading branding settings...');
        const { data, error } = await supabase
          .from('settings')
          .select('branding_settings, shop_name')
          .limit(1)
          .single();
        
        console.log('📊 Database response:', { data, error });
        
        if (data && !error) {
          const branding = data.branding_settings || {};
          console.log('🎨 Branding data:', branding);
          
          const newSettings = {
            customShopName: branding.customShopName || data.shop_name || 'Razorbill IMS',
            logoUrl: branding.logoUrl || '',
            primaryColor: branding.primaryColor || '#8B5CF6',
            useCustomLogo: branding.useCustomLogo || false
          };
          
          console.log('✅ Setting branding to:', newSettings);
          setBrandingSettings(newSettings);
        }
      } catch (err) {
        // Fallback to defaults if there's an error
        console.error('❌ Error loading branding settings:', err);
      }
    };

    loadBrandingSettings();

    // Listen for window focus to refresh settings (when user comes back from another tab)
    const handleFocus = () => {
      loadBrandingSettings();
    };

    // Listen for custom events when settings are saved
    const handleSettingsUpdate = () => {
      console.log('🔄 Branding update event received - reloading settings');
      loadBrandingSettings();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('brandingUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('brandingUpdated', handleSettingsUpdate);
    };
  }, []);
  
  return (
    <Sidebar collapsible="icon">
      {/* Header with logo */}
      <SidebarHeader className={cn("px-6 py-5", isCollapsed && "px-2")}>
        <div className={cn("flex items-center gap-2", isCollapsed && "justify-center")}>
          {brandingSettings.useCustomLogo && brandingSettings.logoUrl ? (
            <img 
              src={brandingSettings.logoUrl} 
              alt="Shop Logo" 
              className="h-8 w-8 rounded-lg object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-brand-primary">
              <span className="text-white font-bold">
                {brandingSettings.customShopName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-foreground">
              {brandingSettings.customShopName}
            </h1>
          )}
        </div>
      </SidebarHeader>
      
      {/* Navigation items */}
      <SidebarContent className={cn("py-2", isCollapsed ? "px-2" : "px-4")}>
        <div className="space-y-1">
          {/* Dashboard link - point staff to /dashboard, admin/managers to /sales */}
          {isAdminOrManager ? (
            <NavItem to="/sales" icon={ChartPie} exact={true}>Dashboard</NavItem>
          ) : (
            <NavItem to="/dashboard" icon={ChartPie} exact={true}>Dashboard</NavItem>
          )}
          
          {/* Admin/Manager only sections */}
          {isAdminOrManager && (
            <>
              <NavItem to="/production" icon={ClipboardList}>Production</NavItem>
              <NavItem to="/inventory" icon={Package}>Inventory</NavItem>
              <NavItem to="/reports" icon={ChartPie}>Reports</NavItem>
            </>
          )}
          
          {/* Orders - visible to everyone */}
          <NavItem to="/orders" icon={IceCreamCone}>Orders</NavItem>
          
          {/* Admin only section */}
          {isAdmin && <NavItem to="/settings" icon={Settings}>Settings</NavItem>}
        </div>
      </SidebarContent>
      
      {/* Footer with collapse trigger button */}
      <SidebarFooter className="mt-auto p-3 flex justify-center">
        <button 
          onClick={toggleSidebar}
          className={cn(
            "flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors",
            isCollapsed ? "w-8 h-8" : "w-full"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Collapse</span>
            </div>
          )}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};
