/**
 * PlaceholderModule – Coming soon card for unimplemented modules
 * Matches the existing placeholder aesthetic.
 */

import React from 'react';
import { Construction, ArrowRight } from 'lucide-react';

interface PlaceholderModuleProps {
  moduleId: string;
  moduleName: string;
}

// Human-readable names for sidebar IDs
const MODULE_NAMES: Record<string, string> = {
  'hypothesis-bank': 'Hypothesis Bank',
  'dependency-map': 'Dependency Map',
  'vendors-supply': 'Vendors & Supply Chain',
  'business-economics': 'Business Economics',
  'quality-gates': 'Quality Gates',
  'ai-copilot': 'AI Copilot',
  't1-device': 'T1 – Device & Physics',
  't2-saas': 'T2 – SaaS Systems',
  't3-ai-agents': 'T3 – AI Agents',
  't4-manufacturing': 'T4 – Manufacturing',
  't5-distribution': 'T5 – Distribution',
  't6-service': 'T6 – Service',
  't7-business-vc': 'T7 – Business & VC',
};

export const PlaceholderModule: React.FC<PlaceholderModuleProps> = ({
  moduleId,
  moduleName,
}) => {
  const displayName = moduleName || MODULE_NAMES[moduleId] || moduleId;

  return (
    <div className="h-full flex items-center justify-center min-h-[60vh]">
      <div className="bg-dashboard-card border border-white/10 rounded-2xl p-12 max-w-lg w-full text-center shadow-2xl relative overflow-hidden group">
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-neon-blue/10 blur-[100px] pointer-events-none rounded-full group-hover:bg-neon-blue/20 transition-all duration-700" />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5 group-hover:border-neon-blue/20 transition-colors">
          <Construction className="w-8 h-8 text-gray-500 group-hover:text-neon-blue/60 transition-colors" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {displayName}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          This module is under development. It will be connected to the
          AstraX EB1 backend once the feature is implemented.
        </p>

        <div className="inline-flex items-center gap-2 text-neon-blue/50 text-xs font-medium uppercase tracking-wider">
          <span>Coming Soon</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
