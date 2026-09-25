import React, { useRef, useState, useEffect } from "react";
import { FiMoreVertical, FiTrash2, FiGift } from "react-icons/fi";
import api from "../../axios";
import { toast } from "react-toastify";
import EmptyCardState from "./EmptyCardState";
import Loader from "../ui/Loader";

const UpcomingBirthdaysCard = ({ onDelete }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const [birthdays, setBirthdays] = useState([]);
 const [loading, setLoading] = useState(true);
 const menuRef = useRef();

 useEffect(() => {
 const fetchBirthdays = async () => {
 try {
 const response = await api.get('/users/birthdays/upcoming');
 setBirthdays(response.data);
 } catch (error) {
 console.error("Failed to fetch birthdays:", error);
 toast.error("Failed to load birthday data");
 } finally {
 setLoading(false);
 }
 };

 fetchBirthdays();
 }, []);

 useEffect(() => {
 const handler = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 if (loading) {
 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
 <div className="flex items-center gap-2 mb-3">
 <FiGift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Upcoming Birthdays</h3>
 </div>
 <Loader size="md" />
 </div>
 );
 }

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiGift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Upcoming Birthdays</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">Celebrate your team!</p>
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

<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[150px] w-full">
  {birthdays.length > 0 ? (
  <ul className="space-y-1.5 text-[10px]">
  {birthdays.slice(0, 6).map((b, index) => (
  <li
  key={index}
  className="bg-[#E0E5EA]/30 rounded-lg p-2 flex items-center gap-2"
  >
  <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
 {b.name?.[0] || "?"}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-main truncate">{b.name || "Unknown"}</div>
 <div className="text-[9px] text-muted truncate">
 {b.date || "Date unknown"}
 </div>
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

export default UpcomingBirthdaysCard;

