import React from 'react';

interface SkillTagProps {
  skill: string;
  className?: string;
}

export const SkillTag: React.FC<SkillTagProps> = ({ skill, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80 mr-1 mb-1 ${className}`}
    >
      {skill.trim()}
    </span>
  );
};

