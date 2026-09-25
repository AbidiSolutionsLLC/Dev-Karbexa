import React, { useState, useRef, useEffect } from "react";
import { FiMoreVertical, FiTrash2, FiClock } from "react-icons/fi";
import EmptyCardState from "./EmptyCardState";

const upcomingDeadlines = [
 {
 task: "Submit weekly report",
 dueDate: "Due: May 24",
 },
 {
 task: "Team check-in meeting",
 dueDate: "Due: May 25",
 },
 {
 task: "Complete security training",
 dueDate: "Due: May 28",
 },
];

const UpcomingDeadlinesCard = ({ onDelete }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const menuRef = useRef();

 useEffect(() => {
 const handleClickOutside = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-4 h-full flex flex-col">
 <div className="flex justify-between items-start mb-3">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Upcoming Deadlines</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">
 Tasks due this week
 </p>
 </div>

 <div className="relative" ref={menuRef}>
 <button
 onClick={() => setMenuOpen(!menuOpen)}
 className="p-1.5 rounded-lg hover:bg-app transition"
 >
 <FiMoreVertical className="h-4 w-4 text-muted" />
 </button>

 {menuOpen && (
 <div className="absolute right-0 mt-1 w-32 bg-surface shadow-lg border border-subtle rounded-xl z-50">
 <button
 onClick={() => {
 onDelete();
 setMenuOpen(false);
 }}
 className="flex items-center w-full px-3 py-2 text-[10px] text-red-500 hover:bg-red-50 dark:bg-red-900/30 font-medium"
 >
 <FiTrash2 className="w-3 h-3 mr-2" />
 Delete Card
 </button>
 </div>
 )}
 </div>
 </div>

 <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[200px] w-full">
 {upcomingDeadlines.length > 0 ? (
 <ul className="space-y-2 text-[10px]">
 {upcomingDeadlines.map((item, index) => (
 <li
 key={index}
 className="bg-[#E0E5EA]/30 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
 >
 <div className="min-w-0 flex-1">
 <span className="font-medium text-main truncate block">{item.task}</span>
 <div className="text-[9px] text-muted">{item.dueDate}</div>
 </div>
 </li>
 ))}
 </ul>
 ) : (
 <EmptyCardState message="You haven't added anything yet" />
 )}
 </div>
 </div>
 );
};

export default UpcomingDeadlinesCard;

