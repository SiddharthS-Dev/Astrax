/**
 * ReportsPage – Excel and PDF experiment report download
 * Shows a preview table and download buttons.
 */

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Table2,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { Experiment } from '../types';
import * as api from '../services/api';
import { APIError } from '../services/api';
import { cn } from '../utils/cn';

export const ReportsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getExperiments();
        setExperiments(data);
      } catch {
        setError('Failed to load experiment data for report preview.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleDownload = async (format: 'excel' | 'pdf') => {
    const setLoading = format === 'excel' ? setDownloadingExcel : setDownloadingPdf;
    setLoading(true);
    setDownloadSuccess('');
    setError('');

    try {
      const blob = await api.exportReport(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'excel'
        ? 'astrax_experiments_report.xlsx'
        : 'astrax_experiments_report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(`${format === 'excel' ? 'Excel' : 'PDF'} report downloaded successfully!`);
      setTimeout(() => setDownloadSuccess(''), 3000);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError(`Failed to download ${format} report.`);
      }
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-bold text-white">Reports & Export</h1>
        <p className="text-gray-500 text-sm mt-1">
          Download experiment data as Excel or PDF reports
        </p>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Excel Download */}
        <button
          onClick={() => handleDownload('excel')}
          disabled={downloadingExcel || experiments.length === 0}
          className={cn(
            'bg-dashboard-card border border-white/10 rounded-xl p-6 text-left transition-all duration-300 group',
            'hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            {downloadingExcel ? (
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : (
              <Download className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
            )}
          </div>
          <h3 className="text-white font-semibold mt-4">Excel Report</h3>
          <p className="text-gray-500 text-sm mt-1">
            Download a formatted .xlsx spreadsheet with all {experiments.length} experiments
          </p>
          <p className="text-emerald-500/60 text-xs mt-2 font-mono">.xlsx · Auto-fit columns · Styled headers</p>
        </button>

        {/* PDF Download */}
        <button
          onClick={() => handleDownload('pdf')}
          disabled={downloadingPdf || experiments.length === 0}
          className={cn(
            'bg-dashboard-card border border-white/10 rounded-xl p-6 text-left transition-all duration-300 group',
            'hover:border-red-500/30 hover:bg-red-500/[0.02]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
              <FileText className="w-6 h-6 text-red-400" />
            </div>
            {downloadingPdf ? (
              <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
            ) : (
              <Download className="w-5 h-5 text-gray-600 group-hover:text-red-400 transition-colors" />
            )}
          </div>
          <h3 className="text-white font-semibold mt-4">PDF Report</h3>
          <p className="text-gray-500 text-sm mt-1">
            Download a formatted landscape PDF table with all {experiments.length} experiments
          </p>
          <p className="text-red-500/60 text-xs mt-2 font-mono">.pdf · Landscape A4 · Styled table</p>
        </button>
      </div>

      {/* Status messages */}
      {downloadSuccess && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-emerald-400 text-sm">{downloadSuccess}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-dashboard-card border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Table2 className="w-4 h-4 text-gray-500" />
          <h3 className="text-white font-semibold text-sm">Report Preview</h3>
          <span className="text-gray-600 text-xs ml-auto">
            {experiments.length} row{experiments.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-dashboard-card z-10">
              <tr className="border-b border-white/10">
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">ID</th>
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">Title</th>
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">Status</th>
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">Owner</th>
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">Track</th>
                <th className="text-left text-gray-500 font-medium py-2.5 px-4 text-xs">Due</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map(exp => (
                <tr key={exp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2 px-4 text-gray-600 font-mono text-xs">{exp.id}</td>
                  <td className="py-2 px-4 text-white text-xs truncate max-w-[200px]">{exp.title}</td>
                  <td className="py-2 px-4">
                    <StatusBadge status={exp.status} />
                  </td>
                  <td className="py-2 px-4 text-gray-400 text-xs">{exp.owner?.full_name || '—'}</td>
                  <td className="py-2 px-4 text-gray-400 text-xs">{exp.track?.name || '—'}</td>
                  <td className="py-2 px-4 text-gray-500 font-mono text-xs">{exp.target_end_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
