import React from 'react';
import { 
  Building2, 
  ClipboardList, 
  TestTube2, 
  Lightbulb, 
  Network, 
  Truck, 
  TrendingUp, 
  BookOpen, 
  ShieldCheck, 
  Bot,
  Cpu,
  Cloud,
  Microscope,
  Factory,
  Globe2,
  Wrench,
  Briefcase
} from 'lucide-react';
import { cn } from '../utils/cn';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick,
  isCollapsed 
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center w-full px-3 py-2 my-1 rounded-full transition-all duration-300 ease-in-out",
        "hover:bg-white/5",
        isActive ? "bg-white/10 text-neon-blue shadow-neon" : "text-gray-400 hover:text-gray-200 hover:-translate-x-0.5"
      )}
      title={isCollapsed ? label : undefined}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-neon-blue shadow-neon" />
      )}
      <Icon className={cn(
        "w-5 h-5 flex-shrink-0 transition-transform duration-300", 
        isActive ? "text-neon-blue" : "text-gray-400 group-hover:text-gray-200",
        isCollapsed ? "mx-auto" : "mr-3"
      )} />
      {!isCollapsed && (
        <span className="text-sm font-medium whitespace-nowrap truncate">
          {label}
        </span>
      )}
    </button>
  );
};

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeModule, 
  setActiveModule,
  isCollapsed 
}) => {
  const primaryMenuItems = [
    { id: 'ceo-cockpit', label: 'CEO Cockpit', icon: Building2 },
    { id: 'pm-control', label: 'PM Control Register', icon: ClipboardList },
    { id: 'experiment-backlog', label: 'Experiment Backlog', icon: TestTube2 },
    { id: 'hypothesis-bank', label: 'Hypothesis Bank', icon: Lightbulb },
    { id: 'dependency-map', label: 'Dependency Map', icon: Network },
    { id: 'vendors-supply', label: 'Vendors & Supply', icon: Truck },
    { id: 'business-economics', label: 'Business Economics', icon: TrendingUp },
    { id: 'docs-gateway', label: 'Documentation Gateway', icon: BookOpen },
    { id: 'quality-gates', label: 'Quality Gates', icon: ShieldCheck },
    { id: 'ai-copilot', label: 'AI Copilot', icon: Bot },
  ];

  const engineeringTracks = [
    { id: 't1-device', label: 'T1 – Device & Physics', icon: Microscope },
    { id: 't2-saas', label: 'T2 – SaaS Systems', icon: Cloud },
    { id: 't3-ai-agents', label: 'T3 – AI Agents', icon: Cpu },
    { id: 't4-manufacturing', label: 'T4 – Manufacturing', icon: Factory },
    { id: 't5-distribution', label: 'T5 – Distribution', icon: Globe2 },
    { id: 't6-service', label: 'T6 – Service', icon: Wrench },
    { id: 't7-business-vc', label: 'T7 – Business & VC', icon: Briefcase },
  ];

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-[#0B0F1A]/80 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300 z-50",
        isCollapsed ? "w-20" : "w-[280px]"
      )}
    >
      {/* Logo Area */}
      <div className={cn(
        "p-6 flex items-center border-b border-white/5",
        isCollapsed ? "justify-center px-4" : ""
      )}>
        <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center shadow-neon flex-shrink-0">
          <span className="text-white font-bold text-lg">A</span>
        </div>
        {!isCollapsed && (
          <div className="ml-3 flex flex-col">
            <h1 className="text-white font-bold tracking-wider text-sm">AstraX EB1</h1>
            <span className="text-neon-blue text-xs uppercase tracking-widest font-semibold">Control Tower</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
        <div className="space-y-1">
          {primaryMenuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeModule === item.id}
              onClick={() => setActiveModule(item.id)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Engineering Tracks Section */}
        <div className="mt-8 mb-2 px-3">
          {!isCollapsed ? (
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Engineering Tracks
            </h2>
          ) : (
            <div className="w-full h-px bg-white/10 my-4" />
          )}
          <div className="space-y-1">
            {engineeringTracks.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activeModule === item.id}
                onClick={() => setActiveModule(item.id)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
