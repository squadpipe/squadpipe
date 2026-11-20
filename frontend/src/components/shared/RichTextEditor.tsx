import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from 'lucide-react';
import { AiIcon } from './AiBrand';
import { plainTextSummaryToHtml, sanitizeRichHtml } from '../../utils/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const normalizeForComparison = (raw: string): string => {
  const converted = plainTextSummaryToHtml(raw);
  return converted.replace(/\s+/g, ' ').trim();
};

/**
 * Tiptap-powered rich text editor with auto-incrementing height capped at `maxHeight`.
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write formatted summary, bullet responsibilities, and role highlights...',
  minHeight = 120,
  maxHeight = 340,
  disabled = false,
  className = '',
  ariaLabel = 'Rich text editor',
}) => {
  const initialContent = sanitizeRichHtml(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        class: 'tiptap focus:outline-none px-3.5 py-2.5',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.isEmpty ? '' : instance.getHTML();
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const nextNormalized = normalizeForComparison(value);
    const currentNormalized = editor.isEmpty ? '' : normalizeForComparison(editor.getHTML());
    if (nextNormalized !== currentNormalized) {
      editor.commands.setContent(sanitizeRichHtml(value), { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        style={{ minHeight: `${minHeight}px` }}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/40 animate-pulse"
      />
    );
  }

  const ToolbarBtn = ({
    active,
    onClick,
    title,
    disabledBtn,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    disabledBtn?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || disabledBtn}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
        active
          ? 'bg-brand-50 text-brand-700 border border-brand-200/80 shadow-sm'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/15 transition-all ${
        disabled ? 'opacity-60 bg-slate-50' : ''
      } ${className}`}
    >
      {/* Clean minimal toolbar */}
      <div className="px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolbarBtn
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Section Heading"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <span className="w-px h-4 bg-slate-200 mx-1" aria-hidden="true" />
          <ToolbarBtn
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarBtn>
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabledBtn={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabledBtn={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
        </div>
      </div>

      {/* Auto-growing content container capped cleanly at maxHeight */}
      <div
        onClick={() => !disabled && editor.chain().focus().run()}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        className="tiptap-content overflow-y-auto custom-scrollbar cursor-text"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

interface RoleSummaryFieldProps {
  value: string;
  onChange: (nextHtml: string) => void;
  onAutoFill?: () => void;
  label?: string;
  labelClassName?: string;
  helperText?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
}

/**
 * Standardized "Role Scope & Public Summary" field shared across Requirement create/edit forms.
 */
export const RoleSummaryField: React.FC<RoleSummaryFieldProps> = ({
  value,
  onChange,
  onAutoFill,
  label = 'Role Scope & Public Summary (Candidate-Facing)',
  labelClassName = 'block text-[11px] font-semibold text-slate-700',
  helperText,
  placeholder,
  minHeight = 105,
  maxHeight = 260,
  disabled = false,
}) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-1">
      <label className={labelClassName}>{label}</label>
      {onAutoFill && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAutoFill}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer disabled:opacity-50"
        >
          <AiIcon className="w-3 h-3" />
          <span>Auto-Fill Summary</span>
        </button>
      )}
    </div>
    <RichTextEditor
      value={value}
      onChange={onChange}
      minHeight={minHeight}
      maxHeight={maxHeight}
      disabled={disabled}
      ariaLabel={label}
      placeholder={placeholder}
    />
    {helperText && <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>}
  </div>
);
