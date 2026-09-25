import React, { useState, useRef, useEffect } from "react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

const cardOptions = [
 { id: "feeds", label: "Feeds" },
 { id: "attendance", label: "Attendance" },
 { id: "holidays", label: "Holidays" },
 { id: "todo", label: "To-Do" },
 { id: "notes", label: "Notes"},
 { id: "birthdays", label: "Birthdays"},
 { id: "leavelog", label: "Leave Logs"},
 { id: "timeoffBalance", label: "Time Off"},
];

const AddCardMenu = ({ onAdd, currentCards = [] }) => {
 const [open, setOpen] = useState(false);
 const menuRef = useRef();
 const currentCardTypes = currentCards.map(c => c.type);

 useEffect(() => {
 const handler = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 return (
 <div className="relative inline-block text-left" ref={menuRef}>
 {/* Button */}
 <button
 onClick={() => setOpen(!open)}
 className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-amber-100 hover:bg-surface transition-all shadow-sm text-xs font-bold text-main uppercase tracking-wide"
 >
 More
 <EllipsisVerticalIcon className="h-4 w-4 text-muted" />
 </button>

 {/* Dropdown */}
 {open && (
 <div className="absolute right-0 mt-2 w-40 bg-surface rounded-xl shadow-lg border border-amber-100 z-50 py-1">
 <ul className="text-xs text-main">
 {cardOptions.map((option) => (
 <li
 key={option.id}
 onClick={() => {
 if (!currentCardTypes.includes(option.id)) {
 onAdd(option.id);
 setOpen(false);
 }
 }}
 className={`px-4 py-2 transition font-medium uppercase tracking-tight ${
 currentCardTypes.includes(option.id)
 ? "opacity-40 cursor-not-allowed"
 : "cursor-pointer hover:bg-[#E0E5EA]/50"
 }`}
 >
 {option.label}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 );
};

export default AddCardMenu;