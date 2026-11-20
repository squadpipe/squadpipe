import React from 'react';

interface SkillTagProps {
  skill: string;
  className?: string;
}

export const SkillTag: React.FC<SkillTagProps> = ({ skill, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100/90 text-slate-700 ${className}`}
    >
      {skill.trim()}
    </span>
  );
};

