import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders full-screen modal overlays at the document body root so parent
 * layout spacing (`space-y-*`) or scroll containers never crop the backdrop.
 */
export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

