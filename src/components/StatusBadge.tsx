/**
 * StatusBadge – Experiment status indicator
 * Color-coded badge matching the dashboard theme.
 */

import React from 'react';
import type { ExperimentStatus } from '../types';
import { cn } from '../utils/cn';

const STATUS_CONFIG: Record<ExperimentStatus, { bg: string; text: string; dot: string }> = {
  'Not Started': {
    bg: 'bg-gray-500/15',
    text: 'text-gray-400',
    dot: 'bg-gray-400',
  },
  'In Progress': {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  'Blocked': {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  'Complete': {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
};

interface StatusBadgeProps {
  status: ExperimentStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Not Started'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {status}
    </span>
  );
};
