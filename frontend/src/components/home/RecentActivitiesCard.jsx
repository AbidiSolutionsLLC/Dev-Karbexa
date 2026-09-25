// ========== RecentActivitiesCard.jsx ==========
import React, { useState, useRef, useEffect } from "react";
import { FiMoreVertical, FiTrash2, FiClock } from "react-icons/fi";
import api from "../../axios";
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

const levelStyles = {
  success: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400",
  warning: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
  error: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  info: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400",
};

const RecentActivitiesCard = ({ onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef();

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
    const fetchActivities = async () => {
      try {
        const response = await api.get("/activities", { params: { limit: 8 } });
        const list = response.data || [];
        setActivities(
          list.map((item) => ({
            id: item._id,
            user: item.user?.name || "Team member",
            action: item.action,
            time: timeAgo(item.createdAt),
            color: levelStyles[item.level] || levelStyles.info,
            avatar: item.user?.avatar,
            entityId: item.entityId,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch activities:", error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    window.addEventListener("focus", fetchActivities);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchActivities);
    };
  }, []);

  if (loading) {
    return (
      <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <FiClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-bold text-main uppercase tracking-tight">Recent Activities</h3>
        </div>
        <Loader size="sm" />
      </div>
    );
  }

  return (
    <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FiClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-main uppercase tracking-tight">Recent Activities</h3>
          </div>
          <p className="text-[10px] font-medium text-muted">
            Logs of team actions & updates
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

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[160px] w-full">
        {activities.length > 0 ? (
          <ul className="space-y-1.5 text-[10px]">
            {activities.map((item) => {
              const initials = (item.user || "?")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <li
                  key={item.id}
                  className={`${item.color} px-2.5 py-1.5 rounded-lg flex items-start gap-2`}
                >
                  <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full font-bold bg-surface border border-subtle text-[10px] overflow-hidden">
                    {item.avatar ? (
                      <img src={item.avatar} alt={item.user} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
<div className="min-w-0">
                  <p className="font-medium text-main break-words">
                    <span className="font-semibold">{item.user}</span>{" "}
                    <span>{item.action || "performed an action"}</span>
                  </p>
                  <span className="text-[9px] text-muted">{item.time}</span>
                </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyCardState message="No recent activity yet" />
        )}
      </div>
    </div>
  );
};

export default RecentActivitiesCard;