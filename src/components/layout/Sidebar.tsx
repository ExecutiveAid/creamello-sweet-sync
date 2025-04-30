
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
import { Package, Database, ChartPie, Settings, ShoppingCart, ClipboardList } from 'lucide-react';

type NavItemProps = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  exact?: boolean;
};

const NavItem = ({ to, icon: Icon, children, exact = false }: NavItemProps) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent group",
          isActive
            ? "bg-sidebar-accent text-primary font-medium"
            : "text-sidebar-foreground hover:text-sidebar-foreground"
        )
      }
      end={exact}
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </NavLink>
  );
};

export const AppSidebar = () => {
  return (
    <Sidebar>
      <SidebarHeader className="px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-creamello-purple flex items-center justify-center">
            <span className="text-white font-bold">C</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Creamello</h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-2">
        <div className="space-y-1">
          <NavItem to="/" icon={ChartPie} exact={true}>Dashboard</NavItem>
          <NavItem to="/ingredients" icon={Database}>Ingredients</NavItem>
          <NavItem to="/production" icon={ClipboardList}>Production</NavItem>
          <NavItem to="/inventory" icon={Package}>Inventory</NavItem>
          <NavItem to="/sales" icon={ShoppingCart}>Sales</NavItem>
          <NavItem to="/settings" icon={Settings}>Settings</NavItem>
        </div>
      </SidebarContent>
      
      <SidebarFooter className="px-4 py-4">
        <div className="rounded-lg bg-sidebar-accent p-4">
          <h4 className="text-sm font-medium mb-2">Creamello Sweet Sync</h4>
          <p className="text-xs text-muted-foreground">Ice Cream Management v1.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
