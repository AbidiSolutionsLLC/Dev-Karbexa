import React, { useState, useEffect, useMemo } from "react";
import api from "../../axios";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Download, CalendarRange, CalendarDays, CheckCircle, XCircle,
  AlertCircle, Clock3, Users, X, Edit2, Trash2, Save, Plus,
  Search, Building2, PieChart, CalendarClock, LogIn, LogOut,
} from "lucide-react";
import PageContainer from "../../components/ui/PageContainer";
import TableWithPagination from "../../components/TableWithPagination";
import AdminAddAttendanceModal from "../../components/AdminAddAttendanceModal";
import GlassInput from "../../components/ui/GlassInput";
import ModernSelect from "../../components/ui/ModernSelect";
import FilterRow from "../../components/ui/FilterRow";
import GlassModal from "../../components/ui/GlassModal";
import DateRangePicker from "../../components/ui/DateRangePicker";

import { dispatchReadOnlyModal } from '../../utils/readOnlyEvent';
import { formatDateForAPI } from "../../utils/dateUtils";
import { useConfirm } from "../../context/ConfirmContext";

// --- THEME ACCENT STYLES (readable in both light & dark) ---
const ACCENT_STYLES = {
  brand: "bg-brand-primary/15 text-brand-text dark:text-brand-primary border-brand-primary/30",
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  info: "bg-info-bg text-info border-info-border",
};

// Solid accent bars used as a top-edge highlight on stat cards
const ACCENT_BARS = {
  brand: "from-brand-primary via-brand-accent to-brand-primary",
  success: "from-success/70 via-success to-success/70",
  warning: "from-warning/70 via-warning to-warning/70",
  danger: "from-danger/70 via-danger to-danger/70",
  info: "from-info/70 via-info to-info/70",
};

// Accent fill for the mini progress bars inside stat cards
const ACCENT_FILLS = {
  brand: "bg-brand-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const STATUS_META = {
  Present: { icon: CheckCircle, chip: "bg-success-bg text-success border-success-border" },
  "Half Day": { icon: AlertCircle, chip: "bg-warning-bg text-warning border-warning-border" },
  Absent: { icon: XCircle, chip: "bg-danger-bg text-danger border-danger-border" },
  "On Leave": { icon: CalendarDays, chip: "bg-info-bg text-info border-info-border" },
};

const STATUS_TABS = [
  { key: "present", label: "Present", icon: CheckCircle, accent: "success" },
  { key: "half-day", label: "Half Day", icon: Clock3, accent: "warning" },
  { key: "absent", label: "Absent", icon: XCircle, accent: "danger" },
  { key: "leave", label: "On Leave", icon: CalendarDays, accent: "info" },
];

// --- SUB-COMPONENT: LIVE TIMER ---
const LiveTimer = ({ startTime }) => {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      if (diff < 0) return setDuration("00:00:00");

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

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-warning bg-warning-bg border border-warning-border px-2 py-1 rounded-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {duration}
    </span>
  );
};

// --- SUB-COMPONENT: ACTIVE SESSION BADGE ---
const ActiveBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-warning-bg text-warning border border-warning-border">
    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
    Active
  </span>
);

// --- MAIN COMPONENT ---
const AdminAttendance = () => {
  const confirm = useConfirm();
  const [summaryData, setSummaryData] = useState({ present: [], absent: [], halfDay: [], onLeave: [], counts: { present: 0, absent: 0, halfDay: 0, onLeave: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dateFilterType, setDateFilterType] = useState(() => {
    return localStorage.getItem('admin_attendance_filter_type') || "Today";
  });
  const [customDateRange, setCustomDateRange] = useState(() => {
    const savedStart = localStorage.getItem('admin_attendance_start');
    const savedEnd = localStorage.getItem('admin_attendance_end');
    if (savedStart && savedEnd) {
      const parsedStart = new Date(savedStart);
      const parsedEnd = new Date(savedEnd);
      if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) return [parsedStart, parsedEnd];
    }
    const today = new Date();
    return [today, today];
  });

  const { derivedStart, derivedEnd } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilterType) {
      case "Today":
        return { derivedStart: today, derivedEnd: today };
      case "Yesterday": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { derivedStart: yesterday, derivedEnd: yesterday };
      }
      case "Last 7 Days": {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        return { derivedStart: last7, derivedEnd: today };
      }
      case "This Month": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { derivedStart: firstDay, derivedEnd: today };
      }
      case "Custom":
        return { derivedStart: customDateRange[0], derivedEnd: customDateRange[1] };
      default:
        return { derivedStart: today, derivedEnd: today };
    }
  }, [dateFilterType, customDateRange]);

  const startDate = derivedStart;
  const endDate = derivedEnd;
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('admin_attendance_tab');
    const validTabs = ['present', 'half-day', 'absent', 'leave'];
    return (savedTab && validTabs.includes(savedTab)) ? savedTab : "present";
  });
  const [allUsers, setAllUsers] = useState([]);
  const [isAddAttendanceOpen, setIsAddAttendanceOpen] = useState(false);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editFormData, setEditFormData] = useState({ checkInTime: null, checkOutTime: null, status: "" });

  // Permission State
  const [currentUserRole, setCurrentUserRole] = useState("");
  const canEdit = currentUserRole === 'superadmin' || currentUserRole === 'globalreader';

  const fetchSummary = async (start, end) => {
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return;
    }
    setLoading(true);
    try {
      const startStr = formatDateForAPI(start);
      const endStr = formatDateForAPI(end);
      const res = await api.get(`/timetrackers/admin-summary?startDate=${startStr}&endDate=${endStr}`);
      const data = res.data.data || res.data;

      const safeData = {
        present: data?.present || [],
        absent: data?.absent || [],
        halfDay: data?.halfDay || [],
        onLeave: data?.onLeave || [],
        counts: data?.counts || { present: 0, absent: 0, halfDay: 0, onLeave: 0, total: 0 }
      };

      setSummaryData(safeData);
    } catch (error) {
      console.error("Fetch Summary Error:", error);
      toast.error("Failed to load attendance summary");
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH USER INFO ON MOUNT ---
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userRes = await api.get("/auth/me");
        const role = userRes.data.user.role || "";
        const processedRole = role.replace(/\s+/g, '').toLowerCase();
        setCurrentUserRole(processedRole);

        if (processedRole === 'superadmin' || processedRole === 'admin') {
          const allUsersRes = await api.get("/users");
          setAllUsers(Array.isArray(allUsersRes.data) ? allUsersRes.data : allUsersRes.data.data || []);
        }
      } catch (error) {
        console.error("User Init Error:", error);
      }
    };
    fetchUserInfo();
  }, []);

  // --- FETCH SUMMARY ON DATE CHANGE ---
  useEffect(() => {
    if (startDate && endDate) {
      fetchSummary(startDate, endDate);
    }
  }, [startDate, endDate]);

  // --- DERIVE UNIQUE DEPARTMENTS ---
  const departmentOptions = useMemo(() => {
    const depts = new Set();
    allUsers.forEach(u => {
      const deptName = u.department?.name || u.department;
      if (deptName) depts.add(deptName);
    });
    return [
      { value: "all", label: "All Departments" },
      ...[...depts].sort().map(d => ({ value: d, label: d })),
    ];
  }, [allUsers]);

  // --- DOWNLOAD EXCEL (CSV) ---
  const handleDownload = () => {
    const dataToExport = activeTabLogs;
    if (dataToExport.length === 0) {
      toast.warn("No data to download");
      return;
    }

    const isPresentTab = activeTab === "present";
    const headers = isPresentTab
      ? ["Employee Name", "Email", "Date", "Check In", "Check Out", "Total Hours", "Status"]
      : ["Employee Name", "Email", "Date", "Status"];

    const rows = dataToExport.map(log => {
      const base = [
        `"${log.user?.name || 'Unknown'}"`,
        `"${log.user?.email || 'N/A'}"`,
        new Date(log.date || startDate).toLocaleDateString(),
        log.status
      ];
      if (isPresentTab) {
        return [
          base[0], base[1], base[2],
          log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString() : "--",
          log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString() : "Active",
          log.totalHours || "--",
          base[3]
        ];
      }
      return base;
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${activeTab}_report_${formatDateForAPI(startDate)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- EDIT HANDLERS ---
  const handleEditClick = (log) => {
    setEditingLog(log);
    setEditFormData({
      checkInTime: log.checkInTime ? new Date(log.checkInTime) : null,
      checkOutTime: log.checkOutTime ? new Date(log.checkOutTime) : null,
      status: log.status
    });
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async () => {
    try {
      let updates = { ...editFormData };

      // VALIDATION
      // Auto-clear times for Absent/Leave
      if (updates.status === 'Absent' || updates.status === 'On Leave' || updates.status === 'Leave') {
        updates.checkInTime = null;
        updates.checkOutTime = null;
        updates.totalHours = 0;
      } else {
        const now = new Date();
        if (updates.checkInTime && new Date(updates.checkInTime) > now) {
          return toast.error("Check-in time cannot be in the future");
        }
        if (updates.checkOutTime && new Date(updates.checkOutTime) > now) {
          return toast.error("Check-out time cannot be in the future");
        }

        if (updates.checkInTime && updates.checkOutTime) {
          if (new Date(updates.checkOutTime) <= new Date(updates.checkInTime)) {
            return toast.error("Check-out cannot be before check-in");
          }
        }
        if (!updates.checkInTime && updates.checkOutTime) {
          return toast.error("Check-in is required if check-out is provided");
        }
      }

      // Auto-calc duration if times changed
      if (updates.checkInTime && updates.checkOutTime) {
        const start = new Date(updates.checkInTime);
        const end = new Date(updates.checkOutTime);
        const diffMs = end - start;
        const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        updates.totalHours = totalHours;
      }

      if (editingLog._id) {
        await api.put(`/timetrackers/${editingLog._id}`, updates);
        toast.success("Attendance updated successfully");
      } else {
        await api.post("/timetrackers", {
          user: editingLog.user?._id,
          checkInTime: updates.checkInTime,
          checkOutTime: updates.checkOutTime,
          status: updates.status,
          totalHours: updates.totalHours,
          date: editingLog.date || startDate
        });
        toast.success("Attendance record created successfully");
      }
      setIsEditModalOpen(false);
      await fetchSummary(startDate);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update record");
    }
  };

  const handleDeleteRecord = async (logId) => {
    if (currentUserRole === 'globalreader') {
      dispatchReadOnlyModal();
      return;
    }
    await confirm({
      title: "Delete Record",
      message: "Delete this attendance record permanently?",
      onConfirmAction: async () => {
        try {
          await api.delete(`/timetrackers/${logId}`);
          toast.success("Record deleted");
          await fetchSummary(startDate);
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to delete record");
          throw error;
        }
      }
    });
  };

  // --- HELPERS ---
  const formatTime = (isoString) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (hours) => {
    const h = Math.floor(hours || 0);
    const m = Math.round(((hours || 0) - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatRangeLabel = () => {
    if (!startDate || !endDate) return "";
    const opts = { month: "short", day: "numeric", year: "numeric" };
    const a = startDate.toLocaleDateString("en-US", opts);
    const b = endDate.toLocaleDateString("en-US", opts);
    return a === b ? a : `${a} — ${b}`;
  };

  const getStatusBadge = (status) => {
    const meta = STATUS_META[status];
    if (!meta) return <span className="text-muted text-xs font-bold">{status}</span>;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border shadow-sm ${meta.chip}`}>
        <Icon size={12} strokeWidth={2.5} />
        {status}
      </span>
    );
  };

  const getActiveTabData = () => {
    switch (activeTab) {
      case "present": return (summaryData.present || []).filter(log => log.status !== 'Absent' && log.status !== 'On Leave' && log.status !== 'Leave');
      case "half-day": return summaryData.halfDay || [];
      case "absent": return summaryData.absent || [];
      case "leave": return summaryData.onLeave || [];
      default: return [];
    }
  };

  const activeTabLogs = getActiveTabData().filter((log) => {
    const employeeName = log.user?.name || "Unknown";
    const matchesSearch = String(employeeName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const userDeptName = log.user?.department?.name || log.user?.department || "";
    const matchesDept = deptFilter === "all" || userDeptName === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    localStorage.setItem('admin_attendance_tab', tabKey);
  };

  const getTabCount = (key) => {
    switch (key) {
      case "present": return summaryData.counts.present;
      case "half-day": return summaryData.counts.halfDay;
      case "absent": return summaryData.counts.absent;
      case "leave": return summaryData.counts.onLeave;
      default: return summaryData.counts.total;
    }
  };

  const activeTabMeta = STATUS_TABS.find(t => t.key === activeTab) || { label: "Records", icon: Users, accent: "brand" };

  const overviewCards = [
    { key: null, label: "Total Records", count: summaryData.counts.total, icon: Users, accent: "brand" },
    { key: "present", label: "Present", count: summaryData.counts.present, icon: CheckCircle, accent: "success" },
    { key: "half-day", label: "Half Day", count: summaryData.counts.halfDay, icon: Clock3, accent: "warning" },
    { key: "absent", label: "Absent", count: summaryData.counts.absent, icon: XCircle, accent: "danger" },
    { key: "leave", label: "On Leave", count: summaryData.counts.onLeave, icon: CalendarDays, accent: "info" },
  ];

  const getCardPercent = (count) => {
    const total = summaryData.counts.total || 0;
    if (!total) return 0;
    return Math.min(100, Math.round((count / total) * 100));
  };

  const attendanceColumns = [
    {
      key: "user",
      label: "Employee",
      render: (_, log) => (
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary/30 via-brand-sec/40 to-brand-accent/30 text-brand-text dark:text-brand-primary flex items-center justify-center text-sm font-black shadow-sm border border-brand-primary/30">
              {log.user?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-heading truncate">{log.user?.name || "Unknown"}</p>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              {log.user?.designation || "Employee"}
              {log.user?.department?.name ? <span className="text-brand-text dark:text-brand-primary"> • {log.user.department.name}</span> : null}
            </p>
          </div>
        </div>
      )
    },
    {
      key: "date",
      label: "Date",
      render: (_, log) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-main">
          <CalendarDays size={12} className="text-muted" />
          {new Date(log.date || startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )
    },
    ...(activeTab === "present" ? [
      {
        key: "checkInTime",
        label: "Check In",
        render: (_, log) => log.checkInTime ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-success bg-success-bg border border-success-border px-2 py-1 rounded-lg">
            <LogIn size={12} strokeWidth={2.5} />
            {formatTime(log.checkInTime)}
          </span>
        ) : (
          <span className="text-muted text-xs">--:--</span>
        )
      },
      {
        key: "checkOutTime",
        label: "Check Out",
        render: (_, log) => log.checkOutTime ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-info bg-info-bg border border-info-border px-2 py-1 rounded-lg">
            <LogOut size={12} strokeWidth={2.5} />
            {formatTime(log.checkOutTime)}
          </span>
        ) : log.checkInTime ? (
          <ActiveBadge />
        ) : (
          <span className="text-muted text-xs">--:--</span>
        )
      },
      {
        key: "duration",
        label: "Duration",
        render: (_, log) => log.checkInTime && log.checkOutTime ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-heading bg-card border border-border-subtle px-2 py-1 rounded-lg">
            {formatDuration(log.totalHours)}
          </span>
        ) : (
          log.checkInTime ? <LiveTimer startTime={log.checkInTime} /> : <span className="text-muted text-xs italic">N/A</span>
        )
      }
    ] : []),
    {
      key: "status",
      label: "Status",
      render: (_, log) => getStatusBadge(log.status)
    },
    ...(canEdit ? [
      {
        key: "actions",
        label: "Actions",
        align: "right",
        render: (_, log) => {
          const isSessionRunning = log.checkInTime && !log.checkOutTime;
          return (
            <div className="flex justify-end gap-1">
              {log._id ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!isSessionRunning) handleEditClick(log); }}
                    className={`p-2 rounded-lg border border-transparent transition-all ${isSessionRunning ? 'text-muted/40 cursor-not-allowed bg-neutral-bg' : 'text-muted hover:text-brand-text hover:bg-brand-primary/10 hover:border-brand-primary/30'}`}
                    title={isSessionRunning ? "Cannot edit active session" : "Edit Record"}
                    disabled={isSessionRunning}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(log._id); }} className="p-2 rounded-lg border border-transparent text-muted hover:text-danger hover:bg-danger-bg hover:border-danger-border transition-all" title="Delete Record">
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleEditClick(log); }} className="p-2 rounded-lg border border-transparent text-muted hover:text-success hover:bg-success-bg hover:border-success-border transition-all" title="Add/Update Record">
                  <Edit2 size={15} />
                </button>
              )}
            </div>
          );
        }
      }
    ] : [])
  ];

  return (
    <>
      <PageContainer
        title="Employee Attendance"
        subtitle="Monitor daily check-ins, check-outs, and working hours."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setIsAddAttendanceOpen(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} strokeWidth={2.5} /> Check In/Out
              </button>
            )}
            <button
              onClick={handleDownload}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <Download size={16} strokeWidth={2.5} /> Export CSV
            </button>
          </div>
        }
        filters={
          <FilterRow className="!items-end">
            {/* Search */}
            <div className="flex flex-col gap-1.5 w-full sm:flex-1 sm:max-w-xs">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
                <Search size={11} strokeWidth={2.5} className="text-brand-text dark:text-brand-primary" /> Search
              </label>
              <GlassInput
                placeholder="Search employee name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!w-full"
              />
            </div>

            {/* Date Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
                <CalendarRange size={11} strokeWidth={2.5} className="text-brand-text dark:text-brand-primary" /> Date Range
              </label>
              <div className="flex gap-2 flex-wrap !items-end">
                <div className="min-w-[150px]">
                  <ModernSelect
                    value={dateFilterType}
                    onChange={(e) => {
                      setDateFilterType(e.target.value);
                      localStorage.setItem('admin_attendance_filter_type', e.target.value);
                    }}
                    options={[
                      { value: "Today", label: "Today" },
                      { value: "Yesterday", label: "Yesterday" },
                      { value: "Last 7 Days", label: "Last 7 Days" },
                      { value: "This Month", label: "This Month" },
                      { value: "Custom", label: "Custom Range" }
                    ]}
                    placeholder="Select Date"
                  />
                </div>

                {dateFilterType === "Custom" && (
                  <DateRangePicker
                    startDate={customDateRange[0]}
                    endDate={customDateRange[1]}
                    onChange={(update) => {
                      setCustomDateRange(update);
                      if (update[0]) localStorage.setItem('admin_attendance_start', update[0].toISOString());
                      else localStorage.removeItem('admin_attendance_start');

                      if (update[1]) localStorage.setItem('admin_attendance_end', update[1].toISOString());
                      else localStorage.removeItem('admin_attendance_end');
                    }}
                    className="w-56"
                  />
                )}
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
                <Building2 size={11} strokeWidth={2.5} className="text-brand-text dark:text-brand-primary" /> Department
              </label>
              <ModernSelect
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                options={departmentOptions}
                placeholder="All Departments"
              />
            </div>

            {/* Clear Filters */}
            {(searchTerm || deptFilter !== "all" || dateFilterType !== "Today") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setDeptFilter("all");
                  setDateFilterType("Today");
                  localStorage.setItem('admin_attendance_filter_type', 'Today');
                }}
                className="btn btn-secondary h-[42px] px-3 inline-flex items-center gap-1 text-xs"
              >
                <X size={14} /> Clear
              </button>
            )}
          </FilterRow>
        }
        topWidgets={
          <div className="space-y-3">
            {/* Overview header row */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-brand-primary/15 border border-brand-primary/30 text-brand-text dark:text-brand-primary">
                  <PieChart size={14} strokeWidth={2.5} />
                </span>
                <p className="text-xs font-black uppercase tracking-widest text-heading">Attendance Overview</p>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted border border-border-subtle bg-surface px-2 py-1 rounded-lg">
                  {summaryData.counts.total} total records
                </span>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {overviewCards.map((card, idx) => {
                const isActive = card.key ? activeTab === card.key : false;
                const percent = getCardPercent(card.count);
                return (
                  <div
                    key={card.key || "total"}
                    onClick={() => { if (card.key) handleTabSelect(card.key); }}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={`group relative overflow-hidden rounded-2xl border p-4 animate-slideInUp [animation-fill-mode:backwards] transition-all duration-200 ${card.key ? 'cursor-pointer' : ''} ${isActive
                      ? 'border-brand-primary/50 ring-2 ring-brand-primary/20 shadow-lg shadow-brand-primary/10 bg-gradient-to-br from-brand-primary/15 via-brand/5 to-transparent'
                      : 'bg-surface border-border-subtle hover:border-brand-primary/40 hover:shadow-md'}`}
                  >
                    {/* Top accent bar */}
                    <span className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r opacity-70 ${isActive ? 'opacity-100' : ''} ${ACCENT_BARS[card.accent]}`} />

                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border shadow-sm transition-transform duration-200 group-hover:scale-105 ${ACCENT_STYLES[card.accent]}`}>
                        <card.icon size={19} strokeWidth={2.4} />
                      </div>
                      {card.key && (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md transition-colors ${isActive ? 'bg-brand-primary text-on-brand' : 'text-muted opacity-0 group-hover:opacity-100'}`}>
                          View
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl font-black text-heading leading-none">{card.count}</p>
                        <p className="text-[10px] font-black text-muted leading-none">{percent}%</p>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted mt-1.5 truncate">{card.label}</p>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-card border border-border-subtle overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${ACCENT_FILLS[card.accent]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
        isCard={false}
      >
        {/* Tab Buttons — segmented control */}
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 mb-4 rounded-2xl bg-surface border border-border-subtle shadow-sm">
          {STATUS_TABS.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTabSelect(t.key)}
                aria-pressed={isActive}
                className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-brand-primary to-brand-accent text-on-brand shadow-md shadow-brand-primary/25"
                    : "text-muted hover:text-heading hover:bg-card-hover"
                }`}
              >
                <t.icon size={14} strokeWidth={2.5} />
                {t.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded-full text-[10px] font-black transition-colors ${
                    isActive
                      ? "bg-black/20 text-on-brand"
                      : "bg-card text-muted border border-border-subtle"
                  }`}
                >
                  {getTabCount(t.key)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="glass-card !p-0 overflow-hidden animate-fadeIn">
          {/* Table toolbar */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border-subtle bg-card">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border shadow-sm ${ACCENT_STYLES[activeTabMeta.accent]}`}>
                <activeTabMeta.icon size={16} strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-heading leading-none">
                  {activeTabMeta.label}
                </p>
                <p className="text-[10px] font-semibold text-muted mt-1">
                  {activeTabLogs.length} record{activeTabLogs.length === 1 ? "" : "s"} matching current filters
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text dark:text-brand-primary bg-brand-primary/10 border border-brand-primary/25 px-2.5 py-1.5 rounded-lg">
              <CalendarClock size={12} strokeWidth={2.5} />
              {formatRangeLabel() || "Select range"}
            </span>
          </div>

          <div className="[&>div]:!rounded-none [&>div]:!border-0 [&>div]:shadow-none">
            <TableWithPagination
              columns={attendanceColumns}
              data={activeTabLogs}
              loading={loading}
              emptyMessage="No records found for this category."
              defaultSort={{ key: "date", direction: "desc" }}
            />
          </div>
        </div>
      </PageContainer>

      {isEditModalOpen && (
        <GlassModal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          maxWidth="max-w-md"
          title="Edit Attendance"
          description="Adjust the check-in / check-out times or change the status for this record."
          footer={
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                className="btn btn-primary flex-1 inline-flex justify-center items-center gap-2"
              >
                <Save size={14} /> Save Changes
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 block text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                <LogIn size={11} strokeWidth={2.5} className="text-success" /> Check In Time
              </label>
              <DatePicker
                selected={editFormData.checkInTime}
                onChange={(date) => setEditFormData({ ...editFormData, checkInTime: date })}
                showTimeSelect
                dateFormat="Pp"
                wrapperClassName="w-full"
                className="glass-input w-full cursor-pointer"
                popperProps={{ strategy: "fixed" }}
                portalId="portal-root"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 block text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                <LogOut size={11} strokeWidth={2.5} className="text-info" /> Check Out Time
              </label>
              <DatePicker
                selected={editFormData.checkOutTime}
                onChange={(date) => setEditFormData({ ...editFormData, checkOutTime: date })}
                showTimeSelect
                dateFormat="Pp"
                wrapperClassName="w-full"
                className="glass-input w-full cursor-pointer"
                popperProps={{ strategy: "fixed" }}
                portalId="portal-root"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 block text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                <AlertCircle size={11} strokeWidth={2.5} className="text-brand-text dark:text-brand-primary" /> Status
              </label>
              <div className="relative">
                <select
                  className="glass-input w-full cursor-pointer appearance-none pr-10"
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                >
                  <option value="Present">Present</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  <Clock3 size={14} />
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-card px-3 py-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">Current selection</span>
                {getStatusBadge(editFormData.status)}
              </div>
            </div>
          </div>
        </GlassModal>
      )}

      {/* NEW MODALS */}
      {isAddAttendanceOpen && (
        <AdminAddAttendanceModal
          open={isAddAttendanceOpen}
          onClose={() => setIsAddAttendanceOpen(false)}
          onSuccess={() => fetchSummary(startDate)}
          allUsers={allUsers}
        />
      )}
    </>
  );
};

export default AdminAttendance;