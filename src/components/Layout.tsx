import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { cn } from '../utils/cn'; // Will create this utility

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  setActiveModule: (module: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeModule, 
  setActiveModule 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-dashboard-bg flex relative">
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule}
        isCollapsed={isCollapsed}
      />
      
      <main 
        className={cn(
          "flex-1 min-h-screen transition-all duration-300 relative flex flex-col",
          isCollapsed ? "ml-20" : "ml-[280px]"
        )}
      >
        {/* Top Header for mobile toggle */}
        <header className="h-16 border-b border-white/5 flex items-center px-6 lg:hidden shrink-0">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
