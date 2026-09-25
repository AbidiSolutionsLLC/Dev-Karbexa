import React from 'react';
import { FiInbox } from 'react-icons/fi';

const EmptyCardState = ({ message = "You haven't added anything yet", description = "Your items will appear here once added." }) => {
 return (
<div className="flex flex-col items-center justify-center py-3 flex-1 h-full min-h-[90px] text-center px-4 w-full animate-fade-in">
  <div className="relative mb-2">
  <div className="absolute inset-0 bg-gradient-to-tr from-amber-100 to-purple-100 rounded-full blur-sm opacity-70"></div>
  <div className="relative bg-surface w-9 h-9 rounded-full flex items-center justify-center shadow-sm border border-slate-100/50">
  <FiInbox className="w-4 h-4 text-muted" />
 </div>
 </div>
 <h4 className="text-[11px] font-bold text-main tracking-wide">{message}</h4>
 <p className="text-[9px] text-muted font-medium mt-1 uppercase tracking-wide max-w-[180px]">{description}</p>
 </div>
 );
};

export default EmptyCardState;
