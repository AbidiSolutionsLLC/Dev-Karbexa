import React, { useState, useEffect, useRef } from "react";
import { GoGraph } from "react-icons/go";
import { FiMoreVertical, FiTrash2 } from "react-icons/fi";
import api from "../../axios";
import { toast } from "react-toastify";
import EmptyCardState from "./EmptyCardState";
import Loader from "../ui/Loader";

const LiveTimer = ({ startTime }) => {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const diff = Math.max(0, new Date().getTime() - start);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setDuration(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{duration}</span>;
};

const AttendanceCard = ({ onDelete }) => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const maxBarHeight = 70;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  const getWeekStartDate = () => {
    const today = new Date();
    const start = new Date(today);
    const dayOfWeek = start.getDay();
    const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const processWeeklyData = (attendanceData, weekStart) => {
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      currentDay.setHours(0, 0, 0, 0);

      const dayData = (attendanceData || []).find((d) => {
        const recordDate = new Date(d.date);
        return (
          recordDate.getUTCFullYear() === currentDay.getFullYear() &&
          recordDate.getUTCMonth() === currentDay.getMonth() &&
          recordDate.getUTCDate() === currentDay.getDate()
        );
      });

      let hours = 0;
      let status = currentDay > now ? "Upcoming" : "Absent";
      let checkInTime = null;
      let checkOutTime = null;

      if (dayData) {
        status = dayData.status || status;
        checkInTime = dayData.checkInTime;
        checkOutTime = dayData.checkOutTime;

        if (dayData.totalHours) {
          hours = dayData.totalHours;
        } else if (dayData.checkInTime && dayData.checkOutTime) {
          const checkIn = new Date(dayData.checkInTime);
          const checkOut = new Date(dayData.checkOutTime);
          const diffMs = checkOut - checkIn;
          hours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        } else if (dayData.checkInTime && !dayData.checkOutTime) {
          const checkIn = new Date(dayData.checkInTime);
          const diffMs = new Date() - checkIn;
          hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
        } else if (dayData.status === "Present") {
          hours = 8;
        } else if (dayData.status === "Half Day") {
          hours = 4;
        }
      }

      days.push({
        day: currentDay.toLocaleDateString("en-US", { weekday: "short" }),
        hours,
        date: currentDay.getDate(),
        status,
        checkInTime,
        checkOutTime,
      });
    }

    setWeeklyData(days);
  };

  useEffect(() => {
    const fetchWeeklyData = async (weekStart) => {
      try {
        setLoading(true);
        setError(null);

        const startMonth = weekStart.getMonth() + 1;
        const startYear = weekStart.getFullYear();

        const endDate = new Date(weekStart);
        endDate.setDate(endDate.getDate() + 6);
        const endMonth = endDate.getMonth() + 1;
        const endYear = endDate.getFullYear();

        const response1 = await api.get(`/timetrackers/attendance/${startMonth}/${startYear}`);
        let allData = Array.isArray(response1.data) ? response1.data : response1.data?.data || [];

        // If the week spans two months, fetch the second month and combine
        if (startMonth !== endMonth || startYear !== endYear) {
          const response2 = await api.get(`/timetrackers/attendance/${endMonth}/${endYear}`);
          const data2 = Array.isArray(response2.data) ? response2.data : response2.data?.data || [];
          allData = [...allData, ...data2];
        }

        processWeeklyData(allData, weekStart);
      } catch (error) {
        console.error("Error fetching attendance:", error);
        toast.error("Failed to load attendance data");
        setError("Failed to load attendance data");
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyData(getWeekStartDate());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalHours = weeklyData.reduce((sum, val) => sum + val.hours, 0);

  return (
    <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GoGraph className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-main uppercase tracking-tight">Weekly Attendance</h3>
          </div>
          <p className="text-[10px] font-medium text-muted">{totalHours} total hours</p>
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

      {/* Bar Chart */}
      <div className="bg-[#E0E5EA]/30 rounded-xl p-2 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader size="sm" />
          </div>
        ) : error ? (
          <EmptyCardState message={error} />
        ) : weeklyData.length > 0 ? (
          <div className="flex items-end justify-between h-24 gap-1.5 pt-2">
            {weeklyData.map(({ day, hours, status, checkInTime, checkOutTime }, i) => {
              let color = "bg-slate-300";
              if (status === "Absent") color = "bg-red-500";
              else if (status === "Present" && hours >= 7) color = "bg-green-500";
              else if (status === "Half Day") color = "bg-yellow-500";
              else if (status === "Present") color = "bg-amber-400";
              else if (status === "Upcoming") color = "bg-slate-300";
              else if (status === "Holiday") color = "bg-blue-400";
              else if (status === "Leave") color = "bg-purple-400";
              else if (status === "Weekend") color = "bg-slate-200 dark:bg-slate-700";

              const barHeight = Math.min((hours / 10) * maxBarHeight, maxBarHeight);

              return (
                <div key={i} className="flex flex-col items-center justify-end flex-1">
                  <div
                    className={`w-2 ${color} rounded transition-all duration-300`}
                    style={{ height: `${Math.max(barHeight, status === "Upcoming" ? 2 : 4)}px` }}
                  ></div>
                  <div className="mt-1 text-center leading-tight">
                    <span className="block text-[9px] font-semibold text-main mb-0.5">
                      {day}
                    </span>
                    <span className="block text-[8px] text-muted whitespace-nowrap">
                      {status === "Upcoming" ? "-" :
                        (checkInTime && !checkOutTime) ? <LiveTimer startTime={checkInTime} /> :
                        (checkInTime && checkOutTime) ? `${Math.floor(hours)}h ${Math.round((hours - Math.floor(hours)) * 60)}m` :
                        status === "Absent" ? "Absent" :
                        `${hours}h`
                      }
                    </span>
                    {checkInTime && (
                      <span className="block text-[7px] text-amber-600 dark:text-amber-400 mt-0.5 whitespace-nowrap">
                        {new Date(checkInTime).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyCardState message="You haven't added anything yet" />
        )}
      </div>
    </div>
  );
};

export default AttendanceCard;