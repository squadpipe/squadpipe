import React, { useMemo } from 'react';
import { sanitizeRichHtml } from '../../utils/richText';

interface RichTextDisplayProps {
  content?: string | null;
  className?: string;
}

/**
 * Safely renders client-safe HTML (or legacy plain-text paragraphs/bullets) using DOMPurify.
 */
export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({
  content,
  className = '',
}) => {
  const cleanHtml = useMemo(() => sanitizeRichHtml(String(content || '')), [content]);

  if (!cleanHtml) return null;

  return (
    <div
      className={`rich-text-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
};
