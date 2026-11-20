import React from 'react';
import { AnimatePresence, HTMLMotionProps, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

export const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

export const DRAWER_SPRING = {
  type: 'spring' as const,
  stiffness: 430,
  damping: 40,
  mass: 0.85,
};

export const POPOVER_TRANSITION = {
  duration: 0.15,
  ease: APPLE_EASE,
};

export interface AnimatedOverlayProps {
  isOpen: boolean;
  onBackdropClick?: () => void;
  zIndexClass?: string;
  backdropClassName?: string;
  panelClassName?: string;
  role?: React.AriaRole;
  ariaModal?: boolean | 'true' | 'false';
  ariaLabel?: string;
  usePortal?: boolean;
  children: React.ReactNode;
}

/**
 * Animated center modal backdrop + scale/lift panel supporting smooth open and exit motion.
 */
export const AnimatedModal: React.FC<AnimatedOverlayProps> = ({
  isOpen,
  onBackdropClick,
  zIndexClass = 'z-50',
  backdropClassName = 'bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4',
  panelClassName = 'bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]',
  role = 'dialog',
  ariaModal = true,
  ariaLabel,
  usePortal = true,
  children,
}) => {
  const tree = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="animated-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onBackdropClick}
          className={`fixed inset-0 ${zIndexClass} ${backdropClassName}`}
        >
          <motion.div
            key="animated-modal-panel"
            role={role}
            aria-modal={ariaModal}
            aria-label={ariaLabel}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: APPLE_EASE }}
            onClick={(e) => e.stopPropagation()}
            className={panelClassName}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return usePortal ? <ModalPortal>{tree}</ModalPortal> : tree;
};

/**
 * Animated right-side slide-over drawer with smooth backdrop fade and spring slide motion.
 */
export const AnimatedDrawer: React.FC<AnimatedOverlayProps> = ({
  isOpen,
  onBackdropClick,
  zIndexClass = 'z-50',
  backdropClassName = 'bg-slate-900/45 backdrop-blur-[2px] flex justify-end',
  panelClassName = 'bg-white h-full w-full max-w-2xl border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col',
  role = 'dialog',
  ariaModal = true,
  ariaLabel,
  usePortal = true,
  children,
}) => {
  const tree = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="animated-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onBackdropClick}
          className={`fixed inset-0 ${zIndexClass} ${backdropClassName}`}
        >
          <motion.div
            key="animated-drawer-panel"
            role={role}
            aria-modal={ariaModal}
            aria-label={ariaLabel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={DRAWER_SPRING}
            onClick={(e) => e.stopPropagation()}
            className={panelClassName}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return usePortal ? <ModalPortal>{tree}</ModalPortal> : tree;
};

/**
 * Smooth popover / dropdown motion wrapper for selects, date pickers, and context menus.
 */
export const AnimatedPopover = React.forwardRef<
  HTMLDivElement,
  HTMLMotionProps<'div'>
>(({ children, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: -4, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -4, scale: 0.98 }}
    transition={POPOVER_TRANSITION}
    {...props}
  >
    {children}
  </motion.div>
));

AnimatedPopover.displayName = 'AnimatedPopover';

export interface ModalHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  closeAriaLabel?: string;
  className?: string;
}

/**
 * Shared light editorial header for all modals and slide-over drawers,
 * replacing legacy dark banner headers across workspace overlays.
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
  icon,
  title,
  subtitle,
  badges,
  actions,
  onClose,
  closeDisabled = false,
  closeAriaLabel = 'Close modal',
  className = '',
}) => (
  <div
    className={`px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 ${className}`}
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
          {badges}
        </div>
        {subtitle && (
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {actions}
      {onClose && (
        <button
          type="button"
          disabled={closeDisabled}
          onClick={onClose}
          aria-label={closeAriaLabel}
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);

/**
 * Smooth entrance/exit animation for floating toast banners.
 */
export const AnimatedToast: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.96 }}
    transition={{ type: 'spring', stiffness: 460, damping: 32 }}
    {...props}
  >
    {children}
  </motion.div>
);
