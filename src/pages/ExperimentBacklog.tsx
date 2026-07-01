/**
 * ExperimentBacklog – Full CRUD experiment table with status filters
 * Includes create/edit modals and RBAC-aware actions.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Loader2,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  RefreshCw,
  X,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { Experiment, ExperimentStatus, ExperimentCreate, ExperimentUpdate } from '../types';
import * as api from '../services/api';
import { APIError } from '../services/api';

const ALL_STATUSES: ExperimentStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Complete'];

export const ExperimentBacklog: React.FC = () => {
  const { userId, hasRole } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus | 'All'>('All');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formHypothesis, setFormHypothesis] = useState('');
  const [formCriteria, setFormCriteria] = useState('');
  const [formStatus, setFormStatus] = useState<ExperimentStatus>('Not Started');
  const [formDate, setFormDate] = useState('');
  const [formOutcome, setFormOutcome] = useState('');
  const [formNextAction, setFormNextAction] = useState('');

  const canCreate = hasRole('Super Admin', 'Manager', 'Employee', 'Technician');
  const isExecutiveOnly = hasRole('Executive') && !hasRole('Super Admin', 'Manager');

  const fetchExperiments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getExperiments();
      setExperiments(data);
    } catch {
      setError('Failed to load experiments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchExperiments(); }, []);

  // Filter + search
  const filtered = useMemo(() => {
    return experiments.filter(exp => {
      const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
      const matchesSearch =
        search === '' ||
        exp.title.toLowerCase().includes(search.toLowerCase()) ||
        exp.owner?.full_name.toLowerCase().includes(search.toLowerCase()) ||
        exp.track?.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [experiments, statusFilter, search]);

  // Open create modal
  const openCreate = () => {
    setEditingExperiment(null);
    setFormTitle('');
    setFormHypothesis('');
    setFormCriteria('');
    setFormStatus('Not Started');
    setFormDate('');
    setFormOutcome('');
    setFormNextAction('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open edit modal
  const openEdit = (exp: Experiment) => {
    setEditingExperiment(exp);
    setFormTitle(exp.title);
    setFormHypothesis(exp.hypothesis || '');
    setFormCriteria(exp.success_criteria || '');
    setFormStatus(exp.status);
    setFormDate(exp.target_end_date || '');
    setFormOutcome(exp.outcome || '');
    setFormNextAction(exp.next_action || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const canEditExperiment = (exp: Experiment): boolean => {
    if (hasRole('Super Admin')) return true;
    if (isExecutiveOnly) return exp.owner_id === userId;
    return true;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      if (editingExperiment) {
        // Update
        const data: ExperimentUpdate = {
          title: formTitle,
          hypothesis: formHypothesis || undefined,
          success_criteria: formCriteria || undefined,
          status: formStatus,
          target_end_date: formDate || undefined,
          outcome: formOutcome || undefined,
          next_action: formNextAction || undefined,
        };
        await api.updateExperiment(editingExperiment.id, data);
      } else {
        // Create
        const data: ExperimentCreate = {
          title: formTitle,
          hypothesis: formHypothesis || undefined,
          success_criteria: formCriteria || undefined,
          status: formStatus,
          target_end_date: formDate || undefined,
          outcome: formOutcome || undefined,
          next_action: formNextAction || undefined,
          owner_id: userId!,
        };
        await api.createExperiment(data);
      }

      setIsModalOpen(false);
      await fetchExperiments();
    } catch (err) {
      if (err instanceof APIError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save experiment.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Experiment Backlog</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} experiment{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'All' ? ` · ${statusFilter}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExperiments}
            className="flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-gradient-to-r from-neon-blue to-blue-500 hover:from-neon-blue-hover hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-neon text-sm"
            >
              <Plus className="w-4 h-4" />
              New Experiment
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, owner, track..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExperimentStatus | 'All')}
            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-8 py-2 text-white text-sm focus:outline-none focus:border-neon-blue/50 appearance-none cursor-pointer transition-all"
          >
            <option value="All" className="bg-dashboard-card">All Status</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s} className="bg-dashboard-card">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-dashboard-card border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left text-gray-500 font-medium py-3 px-4">Title</th>
                <th className="text-left text-gray-500 font-medium py-3 px-4">Status</th>
                <th className="text-left text-gray-500 font-medium py-3 px-4 hidden md:table-cell">Owner</th>
                <th className="text-left text-gray-500 font-medium py-3 px-4 hidden lg:table-cell">Track</th>
                <th className="text-left text-gray-500 font-medium py-3 px-4 hidden lg:table-cell">Due Date</th>
                <th className="text-right text-gray-500 font-medium py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-12">
                    No experiments found.
                  </td>
                </tr>
              ) : (
                filtered.map(exp => (
                  <tr
                    key={exp.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="text-white font-medium truncate max-w-xs">{exp.title}</p>
                      {exp.hypothesis && (
                        <p className="text-gray-500 text-xs truncate max-w-xs mt-0.5">
                          {exp.hypothesis}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-400 hidden md:table-cell">
                      {exp.owner?.full_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 hidden lg:table-cell">
                      {exp.track?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs hidden lg:table-cell">
                      {exp.target_end_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEditExperiment(exp) && (
                        <button
                          onClick={() => openEdit(exp)}
                          className="text-gray-500 hover:text-neon-blue transition-colors p-1.5 rounded-lg hover:bg-white/5"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExperiment ? 'Edit Experiment' : 'New Experiment'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all"
              placeholder="Experiment title"
            />
          </div>

          {/* Hypothesis */}
          <div>
            <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
              Hypothesis
            </label>
            <textarea
              value={formHypothesis}
              onChange={(e) => setFormHypothesis(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all resize-none"
              placeholder="What do you believe will happen?"
            />
          </div>

          {/* Success Criteria */}
          <div>
            <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
              Success Criteria
            </label>
            <textarea
              value={formCriteria}
              onChange={(e) => setFormCriteria(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all resize-none"
              placeholder="How will success be measured?"
            />
          </div>

          {/* Status + Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ExperimentStatus)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-neon-blue/50 appearance-none cursor-pointer transition-all"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s} className="bg-dashboard-card">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                Target Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-neon-blue/50 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
              Outcome
            </label>
            <textarea
              value={formOutcome}
              onChange={(e) => setFormOutcome(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all resize-none"
              placeholder="Results and observations"
            />
          </div>

          {/* Next Action */}
          <div>
            <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
              Next Action
            </label>
            <input
              type="text"
              value={formNextAction}
              onChange={(e) => setFormNextAction(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 transition-all"
              placeholder="What happens next?"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formTitle.trim()}
              className="bg-gradient-to-r from-neon-blue to-blue-500 hover:from-neon-blue-hover hover:to-blue-600 text-white font-medium py-2 px-5 rounded-lg transition-all shadow-neon text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : editingExperiment ? (
                'Update'
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
