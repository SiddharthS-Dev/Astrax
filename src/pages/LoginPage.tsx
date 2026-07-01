/**
 * LoginPage – Full-screen authentication page
 * Matches the dark dashboard theme with neon accents.
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { APIError } from '../services/api';
import { ShieldCheck, Mail, Lock, Loader2, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Connection failed. Is the backend running?');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center shadow-neon mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AstraX EB1</h1>
          <p className="text-neon-blue text-xs uppercase tracking-[0.3em] font-semibold mt-1">
            Control Tower
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-dashboard-card border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-neon-blue/10 blur-[80px] pointer-events-none rounded-full" />

          <h2 className="text-lg font-semibold text-white mb-1 relative z-10">Sign In</h2>
          <p className="text-gray-500 text-sm mb-6 relative z-10">
            Enter your credentials to access the dashboard
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 relative z-10">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Email */}
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@astraanalytical.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-neon-blue to-blue-500 hover:from-neon-blue-hover hover:to-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all duration-300 shadow-neon hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          AstraX EB1 Control Tower · Astra Analytical
        </p>
      </div>
    </div>
  );
};
