import React, { useState, useEffect, useRef } from "react";
import { FiCalendar, FiTrash2, FiMoreVertical } from "react-icons/fi";
import { LuMoonStar } from "react-icons/lu";
import { BsStars } from "react-icons/bs";
import { FaTree } from "react-icons/fa";
import holidayApi from '../../api/holidayApi';
import EmptyCardState from "./EmptyCardState";

const HolidaysCard = ({ onDelete }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const [holidays, setHolidays] = useState([]);
 const [loading, setLoading] = useState(true);
 const menuRef = useRef();

 useEffect(() => {
 const fetchHolidays = async () => {
 try {
 const data = await holidayApi.getAllHolidays();
 setHolidays(data);
 } catch (error) {
 console.error("Error fetching holidays:", error);
 } finally {
 setLoading(false);
 }
 };
 fetchHolidays();
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

 const today = new Date();
 today.setHours(0, 0, 0, 0);

 const extractDate = (dateString) => {
 if (!dateString) return new Date();
 const datePart = dateString.split('T')[0];
 if (datePart.includes('-')) {
 const [year, month, day] = datePart.split('-');
 return new Date(year, month - 1, day);
 }
 return new Date(dateString);
 };

 const upcomingHolidays = holidays
 .filter(h => extractDate(h.date) >= today)
 .sort((a, b) => extractDate(a.date) - extractDate(b.date))
 .slice(0, 6);

 const getHolidayIcon = (holidayType) => {
 switch (holidayType.toLowerCase()) {
 case 'religious':
 return <LuMoonStar />;
 case 'national':
 return <BsStars />;
 case 'observance':
 return <FaTree />;
 default:
 return <FiCalendar />;
 }
 };

 const getHolidayColor = (holidayType) => {
 switch (holidayType.toLowerCase()) {
 case 'religious':
 return "bg-orange-100 text-orange-700";
 case 'national':
 return "bg-lime-100 text-lime-700";
 case 'observance':
 return "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400";
 default:
 return "bg-app text-main";
 }
 };

 if (loading) {
 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col w-full">
 <div className="flex items-center gap-2 mb-3">
 <FiCalendar className="w-4 h-4 text-orange-600" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Holidays</h3>
 </div>
 <div className="text-center py-4 text-xs">Loading holidays...</div>
 </div>
 );
 }

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col w-full">
 {/* Header */}
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiCalendar className="w-4 h-4 text-orange-600" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Holidays</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">Upcoming</p>
 </div>

 <div className="relative" ref={menuRef}>
 <button
 onClick={() => setMenuOpen(!menuOpen)}
 className="p-1 rounded-lg hover:bg-app transition"
 >
 <FiMoreVertical className="h-4 w-4 text-muted" />
 </button>
 {menuOpen && (
 <div className="absolute right-0 mt-1 w-32 bg-surface shadow-lg border border-subtle rounded-xl z-50">
 <button
 onClick={() => { onDelete(); setMenuOpen(false); }}
 className="flex items-center w-full px-3 py-2 text-[10px] text-red-500 hover:bg-red-50 dark:bg-red-900/30 font-medium"
 >
 <FiTrash2 className="w-3 h-3 mr-2" />
 Delete Card
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Holiday list */}
<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[150px] w-full">
  {upcomingHolidays.length > 0 ? (
  <ul className="space-y-1.5 text-[10px]">
  {upcomingHolidays.map((holiday, index) => (
  <li
  key={index}
  className="flex items-center bg-[#E0E5EA]/30 rounded-lg p-1.5 gap-2"
  >
  <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${getHolidayColor(holiday.holidayType)}`}>
 {getHolidayIcon(holiday.holidayType)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-main truncate text-[10px]">{holiday.holidayName}</div>
 <div className="text-[9px] text-muted truncate">
 {extractDate(holiday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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

export default HolidaysCard;