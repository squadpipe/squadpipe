import React from 'react';
import { clearAuthSession } from '../../utils/authStorage';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled React UI error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetSession = () => {
    clearAuthSession();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-xl p-6 card-shadow space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-base font-semibold">
              !
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg sm:text-[19px] font-semibold text-slate-900 tracking-tight">Something went wrong</h1>
              <p className="text-xs text-slate-500">
                The workspace encountered an unexpected error. Your saved CRM records are safe.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                Reload Workspace
              </button>
              <button
                type="button"
                onClick={this.handleResetSession}
                className="h-8 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
              >
                Sign Out & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

