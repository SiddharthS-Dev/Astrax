/**
 * CEOCockpit – Executive dashboard with KPI cards and status breakdown
 * Fetches experiments and computes aggregates client-side.
 */

import React, { useEffect, useState } from 'react';
import { 
  TestTube2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Pause, 
  TrendingUp,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import type { Experiment, ExperimentStatus } from '../types';
import * as api from '../services/api';

export const CEOCockpit: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getExperiments();
      setExperiments(data);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Compute aggregates
  const total = experiments.length;
  const statusCounts: Record<ExperimentStatus, number> = {
    'Not Started': 0,
    'In Progress': 0,
    'Blocked': 0,
    'Complete': 0,
  };
  experiments.forEach(e => {
    if (statusCounts[e.status] !== undefined) statusCounts[e.status]++;
  });

  const completionRate = total > 0
    ? Math.round((statusCounts['Complete'] / total) * 100)
    : 0;

  // Upcoming deadlines (next 14 days)
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcoming = experiments.filter(e => {
    if (!e.target_end_date || e.status === 'Complete') return false;
    const d = new Date(e.target_end_date);
    return d >= now && d <= twoWeeks;
  });

  // Overdue
  const overdue = experiments.filter(e => {
    if (!e.target_end_date || e.status === 'Complete') return false;
    return new Date(e.target_end_date) < now;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-gray-400">{error}</p>
        <button onClick={fetchData} className="text-neon-blue hover:underline text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CEO Cockpit</h1>
          <p className="text-gray-500 text-sm mt-1">AstraX EB1 program overview</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TestTube2 className="w-6 h-6" />}
          label="Total Experiments"
          value={total}
          subtitle="Across all tracks"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Completion Rate"
          value={completionRate}
          subtitle={`${statusCounts['Complete']} of ${total} complete`}
          accentColor="text-emerald-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Blocked"
          value={statusCounts['Blocked']}
          subtitle="Require attention"
          accentColor="text-red-400"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="In Progress"
          value={statusCounts['In Progress']}
          subtitle="Active experiments"
          accentColor="text-blue-400"
        />
      </div>

      {/* Status Breakdown + Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <div className="bg-dashboard-card border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {(Object.entries(statusCounts) as [ExperimentStatus, number][]).map(([status, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              const barColors: Record<ExperimentStatus, string> = {
                'Complete': 'bg-emerald-500',
                'In Progress': 'bg-blue-500',
                'Blocked': 'bg-red-500',
                'Not Started': 'bg-gray-500',
              };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status={status} />
                    <span className="text-gray-400 text-sm font-mono">{count}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className={`${barColors[status]} rounded-full h-1.5 transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-dashboard-card border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Alerts & Deadlines</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
            {/* Overdue */}
            {overdue.map(exp => (
              <div
                key={exp.id}
                className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-lg p-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-red-300 text-sm font-medium truncate">{exp.title}</p>
                  <p className="text-red-400/60 text-xs">
                    Overdue · was due {exp.target_end_date}
                    {exp.owner ? ` · ${exp.owner.full_name}` : ''}
                  </p>
                </div>
              </div>
            ))}

            {/* Upcoming */}
            {upcoming.map(exp => (
              <div
                key={exp.id}
                className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3"
              >
                <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-amber-300 text-sm font-medium truncate">{exp.title}</p>
                  <p className="text-amber-400/60 text-xs">
                    Due {exp.target_end_date}
                    {exp.owner ? ` · ${exp.owner.full_name}` : ''}
                  </p>
                </div>
              </div>
            ))}

            {overdue.length === 0 && upcoming.length === 0 && (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                No overdue or upcoming deadlines
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blocked Experiments Detail */}
      {statusCounts['Blocked'] > 0 && (
        <div className="bg-dashboard-card border border-red-500/20 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Pause className="w-5 h-5 text-red-400" />
            Blocked Experiments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-500 font-medium py-2 px-3">Title</th>
                  <th className="text-left text-gray-500 font-medium py-2 px-3">Owner</th>
                  <th className="text-left text-gray-500 font-medium py-2 px-3">Track</th>
                  <th className="text-left text-gray-500 font-medium py-2 px-3">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {experiments
                  .filter(e => e.status === 'Blocked')
                  .map(exp => (
                    <tr key={exp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-3 text-white font-medium">{exp.title}</td>
                      <td className="py-3 px-3 text-gray-400">{exp.owner?.full_name || '—'}</td>
                      <td className="py-3 px-3 text-gray-400">{exp.track?.name || '—'}</td>
                      <td className="py-3 px-3 text-gray-500 text-xs max-w-xs truncate">
                        {exp.next_action || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
