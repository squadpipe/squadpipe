import React, { useState } from 'react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const demoPersonas = [
    {
      name: 'Johnathan Miller',
      role: 'Administrator',
      desk: 'Executive Ops & Billing',
      email: 'j.miller@talentos-agency.com',
      avatarBg: 'bg-emerald-500',
      badge: 'Full Clearance',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
    },
    {
      name: 'Marcus Brody',
      role: 'Senior Recruiter',
      desk: 'US IT Contract (C2C & W2)',
      email: 'm.brody@talentos-agency.com',
      avatarBg: 'bg-blue-500',
      badge: 'Rates Visible',
      badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800/60',
    },
    {
      name: 'Sarah Jenkins',
      role: 'Technical Recruiter',
      desk: 'Cloud & DevOps Practice',
      email: 's.jenkins@talentos-agency.com',
      avatarBg: 'bg-purple-500',
      badge: 'Rate Masked (••••)',
      badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
    },
    {
      name: 'David Kim',
      role: 'Bench Sales Lead',
      desk: 'Candidate Bench Marketing',
      email: 'd.kim@talentos-agency.com',
      avatarBg: 'bg-indigo-500',
      badge: 'Bench Ops',
      badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60',
    },
  ];

  const handleLogin = async (e?: React.FormEvent, targetEmail?: string, targetPass?: string) => {
    if (e) e.preventDefault();
    const loginEmail = targetEmail || email;
    const loginPassword = targetPass || password;

    if (!loginEmail || !loginPassword) {
      setErrorMessage('Please enter both work email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await apiClient.post('/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });

      if (res.data?.success && res.data.token) {
        const { user, token } = res.data;
        if (rememberMe) {
          localStorage.setItem('talentos_access_token', token);
          localStorage.setItem('talentos_current_user', JSON.stringify(user));
        } else {
          sessionStorage.setItem('talentos_access_token', token);
          sessionStorage.setItem('talentos_current_user', JSON.stringify(user));
        }

        showToast('Authentication Successful', `Welcome back, ${user.name}!`, 'fa-solid fa-circle-check text-emerald-400');
        onLoginSuccess(user, token);
      } else {
        setErrorMessage(res.data?.message || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to connect to authentication server. Please check backend status.';
      setErrorMessage(msg);
      showToast('Authentication Error', msg, 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPersona = (persona: typeof demoPersonas[0]) => {
    setEmail(persona.email);
    setPassword('talentos2026');
    handleLogin(undefined, persona.email, 'talentos2026');
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-600/30 mb-2">
            <i className="fa-solid fa-layer-group text-xl"></i>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            TalentOS
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Agency Suite
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access IT recruitment pipeline, bench rosters, and billable placements.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0f1420]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 text-[11px] uppercase tracking-wider">
                Corporate Email
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@talentos-agency.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-brand-400 hover:text-brand-300 cursor-pointer">
                  Default: talentos2026
                </span>
              </div>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-white/20 text-brand-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Platform</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>

          {/* Persona Switcher Section */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                1-Click Demo Personas (Instant Access)
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Seeded
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {demoPersonas.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleSelectPersona(p)}
                  className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-brand-500/30 transition-all text-left flex items-start gap-2.5 group"
                >
                  <div className={`w-7 h-7 rounded-lg ${p.avatarBg} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5`}>
                    {p.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-white group-hover:text-brand-300 truncate transition-colors">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{p.role}</div>
                    <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded border font-mono ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security / System Footer */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-emerald-500"></i>
            Strict RBAC & Margin Masking
          </span>
          <span>•</span>
          <span>Dual Database Architecture</span>
        </div>
      </div>
    </div>
  );
};

