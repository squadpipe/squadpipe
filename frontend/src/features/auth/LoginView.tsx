import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { BrandLogo } from '../../components/shared/BrandMark';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';
import { setAuthSession } from '../../utils/authStorage';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showToast }) => {
  const [authMode, setAuthMode] = useState<
    'login' | 'signup' | 'forgot' | 'verify-otp' | 'reset' | 'accept-invite'
  >('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Signup state (self-registrant always becomes workspace Administrator)
  const [signupFullName, setSignupFullName] = useState('');
  const [signupCompanyName, setSignupCompanyName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Forgot / Verify OTP / Reset state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Invite onboarding state
  const [inviteToken, setInviteToken] = useState('');
  const [inviteProfile, setInviteProfile] = useState<{
    email: string;
    fullName: string;
    agencyName: string;
    role: string;
    desk: string;
  } | null>(null);
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirmPassword, setInviteConfirmPassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [showInviteConfirmPassword, setShowInviteConfirmPassword] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('inviteToken')?.trim();
    if (!token) return;

    setInviteToken(token);
    setAuthMode('accept-invite');
    setIsLoadingInvite(true);
    setErrorMessage('');

    apiClient
      .get(`/auth/invite/${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setInviteProfile(res.data.data);
          setInviteFullName(res.data.data.fullName || '');
        } else {
          setErrorMessage(res.data?.message || 'This invitation link is invalid or has expired.');
        }
      })
      .catch((err) => {
        setErrorMessage(
          err?.response?.data?.message || 'This invitation link is invalid or has expired.'
        );
      })
      .finally(() => {
        setIsLoadingInvite(false);
      });
  }, []);

  const isValidEmailFormat = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleLogin = async (e?: React.FormEvent, targetEmail?: string, targetPass?: string) => {
    if (e) e.preventDefault();
    const loginEmail = targetEmail || email;
    const loginPassword = targetPass || password;

    const missingFields = getMissingFieldLabels([
      { label: 'Email address', valid: Boolean(loginEmail.trim()) },
      { label: 'Password', valid: Boolean(loginPassword) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      setErrorMessage(formatMissingFieldsMessage(missingFields));
      return;
    }
    if (!isValidEmailFormat(loginEmail)) {
      setValidationAttempted(true);
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/login', {
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });

      if (res.data?.success && res.data.token) {
        const { user, token } = res.data;
        setAuthSession(token, user, rememberMe);

        showToast('Authentication Successful', `Welcome back, ${user.name}!`, 'success');
        onLoginSuccess(user, token);
      } else {
        setErrorMessage(
          res.data?.message || 'We could not sign you in. Please double-check your details.'
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'We could not sign you in right now. Please try again in a moment.';
      setErrorMessage(msg);
      showToast('Sign-In Issue', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(signupFullName.trim()) },
      { label: 'Company Name', valid: Boolean(signupCompanyName.trim()) },
      { label: 'Work Email', valid: Boolean(signupEmail.trim()) },
      { label: 'Password', valid: Boolean(signupPassword) },
      { label: 'Confirm Password', valid: Boolean(signupConfirmPassword) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      setErrorMessage(formatMissingFieldsMessage(missingFields));
      return;
    }
    if (!isValidEmailFormat(signupEmail)) {
      setValidationAttempted(true);
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    if (signupPassword.length < 6) {
      setValidationAttempted(true);
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setValidationAttempted(true);
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/signup', {
        fullName: signupFullName.trim(),
        agencyName: signupCompanyName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        role: 'ADMINISTRATOR',
      });

      if (res.data?.success && res.data.token) {
        const { user, token } = res.data;
        setAuthSession(token, user, true);
        showToast('Account Created', `Welcome to SquadPipe, ${user.name}!`, 'success');
        onLoginSuccess(user, token);
      } else {
        setErrorMessage(res.data?.message || 'We could not create your account. Please try again.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'We could not create your account right now. Please try again.';
      setErrorMessage(msg);
      showToast('Signup Issue', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setValidationAttempted(true);
      setErrorMessage('Email address is required.');
      return;
    }
    if (!isValidEmailFormat(forgotEmail)) {
      setValidationAttempted(true);
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      if (res.data?.success) {
        setSuccessMessage(
          res.data.message ||
            `If an account exists for ${forgotEmail}, a 6-digit verification code has been dispatched.`
        );
        setResetCode('');
        setResetSessionToken('');
        setResendCooldown(Number(res.data?.cooldownSeconds) || 120);
        setAuthMode('verify-otp');
        showToast(
          'Verification Requested',
          'Check your email inbox for your 6-digit verification code.',
          'key'
        );
      } else {
        setErrorMessage(res.data?.message || 'Email lookup failed.');
      }
    } catch (err: any) {
      const retryAfter = Number(err?.response?.data?.retryAfterSeconds || 0);
      if (err?.response?.status === 429 && retryAfter > 0) {
        setResendCooldown(retryAfter);
        setAuthMode('verify-otp');
        setSuccessMessage('A 6-digit verification code was recently sent to your email. Please enter it below.');
        return;
      }
      const msg = err.response?.data?.message || 'Unable to request password reset.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address first.');
      setAuthMode('forgot');
      return;
    }

    setIsResendingOtp(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: targetEmail });
      if (res.data?.success) {
        setResendCooldown(Number(res.data?.cooldownSeconds) || 120);
        setSuccessMessage('A new 6-digit verification code has been sent to your email.');
        showToast(
          'Code Resent',
          'Check your inbox for the new 6-digit verification code.',
          'send'
        );
      } else {
        setErrorMessage(res.data?.message || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      const retryAfter = Number(err?.response?.data?.retryAfterSeconds || 0);
      if (err?.response?.status === 429 && retryAfter > 0) {
        setResendCooldown(retryAfter);
        return;
      }
      setErrorMessage(err?.response?.data?.message || 'Unable to resend verification code.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = resetCode.trim();
    if (cleanCode.length < 6) {
      setValidationAttempted(true);
      setErrorMessage(
        cleanCode
          ? 'Please enter the complete 6-digit verification code.'
          : '6-digit verification code is required.'
      );
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/verify-reset-otp', {
        email: forgotEmail || email,
        resetCode: cleanCode,
      });

      if (res.data?.success && res.data?.resetToken) {
        setResetSessionToken(res.data.resetToken);
        setNewPassword('');
        setConfirmNewPassword('');
        setSuccessMessage('Code verified! Now enter and confirm your new password.');
        setAuthMode('reset');
      } else {
        setErrorMessage(res.data?.message || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields = getMissingFieldLabels([
      { label: 'New password', valid: Boolean(newPassword) },
      { label: 'Confirm new password', valid: Boolean(confirmNewPassword) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      setErrorMessage(formatMissingFieldsMessage(missingFields));
      return;
    }
    if (newPassword.length < 6) {
      setValidationAttempted(true);
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setValidationAttempted(true);
      setErrorMessage('New passwords do not match.');
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: forgotEmail || email,
        resetToken: resetSessionToken,
        resetCode,
        newPassword,
      });

      if (res.data?.success) {
        showToast(
          'Password Reset',
          'Password updated! Please sign in with your new password.',
          'success'
        );
        setEmail(forgotEmail || email);
        setPassword(newPassword);
        setResetCode('');
        setResetSessionToken('');
        setAuthMode('login');
        setSuccessMessage('Password reset successfully! You may now sign in.');
      } else {
        setErrorMessage(res.data?.message || 'Password reset failed.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'We could not reset your password right now. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) {
      setErrorMessage('Invitation token is missing.');
      return;
    }
    const missingFields = getMissingFieldLabels([
      { label: 'Full name', valid: Boolean(inviteFullName.trim()) },
      { label: 'Password', valid: Boolean(invitePassword) },
      { label: 'Confirm password', valid: Boolean(inviteConfirmPassword) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      setErrorMessage(formatMissingFieldsMessage(missingFields));
      return;
    }
    if (invitePassword.length < 6) {
      setValidationAttempted(true);
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (invitePassword !== inviteConfirmPassword) {
      setValidationAttempted(true);
      setErrorMessage('Passwords do not match.');
      return;
    }

    setValidationAttempted(false);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiClient.post('/auth/accept-invite', {
        token: inviteToken,
        fullName: inviteFullName.trim() || inviteProfile?.fullName,
        password: invitePassword,
      });

      if (res.data?.success && res.data?.token && res.data?.user) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        setAuthSession(res.data.token, res.data.user, true);
        showToast(
          'Onboarding Complete',
          res.data.message || `Welcome to ${res.data.user.agencyName}!`,
          'success'
        );
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setErrorMessage(
          res.data?.message || 'We could not complete your setup. Please try again.'
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'We could not complete your setup right now. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const heroCopy = {
    login: {
      line1: 'Welcome back to',
      line2: 'SquadPipe.',
      subtext: 'Sign in to pick up where you left off and keep your recruitment pipeline moving.',
      cardTitle: 'Welcome back',
      cardSub: 'Sign in to your account',
    },
    signup: {
      line1: 'Launch your workspace on',
      line2: 'SquadPipe.',
      subtext: 'Create an administrator account to manage requisitions, bench rosters, and billable placements.',
      cardTitle: 'Create your account',
      cardSub: 'Register as workspace administrator',
    },
    forgot: {
      line1: 'Recover access to',
      line2: 'SquadPipe.',
      subtext: 'Enter your registered email address and we will issue a 6-digit recovery code.',
      cardTitle: 'Reset your password',
      cardSub: 'We will generate a one-time verification code',
    },
    'verify-otp': {
      line1: 'Verify your identity on',
      line2: 'SquadPipe.',
      subtext: 'Enter the 6-digit verification code sent to your email before choosing a new password.',
      cardTitle: 'Enter verification code',
      cardSub: `Code sent to ${forgotEmail || email || 'your email'}`,
    },
    reset: {
      line1: 'Secure your account on',
      line2: 'SquadPipe.',
      subtext: 'Your code is verified. Set a strong new password to return to your desk.',
      cardTitle: 'Choose a new password',
      cardSub: 'Complete your account recovery',
    },
    'accept-invite': {
      line1: 'Join your team on',
      line2: 'SquadPipe.',
      subtext: 'Set your password to activate your account and enter your workspace.',
      cardTitle: 'Complete your onboarding',
      cardSub: inviteProfile
        ? `Joining ${inviteProfile.agencyName}`
        : 'Activate your workspace invitation',
    },
  }[authMode];

  const switchMode = (
    mode: 'login' | 'signup' | 'forgot' | 'verify-otp' | 'reset' | 'accept-invite'
  ) => {
    setErrorMessage('');
    setSuccessMessage('');
    setValidationAttempted(false);
    setAuthMode(mode);
  };

  const inputBaseClass =
    'w-full h-10 px-3.5 bg-white border rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:outline-none transition-all';

  const authInputClass = (hasError: boolean, extraClass = '') =>
    `${inputBaseClass} ${
      hasError
        ? INVALID_FIELD_CLASSES
        : 'border-slate-200 focus:border-brand-600 focus:ring-brand-600/15'
    }${extraClass ? ` ${extraClass}` : ''}`;

  const loginEmailInvalid =
    validationAttempted && (!email.trim() || !isValidEmailFormat(email));
  const loginPasswordInvalid = validationAttempted && !password;
  const signupNameInvalid = validationAttempted && !signupFullName.trim();
  const signupCompanyInvalid = validationAttempted && !signupCompanyName.trim();
  const signupEmailInvalid =
    validationAttempted && (!signupEmail.trim() || !isValidEmailFormat(signupEmail));
  const signupPasswordInvalid =
    validationAttempted && (!signupPassword || signupPassword.length < 6);
  const signupConfirmInvalid =
    validationAttempted &&
    (!signupConfirmPassword ||
      (signupPassword.length >= 6 && signupPassword !== signupConfirmPassword));
  const forgotEmailInvalid =
    validationAttempted && (!forgotEmail.trim() || !isValidEmailFormat(forgotEmail));
  const otpInvalid = validationAttempted && resetCode.trim().length < 6;
  const newPasswordInvalid =
    validationAttempted && (!newPassword || newPassword.length < 6);
  const confirmNewPasswordInvalid =
    validationAttempted &&
    (!confirmNewPassword || (newPassword.length >= 6 && newPassword !== confirmNewPassword));
  const inviteNameInvalid = validationAttempted && !inviteFullName.trim();
  const invitePassInvalid =
    validationAttempted && (!invitePassword || invitePassword.length < 6);
  const inviteConfirmInvalid =
    validationAttempted &&
    (!inviteConfirmPassword ||
      (invitePassword.length >= 6 && invitePassword !== inviteConfirmPassword));

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-[#FAFAFA] overflow-y-auto select-none">
      {/* Left 40% Brand Column */}
      <div
        className="w-full lg:w-[40%] bg-[#141615] text-white flex flex-col justify-between p-8 sm:p-10 lg:p-12 xl:p-14 gap-8 flex-shrink-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Top Brand Mark */}
        <BrandLogo size="lg" surface="dark" className="flex-shrink-0" />

        {/* Center Hero Headline */}
        <div className="space-y-4 max-w-md my-auto py-4">
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
        <div className="text-xs text-slate-400 truncate flex-shrink-0">
          Streamlined IT recruitment pipeline, bench rosters, and billable placements in one workspace.
        </div>
      </div>

      {/* Right 60% Form Column */}
      <div className="w-full lg:w-[60%] bg-[#FAFAFA] text-slate-800 flex flex-col justify-between p-6 sm:p-10 gap-8 overflow-y-auto">
        {/* Top Support Link */}
        <div className="flex items-center justify-end text-xs text-slate-500 gap-2 flex-shrink-0">
          <span>Need help?</span>
          <a
            href="mailto:support@squadpipe.com"
            className="font-medium text-slate-800 hover:text-black inline-flex items-center gap-1.5 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </a>
        </div>

        {/* Centered White Auth Card */}
        <div className="max-w-[400px] w-full bg-white border border-slate-200/80 card-shadow rounded-xl p-6 sm:p-8 mx-auto space-y-5 animate-fade-in">
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{heroCopy.cardTitle}</h2>
            <p className="text-xs text-slate-500">{heroCopy.cardSub}</p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {authMode === 'login' && (
            <form noValidate onSubmit={(e) => handleLogin(e)} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Email address</label>
                  {loginEmailInvalid && !email.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={authInputClass(loginEmailInvalid)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-700 font-medium">Password</label>
                    {loginPasswordInvalid && (
                      <span className="text-[11px] font-semibold text-rose-600">Required</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={authInputClass(loginPasswordInvalid, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
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
            <form noValidate onSubmit={handleSignup} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Full name *</label>
                  {signupNameInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="text"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className={authInputClass(signupNameInvalid)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Company name *</label>
                  {signupCompanyInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="text"
                  value={signupCompanyName}
                  onChange={(e) => setSignupCompanyName(e.target.value)}
                  placeholder="e.g. Apex Staffing Solutions"
                  className={authInputClass(signupCompanyInvalid)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Work email *</label>
                  {signupEmailInvalid && !signupEmail.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={authInputClass(signupEmailInvalid)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Password *</label>
                  {signupPasswordInvalid && !signupPassword && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className={authInputClass(signupPasswordInvalid, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Confirm password *</label>
                  {signupConfirmInvalid && !signupConfirmPassword && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={authInputClass(signupConfirmInvalid, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    aria-label={showSignupConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-1 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
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
            <form noValidate onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Email address</label>
                  {forgotEmailInvalid && !forgotEmail.trim() && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={authInputClass(forgotEmailInvalid)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending reset code...</span>
                  </>
                ) : (
                  <>
                    <span>Send reset code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
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

          {/* 4. VERIFY OTP FORM (OTP only + 2-minute resend timer) */}
          {authMode === 'verify-otp' && (
            <form noValidate key="verify-otp-form" onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">
                    6-digit verification code *
                  </label>
                  {otpInvalid && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <input
                  key="reset-verification-code"
                  type="text"
                  name="verificationCode"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className={authInputClass(otpInvalid, 'text-center text-base font-semibold tracking-[0.35em]')}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-1 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResendingOtp}
                  className="font-medium text-slate-900 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                >
                  {isResendingOtp
                    ? 'Resending code...'
                    : resendCooldown > 0
                      ? `Resend code in ${formatCountdown(resendCooldown)}`
                      : 'Resend verification code'}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                >
                  Change email
                </button>
              </div>
            </form>
          )}

          {/* 5. RESET PASSWORD FORM (appears only after OTP verified) */}
          {authMode === 'reset' && (
            <form noValidate key="reset-password-form" onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">New password *</label>
                  {newPasswordInvalid && !newPassword && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className={authInputClass(newPasswordInvalid, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-medium">Confirm new password *</label>
                  {confirmNewPasswordInvalid && !confirmNewPassword && (
                    <span className="text-[11px] font-semibold text-rose-600">Required</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={authInputClass(confirmNewPasswordInvalid, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    aria-label={showConfirmNewPassword ? 'Hide confirm new password' : 'Show confirm new password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-1 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Update password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
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

          {/* 6. ACCEPT INVITE & ONBOARD FORM */}
          {authMode === 'accept-invite' && (
            <div className="space-y-4 text-xs">
              {isLoadingInvite ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                  <span>Validating your invitation link...</span>
                </div>
              ) : inviteProfile ? (
                <form noValidate onSubmit={handleAcceptInvite} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Workspace</span>
                      <span className="font-semibold text-slate-900">{inviteProfile.agencyName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Email</span>
                      <span className="font-medium text-slate-700">{inviteProfile.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Role</span>
                      <span className="font-medium text-brand-700">
                        {inviteProfile.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-medium">Full name *</label>
                      {inviteNameInvalid && (
                        <span className="text-[11px] font-semibold text-rose-600">Required</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      placeholder="Your full name"
                      className={authInputClass(inviteNameInvalid)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-medium">Create password *</label>
                      {invitePassInvalid && !invitePassword && (
                        <span className="text-[11px] font-semibold text-rose-600">Required</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showInvitePassword ? 'text' : 'password'}
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className={authInputClass(invitePassInvalid, 'pr-10')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowInvitePassword(!showInvitePassword)}
                        aria-label={showInvitePassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-medium">Confirm password *</label>
                      {inviteConfirmInvalid && !inviteConfirmPassword && (
                        <span className="text-[11px] font-semibold text-rose-600">Required</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showInviteConfirmPassword ? 'text' : 'password'}
                        value={inviteConfirmPassword}
                        onChange={(e) => setInviteConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className={authInputClass(inviteConfirmInvalid, 'pr-10')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowInviteConfirmPassword(!showInviteConfirmPassword)}
                        aria-label={showInviteConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showInviteConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 mt-1 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Activating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete onboarding &amp; enter workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      window.history.replaceState({}, document.title, window.location.pathname);
                      switchMode('login');
                    }}
                    className="text-slate-900 font-semibold hover:underline cursor-pointer"
                  >
                    Return to sign in
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtle Bottom Spacer */}
        <div className="text-center text-[11px] text-slate-400 flex-shrink-0">
          SquadPipe Staffing Suite &bull; Enterprise Workspace
        </div>
      </div>
    </div>
  );
};
