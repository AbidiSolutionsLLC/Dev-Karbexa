// src/Components/home/FeedsCard.jsx
import React, { useState, useRef, useEffect } from "react";
import { FiActivity, FiMoreVertical, FiTrash2 } from "react-icons/fi";
import api from "../../axios";
import { toast } from "react-toastify";
import EmptyCardState from "./EmptyCardState";
import Loader from "../ui/Loader";

function timeAgo(dateStr) {
 const then = new Date(dateStr);
 if (isNaN(then.getTime())) return "";
 const mins = Math.floor((Date.now() - then.getTime()) / 60000);
 if (mins < 1) return "Just now";
 if (mins < 60) return `${mins}m ago`;
 const hrs = Math.floor(mins / 60);
 if (hrs < 24) return `${hrs}h ago`;
 const days = Math.floor(hrs / 24);
 if (days < 7) return `${days}d ago`;
 return then.toLocaleDateString();
}

const FeedsCard = ({ onDelete }) => {
 const [menuOpen, setMenuOpen] = useState(false);
 const [feeds, setFeeds] = useState([]);
 const [loading, setLoading] = useState(true);
 const menuRef = useRef();

 // Close menu when clicking outside
 useEffect(() => {
 const handler = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 useEffect(() => {
 const fetchFeeds = async () => {
 try {
 const response = await api.get("/notifications", { params: { limit: 6 } });
 const notifications = response.data || [];
 setFeeds(
 notifications.map((n) => ({
 id: n._id,
 message: n.title,
 description: n.message && n.message !== n.title ? n.message : undefined,
 time: timeAgo(n.createdAt),
 }))
 );
 } catch (error) {
 console.error("Failed to fetch feeds:", error);
 toast.error("Failed to load feeds");
 } finally {
 setLoading(false);
 }
 };
 fetchFeeds();
 }, []);

 if (loading) {
 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full w-full flex flex-col">
 <div className="flex items-center gap-2 mb-2">
 <FiActivity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Feeds</h3>
 </div>
 <Loader size="sm" />
 </div>
 );
 }

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col">
 {/* Header */}
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-0.5">
 <FiActivity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Feeds</h3>
 </div>
 <p className="text-[9px] font-medium text-muted">Recent updates for you</p>
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

 {/* Feed list */}
 <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar max-h-[160px]">
 {feeds.length > 0 ? (
 <ul className="space-y-1.5">
 {feeds.map((item) => (
 <li
 key={item.id}
 className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 bg-[#E0E5EA]/30"
 >
 <span className="mt-1 h-2 w-2 rounded-full shrink-0 bg-amber-600 dark:bg-amber-400" />
 <div className="min-w-0 flex-1">
 <div className="text-[10px] font-medium text-main leading-snug break-words">
 {item.message}
 </div>
 {item.description && (
 <div className="text-[9px] text-muted mt-0.5 leading-snug break-words">{item.description}</div>
 )}
 <div className="text-[9px] text-muted mt-1">{item.time}</div>
 </div>
 </li>
 ))}
 </ul>
 ) : (
 <EmptyCardState message="No recent updates" />
 )}
 </div>
 </div>
 );
};

export default FeedsCard;