import React, { useState } from 'react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showToast }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');

  // Shared / Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Signup fields
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupRole, setSignupRole] = useState('TECHNICAL_RECRUITER');
  const [signupDesk, setSignupDesk] = useState('US IT Contract (C2C & W2)');

  // Forgot / Reset fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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
      setErrorMessage('Please enter both corporate email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFullName || !signupEmail || !signupPassword) {
      setErrorMessage('All required fields must be completed.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/signup', {
        fullName: signupFullName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
        desk: signupDesk,
      });

      if (res.data?.success && res.data.token) {
        const { user, token } = res.data;
        localStorage.setItem('talentos_access_token', token);
        localStorage.setItem('talentos_current_user', JSON.stringify(user));
        showToast('Account Created', `Welcome to TalentOS, ${user.name}!`, 'fa-solid fa-circle-check text-emerald-400');
        onLoginSuccess(user, token);
      } else {
        setErrorMessage(res.data?.message || 'Registration failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create account. Please try again.';
      setErrorMessage(msg);
      showToast('Signup Failed', msg, 'fa-solid fa-circle-exclamation text-rose-500');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setErrorMessage('Please provide your corporate email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      if (res.data?.success) {
        setSuccessMessage(`Reset code generated for ${forgotEmail}. Code: ${res.data.resetCode || '123456'}`);
        setResetCode(res.data.resetCode || '');
        setAuthMode('reset');
        showToast('Code Issued', 'Password reset code generated.', 'fa-solid fa-key text-brand-400');
      } else {
        setErrorMessage(res.data?.message || 'Email lookup failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to request password reset.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmNewPassword) {
      setErrorMessage('Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: forgotEmail || email,
        resetCode,
        newPassword,
      });

      if (res.data?.success) {
        showToast('Password Reset', 'Password updated! Please sign in with your new password.', 'fa-solid fa-circle-check text-emerald-400');
        setEmail(forgotEmail || email);
        setPassword(newPassword);
        setAuthMode('login');
        setSuccessMessage('Password reset successfully! You may now sign in.');
      } else {
        setErrorMessage(res.data?.message || 'Password reset failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password.';
      setErrorMessage(msg);
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
            {authMode === 'login' && 'Sign in to access IT recruitment pipeline, bench rosters, and billable placements.'}
            {authMode === 'signup' && 'Create your agency recruiter account to start managing submissions and placements.'}
            {authMode === 'forgot' && 'Enter your registered corporate email to initiate password recovery.'}
            {authMode === 'reset' && 'Set a new secure password for your TalentOS CRM account.'}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0f1420]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-check flex-shrink-0"></i>
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {authMode === 'login' && (
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
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSuccessMessage('');
                      setAuthMode('forgot');
                    }}
                    className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
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
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 cursor-pointer"
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

              <div className="pt-2 text-center text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setAuthMode('signup');
                  }}
                  className="text-brand-400 hover:text-brand-300 font-semibold cursor-pointer underline underline-offset-2"
                >
                  Create Agency Account
                </button>
              </div>
            </form>
          )}

          {/* 2. SIGNUP FORM */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Full Name *
                </label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="text"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    placeholder="e.g. Johnathan Miller"
                    required
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Corporate Work Email *
                </label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="name@talentos-agency.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                    Role *
                  </label>
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                  >
                    <option value="ADMINISTRATOR">Administrator</option>
                    <option value="SENIOR_RECRUITER">Senior Recruiter</option>
                    <option value="TECHNICAL_RECRUITER">Technical Recruiter</option>
                    <option value="BENCH_SALES_LEAD">Bench Sales Lead</option>
                    <option value="ACCOUNT_EXECUTIVE">Account Executive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                    Practice Desk
                  </label>
                  <input
                    type="text"
                    value={signupDesk}
                    onChange={(e) => setSignupDesk(e.target.value)}
                    placeholder="US IT Contract"
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    required
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register Agency Account</span>
                    <i className="fa-solid fa-user-plus text-xs"></i>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setAuthMode('login');
                  }}
                  className="text-brand-400 hover:text-brand-300 font-semibold cursor-pointer underline underline-offset-2"
                >
                  Sign In Here
                </button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 text-[11px] uppercase tracking-wider">
                  Corporate Work Email
                </label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your registered corporate email"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-brand-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Sending Reset Code...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Reset Code</span>
                    <i className="fa-solid fa-key text-xs"></i>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400">
                Remember your credentials?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setAuthMode('login');
                  }}
                  className="text-brand-400 hover:text-brand-300 font-semibold cursor-pointer underline underline-offset-2"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 4. RESET PASSWORD FORM */}
          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Verification Reset Code *
                </label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit reset code"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white font-mono text-center text-sm tracking-widest focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Reset Password</span>
                    <i className="fa-solid fa-check text-xs"></i>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setAuthMode('login');
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel and Return to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Persona Switcher Section (visible only on login screen) */}
          {authMode === 'login' && (
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
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-brand-500/30 transition-all text-left flex items-start gap-2.5 group cursor-pointer"
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
          )}
        </div>

        {/* Security / System Footer */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-emerald-500"></i>
            Strict RBAC &amp; Margin Masking
          </span>
          <span>•</span>
          <span>PostgreSQL + Prisma Core</span>
        </div>
      </div>
    </div>
  );
};
