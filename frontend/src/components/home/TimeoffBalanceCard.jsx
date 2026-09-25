// ========== TimeoffBalanceCard.jsx ==========
import React, { useState, useRef, useEffect } from "react";
import { FiMoreVertical, FiTrash2, FiCalendar } from "react-icons/fi";
import api from "../../axios";
import EmptyCardState from "./EmptyCardState";
import Loader from "../ui/Loader";

const TimeoffBalanceCard = ({ onDelete, userId }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const [timeOffData, setTimeOffData] = useState([]);
 const [loading, setLoading] = useState(true);
 const menuRef = useRef();

useEffect(() => {
  const fetchLeaves = async () => {
  if (!userId) {
  setLoading(false);
  return;
  }
  try {
  const response = await api.get(`/users/${userId}/leaves`);
  const leaves = response.data?.data || response.data || {};

  const items = [
  {
  type: "Paid Time Off (PTO)",
  remaining: `${leaves.pto ?? 0} days`,
  },
  {
  type: "Sick Leave",
  remaining: `${leaves.sick ?? 0} days`,
  },
  ];

  if (leaves.majlis != null) {
  items.push({
  type: "Majlis Leave",
  remaining: `${leaves.majlis} days`,
  });
  }

  if (leaves.avalaibleLeaves != null) {
  items.push({
  type: "Total Available",
  remaining: `${leaves.avalaibleLeaves} days`,
  });
  }

  setTimeOffData(items);
  } catch (error) {
  console.error("Error fetching leaves:", error);
  setTimeOffData([]);
  } finally {
  setLoading(false);
  }
  };

  fetchLeaves();
  }, [userId]);

 useEffect(() => {
 const handleClickOutside = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 if (loading) {
 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col w-full">
 <div className="flex items-center gap-2 mb-3">
 <FiCalendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Available Leaves</h3>
 </div>
 <Loader size="sm" />
 </div>
 );
 }

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col w-full">
 {/* Header */}
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiCalendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Available Leaves</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">
 Updated leave availability
 </p>
 </div>

 {/* 3-dot Menu */}
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

 {/* Leave types list */}
<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[150px] w-full">
  {timeOffData.length > 0 ? (
  <ul className="space-y-1.5 text-[10px]">
  {timeOffData.map((item, index) => (
  <li
  key={index}
  className="bg-[#E0E5EA]/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
  >
 <div className="min-w-0 flex-1">
 <span className="font-medium text-main">{item.type}</span>
 <div className="text-[9px] text-muted">{item.remaining}</div>
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

export default TimeoffBalanceCard;
