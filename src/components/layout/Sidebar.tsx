import React from 'react';
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
            ? "bg-sidebar-accent text-primary font-bold"
            : "text-sidebar-foreground hover:text-sidebar-foreground font-bold",
          highlighted && !isActive && "text-creamello-purple font-bold",
          state === 'collapsed' && 'justify-center px-0'
        )
      }
      end={exact}
    >
      <Icon className={cn("h-7 w-7", highlighted && "text-creamello-purple")} />
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
  
  return (
    <Sidebar collapsible="icon">
      {/* Header with logo */}
      <SidebarHeader className={cn("px-6 py-5", isCollapsed && "px-2")}>
        <div className={cn("flex items-center gap-2", isCollapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-lg bg-creamello-purple flex items-center justify-center">
            <span className="text-white font-bold">C</span>
          </div>
          {!isCollapsed && <h1 className="text-xl font-bold text-foreground">Creamello</h1>}
        </div>
      </SidebarHeader>
      
      {/* Navigation items */}
      <SidebarContent className={cn("py-2", isCollapsed ? "px-2" : "px-4")}>
        <div className="space-y-1">
          {/* Dashboard - visible to everyone */}
          <NavItem to="/" icon={ChartPie} exact={true}>Dashboard</NavItem>
          
          {/* Admin/Manager only sections */}
          {isAdminOrManager && (
            <>
              <NavItem to="/production" icon={ClipboardList}>Production</NavItem>
              <NavItem to="/inventory" icon={Package}>Inventory</NavItem>
              <NavItem to="/sales" icon={ShoppingCart}>Sales</NavItem>
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
