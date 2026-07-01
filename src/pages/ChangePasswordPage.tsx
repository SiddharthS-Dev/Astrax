/**
 * ChangePasswordPage – Mandatory first-time password change
 * Shown when requires_password_change is true after login.
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { APIError } from '../services/api';
import { KeyRound, Lock, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const ChangePasswordPage: React.FC = () => {
  const { changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isLongEnough = newPassword.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (!isLongEnough) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(newPassword);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
          <p className="text-gray-400 text-sm mt-2">
            You must change your initial password before accessing the system.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-dashboard-card border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 transition-all"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 transition-all"
                />
              </div>
            </div>

            {/* Validation hints */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${isLongEnough ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span className={`text-xs ${isLongEnough ? 'text-emerald-400' : 'text-gray-500'}`}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span className={`text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-gray-500'}`}>
                  Passwords match
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !passwordsMatch || !isLongEnough}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-2.5 rounded-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Set Password & Continue'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
