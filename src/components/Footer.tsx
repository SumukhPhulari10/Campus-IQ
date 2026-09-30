import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-[#bfc9c3]/25 py-8">
      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-6
                      flex flex-col md:flex-row items-center justify-between gap-6">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#003527] flex items-center justify-center text-[#80bea6]">
            <span className="material-symbols-outlined text-[17px]">school</span>
          </div>
          <div>
            <p className="font-headline font-bold text-[0.875rem] text-[#003527] leading-tight">
              CampusIQ Intelligence System
            </p>
            <p className="text-[10px] text-[#9ca8a3] font-medium mt-0.5">
              Grounded RAG Information Architecture for Higher Education
            </p>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 text-xs font-medium text-[#707974]">
          {['Academic Regulations', 'Examination Cell', 'Student Welfare', 'Campus Helpdesk'].map(l => (
            <span key={l} className="hover:text-[#003527] cursor-pointer transition-colors">
              {l}
            </span>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-[10px] text-[#9ca8a3]">
          © 2026 CampusIQ · Made by Fantastic Four
        </div>

      </div>
    </footer>
  );
};
