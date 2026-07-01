/**
 * StatCard – Animated KPI card for the CEO Cockpit
 * Displays icon, label, value, and optional subtitle with neon accents.
 */

import React, { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle?: string;
  accentColor?: string; // tailwind text color class
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  accentColor = 'text-neon-blue',
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  // Animate count-up on mount
  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    let start = 0;
    const duration = 800;
    const step = Math.max(1, Math.floor(value / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className={cn(
        'bg-dashboard-card border border-white/10 rounded-xl p-5 relative overflow-hidden',
        'hover:border-white/20 transition-all duration-300 group',
        className
      )}
    >
      {/* Background glow */}
      <div className="absolute -top-6 -right-6 w-20 h-20 bg-neon-blue/5 blur-2xl rounded-full group-hover:bg-neon-blue/10 transition-all duration-500" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={cn('text-3xl font-bold tracking-tight', accentColor)}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1.5">{subtitle}</p>
          )}
        </div>
        <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
          {icon}
        </div>
      </div>
    </div>
  );
};
