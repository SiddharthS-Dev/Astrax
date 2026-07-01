/**
 * TeamView – Organization tree showing current user + direct reports
 * Super Admins get manager reassignment capability.
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCircle2,
  Shield,
  Briefcase,
  Wrench,
  Crown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { User, RoleName } from '../types';
import * as api from '../services/api';
import { cn } from '../utils/cn';

const ROLE_CONFIG: Record<RoleName, { icon: React.ElementType; color: string; bg: string }> = {
  'Super Admin': { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'Executive': { icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  'Manager': { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'Employee': { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'Technician': { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

interface UserCardProps {
  user: User;
  isCurrentUser?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, isCurrentUser }) => {
  return (
    <div
      className={cn(
        'bg-dashboard-card border rounded-xl p-5 transition-all duration-300 hover:border-white/20 relative overflow-hidden group',
        isCurrentUser ? 'border-neon-blue/30' : 'border-white/10'
      )}
    >
      {/* Subtle glow for current user */}
      {isCurrentUser && (
        <div className="absolute -top-4 -right-4 w-16 h-16 bg-neon-blue/10 blur-2xl rounded-full" />
      )}

      <div className="flex items-start gap-4 relative z-10">
        {/* Avatar */}
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold',
            isCurrentUser
              ? 'bg-gradient-to-br from-neon-blue to-blue-600 text-white'
              : 'bg-white/5 text-gray-400 border border-white/10'
          )}
        >
          {user.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold truncate">{user.full_name}</h3>
            {isCurrentUser && (
              <span className="text-neon-blue text-[10px] font-semibold uppercase tracking-wider bg-neon-blue/10 px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm truncate mt-0.5">{user.email}</p>

          {/* Role badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {user.roles.map(role => {
              const config = ROLE_CONFIG[role.name] || ROLE_CONFIG['Employee'];
              const Icon = config.icon;
              return (
                <span
                  key={role.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    config.bg,
                    config.color
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {role.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TeamView: React.FC = () => {
  const { hasRole } = useAuth();
  const [me, setMe] = useState<User | null>(null);
  const [reports, setReports] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeam = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getMyTeam();
      setMe(data.me);
      setReports(data.direct_reports);
    } catch {
      setError('Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTeam(); }, []);

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
        <button onClick={fetchTeam} className="text-neon-blue hover:underline text-sm">
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
          <h1 className="text-2xl font-bold text-white">PM Control Register</h1>
          <p className="text-gray-500 text-sm mt-1">Your team and organizational structure</p>
        </div>
        <button
          onClick={fetchTeam}
          className="flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Current User */}
      {me && (
        <div>
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserCircle2 className="w-4 h-4" />
            Your Profile
          </h2>
          <UserCard user={me} isCurrentUser />
        </div>
      )}

      {/* Direct Reports */}
      {reports.length > 0 && (
        <div>
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            Direct Reports ({reports.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reports.map(user => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="bg-dashboard-card border border-white/10 rounded-xl p-8 text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No direct reports assigned to you.</p>
          {hasRole('Super Admin') && (
            <p className="text-gray-600 text-xs mt-2">
              Use the API to assign managers: PATCH /users/{'{'}{id}{'}'}/assign-manager
            </p>
          )}
        </div>
      )}
    </div>
  );
};
