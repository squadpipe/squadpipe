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

        showToast('Authentication Successful', `Welcome back, ${user.name}!`, 'fa-solid fa-circle-check text-emerald-500');
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
        showToast('Account Created', `Welcome to TalentOS, ${user.name}!`, 'fa-solid fa-circle-check text-emerald-500');
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
        showToast('Code Issued', 'Password reset code generated.', 'fa-solid fa-key text-brand-500');
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
        showToast('Password Reset', 'Password updated! Please sign in with your new password.', 'fa-solid fa-circle-check text-emerald-500');
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

  const heroCopy = {
    login: {
      line1: 'Welcome back to',
      line2: 'TalentOS.',
      subtext: 'Sign in to pick up right where you left off and keep your pipeline moving.',
      cardTitle: 'Welcome back',
      cardSub: 'Sign in to your account',
    },
    signup: {
      line1: 'Launch your desk on',
      line2: 'TalentOS.',
      subtext: 'Create an agency account to manage requirements, bench rosters, and billable placements.',
      cardTitle: 'Create your account',
      cardSub: 'Register your agency workspace',
    },
    forgot: {
      line1: 'Recover access to',
      line2: 'TalentOS.',
      subtext: 'Enter your registered email address and we will issue a 6-digit recovery code.',
      cardTitle: 'Forgot password',
      cardSub: 'Verify your email to reset access',
    },
    reset: {
      line1: 'Secure your',
      line2: 'TalentOS.',
      subtext: 'Enter your 6-digit recovery code and choose a new password to return to your desk.',
      cardTitle: 'Set new password',
      cardSub: 'Complete password recovery',
    },
  }[authMode];

  const switchMode = (mode: 'login' | 'signup' | 'forgot' | 'reset') => {
    setErrorMessage('');
    setSuccessMessage('');
    setAuthMode(mode);
  };

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-[#FAFAFA] overflow-y-auto select-none">
      {/* Left Brand Column */}
      <div
        className="lg:w-[56%] xl:w-[58%] bg-[#0B0F17] text-white relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 flex-shrink-0 overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Top Brand Mark */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-lg bg-[#161922] border border-white/10 flex items-center justify-center shadow-sm">
            <i className="fa-solid fa-bolt text-sm text-white"></i>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">TalentOS</span>
        </div>

        {/* Center Hero Headline */}
        <div className="my-10 lg:my-auto py-4 space-y-4 z-10 max-w-lg">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white leading-[1.15]">
            {heroCopy.line1}
            <br />
            <span className="font-normal">{heroCopy.line2}</span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed font-light">
            {heroCopy.subtext}
          </p>
        </div>

        {/* Single-line Footer */}
        <div className="text-xs text-slate-400 z-10 truncate">
          Streamlined IT recruitment pipeline, bench rosters, and billable placements in one workspace.
        </div>
      </div>

      {/* Right Form Column */}
      <div className="flex-1 lg:w-[44%] xl:w-[42%] bg-[#FAFAFA] text-slate-800 flex flex-col justify-between p-6 sm:p-8 min-h-full overflow-y-auto">
        {/* Top Support Header */}
        <div className="flex items-center justify-end text-xs text-slate-500 gap-2">
          <span>Need help?</span>
          <a
            href="mailto:support@talentos.io"
            className="font-semibold text-slate-800 hover:text-black inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-regular fa-envelope text-[11px]"></i>
            <span>Contact Support</span>
          </a>
        </div>

        {/* Centered White Auth Card */}
        <div className="max-w-[380px] w-full bg-white border border-slate-200/80 card-shadow rounded-xl p-6 sm:p-8 my-auto mx-auto space-y-5 animate-fade-in">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{heroCopy.cardTitle}</h2>
            <p className="text-xs text-slate-500">{heroCopy.cardSub}</p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-check flex-shrink-0"></i>
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {authMode === 'login' && (
            <form onSubmit={(e) => handleLogin(e)} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#111318] hover:bg-black disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  Create one
                </button>
              </div>
            </form>
          )}

          {/* 2. SIGNUP FORM */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full name *</label>
                <input
                  type="text"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Work email *</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Role *</label>
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:border-brand-600 focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="ADMINISTRATOR">Administrator</option>
                    <option value="SENIOR_RECRUITER">Senior Recruiter</option>
                    <option value="TECHNICAL_RECRUITER">Technical Recruiter</option>
                    <option value="BENCH_SALES_LEAD">Bench Sales Lead</option>
                    <option value="ACCOUNT_EXECUTIVE">Account Executive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Practice desk</label>
                  <input
                    type="text"
                    value={signupDesk}
                    onChange={(e) => setSignupDesk(e.target.value)}
                    placeholder="US IT Contract"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Confirm password *</label>
                  <input
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-[#111318] hover:bg-black disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1.5">Email address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#111318] hover:bg-black disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Sending reset code...</span>
                  </>
                ) : (
                  <span>Send reset code</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* 4. RESET PASSWORD FORM */}
          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Verification code *</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit reset code"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 font-mono text-center text-sm tracking-widest focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">New password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Confirm new password *</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:border-brand-600 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-[#111318] hover:bg-black disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Updating password...</span>
                  </>
                ) : (
                  <span>Update password</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Cancel and return to sign in
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Subtle Bottom Spacer */}
        <div className="text-center text-[11px] text-slate-400">
          TalentOS Staffing Suite &bull; Tenant-Isolated Workspace
        </div>
      </div>
    </div>
  );
};
