// src/Components/home/LeaveLogCard.jsx
import React, { useState, useRef, useEffect } from "react";
import { FiMoreVertical, FiTrash2 } from "react-icons/fi";
import { FaUmbrellaBeach as BeachIcon } from "react-icons/fa";
import { useSelector } from "react-redux";
import api from "../../axios";
import EmptyCardState from "./EmptyCardState";
import Loader from "../ui/Loader";
import { formatDisplayDate } from "../../utils/dateUtils";

const LeaveLogCard = ({ onDelete }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const [leaveLogs, setLeaveLogs] = useState([]);
 const [loading, setLoading] = useState(true);
 const menuRef = useRef();
 const { user } = useSelector((state) => state.auth);
 const userId = user?.user?._id;

 useEffect(() => {
 const fetchLeaveLogs = async () => {
 try {
 const response = await api.get("/leaves", { params: { my: true, limit: 10 } });
 const allLeaves = response.data || [];

 const userLeaves = allLeaves
 .map((item) => ({
 name: item.employeeName,
 date: formatDisplayDate(item.startDate, { month: "short", day: "numeric", year: "numeric" }),
 type: item.leaveType,
 status: item.status || "Pending",
 }))
 .slice(0, 6);

 setLeaveLogs(userLeaves);
 } catch (error) {
 console.error("Failed to fetch leave logs:", error);
 } finally {
 setLoading(false);
 }
 };

 fetchLeaveLogs();

 const interval = setInterval(fetchLeaveLogs, 30000);
 window.addEventListener("focus", fetchLeaveLogs);
 return () => {
 clearInterval(interval);
 window.removeEventListener("focus", fetchLeaveLogs);
 };
 }, [userId]);

 useEffect(() => {
 const handler = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 // Loading State
 if (loading) {
 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full w-full flex flex-col">
 <div className="flex items-center gap-2 mb-2">
 <BeachIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Leave Logs</h3>
 </div>
 <Loader size="sm" />
 </div>
 );
 }

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-0.5">
 <BeachIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Leave Logs</h3>
 </div>
 <p className="text-[9px] font-medium text-muted">Track your leave history</p>
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

 <div className="flex-1 min-h-0 overflow-y-auto pr-1 max-h-[150px] custom-scrollbar">
 {leaveLogs.length > 0 ? (
 <ul className="space-y-2">
 {leaveLogs.map((log, index) => (
 <li
 key={index}
 className="bg-[#E0E5EA]/30 rounded-lg p-2 flex justify-between items-center"
 >
 <div className="flex flex-col">
 <span className="font-semibold text-[10px] text-main">{log.name}</span>
 <span className="text-[9px] text-muted">{log.date}</span>
 </div>
 <div className="flex flex-col text-right text-[9px]">
 <span className="font-medium text-main">{log.type}</span>
 <span className={`font-medium ${
 log.status === "Approved" ? "text-green-600 dark:text-green-400" : 
 log.status === "Rejected" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
 }`}
 >
 {log.status}
 </span>
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

export default LeaveLogCard;