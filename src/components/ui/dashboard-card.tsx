import { cn } from '@/lib/utils';
import React from 'react';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactElement;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function DashboardCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        "creamello-card flex flex-col h-full animate-fade-in",
        className
      )}
      {...props}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className="mt-1 flex items-baseline">
            <p className="text-2xl font-semibold">{value}</p>
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && <div className="p-2 bg-muted/50 rounded-lg">{icon}</div>}
      </div>

      {trend && (
        <div className="mt-4 flex items-center">
          <span
            className={cn(
              "text-xs font-medium rounded-full px-2 py-0.5 flex items-center",
              trend === 'up' && 'bg-creamello-green text-green-700',
              trend === 'down' && 'bg-creamello-pink text-red-700',
              trend === 'neutral' && 'bg-creamello-yellow text-yellow-700'
            )}
          >
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'neutral' && '→'}
            {trendValue}
          </span>
          {trendValue && <span className="text-xs text-muted-foreground ml-2">vs. last month</span>}
        </div>
      )}
    </div>
  );
}
