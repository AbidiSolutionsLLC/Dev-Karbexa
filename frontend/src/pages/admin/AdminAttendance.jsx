import React, { useState, useEffect, useMemo } from "react";
import api from "../../axios";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
 Download, Calendar, CheckCircle, XCircle, AlertCircle, Clock, X, Edit2, Trash2, Save, Search
} from "lucide-react";
import PageContainer from "../../components/ui/PageContainer";
import TableWithPagination from "../../components/TableWithPagination";
import AdminAddAttendanceModal from "../../components/AdminAddAttendanceModal";
import GlassInput from "../../components/ui/GlassInput";
import ModernSelect from "../../components/ui/ModernSelect";
import FilterRow from "../../components/ui/FilterRow";
import GlassModal from "../../components/ui/GlassModal";

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

 return <span className="text-amber-600 dark:text-amber-400 font-mono font-bold tracking-wider">{duration}</span>;
};

// --- MAIN COMPONENT ---
const AdminAttendance = () => {
  const [summaryData, setSummaryData] = useState({ present: [], absent: [], halfDay: [], onLeave: [], counts: { present: 0, absent: 0, halfDay: 0, onLeave: 0, total: 0 } });
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState("");
 const [deptFilter, setDeptFilter] = useState("all");
const [filterDate, setFilterDate] = useState(() => {
  const savedDate = localStorage.getItem('admin_attendance_date');
  if (savedDate) {
    const parsed = new Date(savedDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
});
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

const fetchSummary = async (date) => {
  if (!date || isNaN(date.getTime())) {
    toast.error("Invalid date selected");
    setLoading(false);
    return;
  }
  setLoading(true);
  try {
  const dateStr = date.toISOString().split('T')[0];
  const res = await api.get(`/timetrackers/admin-summary?date=${dateStr}`);
  setSummaryData(res.data);
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
 if (filterDate) {
 fetchSummary(filterDate);
 }
 }, [filterDate]);

 const canEdit = currentUserRole === 'superadmin';

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
 new Date(log.date || filterDate).toLocaleDateString(),
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
 link.setAttribute("download", `attendance_${activeTab}_report_${filterDate.toISOString().split('T')[0]}.csv`);
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
 date: editingLog.date || filterDate
 });
 toast.success("Attendance record created successfully");
 }
 setIsEditModalOpen(false);
 await fetchSummary(filterDate);
 } catch (error) {
 toast.error(error.response?.data?.message || "Failed to update record");
 }
 };

 const handleDeleteRecord = async (logId) => {
 if (!window.confirm("Delete this attendance record permanently?")) return;
 try {
 await api.delete(`/timetrackers/${logId}`);
 toast.success("Record deleted");
 await fetchSummary(filterDate);
 } catch (error) {
 toast.error(error.response?.data?.message || "Failed to delete record");
 }
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

 const getStatusBadge = (status) => {
 switch (status) {
 case "Present":
 return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"><CheckCircle size={12} /> Present</span>;
 case "Half Day":
 return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"><AlertCircle size={12} /> Half Day</span>;
 case "Absent":
 return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50"><XCircle size={12} /> Absent</span>;
 case "On Leave":
 return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"><Calendar size={12} /> On Leave</span>;
 default:
 return <span className="text-muted text-xs font-bold">{status}</span>;
 }
 };

  const getActiveTabData = () => {
  switch (activeTab) {
  case "present": return summaryData.present.filter(log => log.status !== 'Absent' && log.status !== 'On Leave' && log.status !== 'Leave');
  case "half-day": return summaryData.halfDay;
  case "absent": return summaryData.absent;
  case "leave": return summaryData.onLeave;
  default: return [];
  }
  };

 const activeTabLogs = getActiveTabData().filter((log) => {
 const employeeName = log.user?.name || "Unknown";
 const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase());
 const userDeptName = log.user?.department?.name || log.user?.department || "";
 const matchesDept = deptFilter === "all" || userDeptName === deptFilter;
 return matchesSearch && matchesDept;
 });

 const attendanceColumns = [
 {
 key: "user",
 label: "Employee",
 render: (_, log) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
 {log.user?.name?.charAt(0).toUpperCase() || "?"}
 </div>
 <div>
 <p className="text-sm font-bold text-main">{log.user?.name || "Unknown"}</p>
 <p className="text-[10px] font-bold text-muted uppercase">{log.user?.designation || "Employee"}</p>
 </div>
 </div>
 )
 },
 {
 key: "date",
 label: "Date",
 render: (_, log) => new Date(log.date || filterDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
 },
 ...(activeTab === "present" ? [
 {
 key: "checkInTime",
 label: "Check In",
 render: (_, log) => formatTime(log.checkInTime)
 },
 {
 key: "checkOutTime",
 label: "Check Out",
 render: (_, log) => log.checkOutTime ? (
 <span className="text-sm font-bold text-main">{formatTime(log.checkOutTime)}</span>
 ) : log.checkInTime ? (
 <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-100 uppercase tracking-wider">Active</span>
 ) : (
 <span className="text-muted">--:--</span>
 )
 },
 {
 key: "duration",
 label: "Duration",
 render: (_, log) => log.checkInTime && log.checkOutTime ? (
 <span className="text-muted">{Math.floor(log.totalHours || 0)}h {Math.round(((log.totalHours || 0) - Math.floor(log.totalHours || 0)) * 60)}m</span>
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
                    onClick={(e) => { e.stopPropagation(); if(!isSessionRunning) handleEditClick(log); }} 
                    className={`p-2 rounded-lg transition-all ${isSessionRunning ? 'text-slate-300 cursor-not-allowed' : 'text-muted hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:bg-amber-900/30'}`} 
                    title={isSessionRunning ? "Cannot edit active session" : "Edit Record"}
                    disabled={isSessionRunning}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(log._id); }} className="p-2 text-muted hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded-lg transition-all" title="Delete Record">
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleEditClick(log); }} className="p-2 text-muted hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-900/30 rounded-lg transition-all" title="Add/Update Record">
                  <Edit2 size={16} />
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
 className="btn btn-primary"
 >
 + Check In/Out
 </button>
 )}
 <button
 onClick={handleDownload}
 className="btn btn-secondary flex items-center gap-2"
 >
 <Download size={16} /> Export CSV
 </button>
 </div>
 }
 filters={
 <FilterRow>
 {/* Search */}
 <GlassInput
 placeholder="Search Employee..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="flex-1 min-w-[160px]"
 />

 {/* Date Picker */}
 <div className="flex items-center bg-surface border border-border-subtle rounded-xl px-3 h-[42px]">
 <Calendar size={16} className="text-muted mr-2 flex-shrink-0" />
 <DatePicker
 selected={filterDate}
 onChange={(date) => {
 setFilterDate(date);
 if (date) {
 localStorage.setItem('admin_attendance_date', date.toISOString());
 } else {
 localStorage.removeItem('admin_attendance_date');
 }
 }}
 dateFormat="yyyy-MM-dd"
 className="w-32 bg-transparent border-none text-xs font-semibold text-main outline-none cursor-pointer !py-0 !px-0 !rounded-none !shadow-none"
 placeholderText="Filter by Date"
 />
 </div>

 {/* Department Filter */}
 <div className="min-w-[160px]">
 <ModernSelect
 value={deptFilter}
 onChange={(e) => setDeptFilter(e.target.value)}
 options={departmentOptions}
 placeholder="All Departments"
 />
 </div>
 </FilterRow>
 }
  topWidgets={
  <div className="grid grid-cols-4 gap-0 glass-card p-0 overflow-hidden divide-x divide-slate-100 dark:divide-slate-700/50">
  <div className="px-4 py-4 flex flex-col justify-center text-center bg-blue-50 dark:bg-blue-900/10">
  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">TOTAL</p>
  <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{summaryData.counts.total}</p>
  </div>
  <div
  onClick={() => { setActiveTab("present"); localStorage.setItem('admin_attendance_tab', 'present'); }}
  className={`px-4 py-4 flex flex-col justify-center text-center cursor-pointer transition-all ${activeTab === 'present' ? 'bg-emerald-100 dark:bg-emerald-900/40/50 dark:bg-emerald-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30/30 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20'}`}
  >
  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">PRESENT</p>
  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{summaryData.counts.present}</p>
  </div>
  <div
  onClick={() => { setActiveTab("half-day"); localStorage.setItem('admin_attendance_tab', 'half-day'); }}
  className={`px-4 py-4 flex flex-col justify-center text-center cursor-pointer transition-all ${activeTab === 'half-day' ? 'bg-amber-100 dark:bg-amber-900/40/50 dark:bg-amber-900/30' : 'bg-amber-50 dark:bg-amber-900/30/30 hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20'}`}
  >
  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">HALF DAY</p>
  <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{summaryData.counts.halfDay}</p>
  </div>
  <div
  onClick={() => { setActiveTab("absent"); localStorage.setItem('admin_attendance_tab', 'absent'); }}
  className={`px-4 py-4 flex flex-col justify-center text-center cursor-pointer transition-all ${activeTab === 'absent' ? 'bg-rose-100 dark:bg-rose-900/40/50 dark:bg-rose-900/30' : 'bg-rose-50 dark:bg-rose-900/30/30 hover:bg-rose-50 dark:bg-rose-900/10 dark:hover:bg-rose-900/20'}`}
  >
  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">ABSENT</p>
  <p className="text-2xl font-black text-rose-700 dark:text-rose-400">{summaryData.counts.absent}</p>
  </div>
  <div
  onClick={() => { setActiveTab("leave"); localStorage.setItem('admin_attendance_tab', 'leave'); }}
  className={`px-4 py-4 flex flex-col justify-center text-center cursor-pointer transition-all ${activeTab === 'leave' ? 'bg-amber-100 dark:bg-amber-900/40/50 dark:bg-amber-900/30' : 'bg-amber-50 dark:bg-amber-900/30/30 hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20'}`}
  >
  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">ON LEAVE</p>
  <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{summaryData.counts.onLeave}</p>
  </div>
  </div>
  }
 isCard={false}
 >
  {/* Tab Buttons */}
  <div className="flex gap-2 mb-4">
  {["present", "half-day", "absent", "leave"].map((t) => (
  <button
  key={t}
  onClick={() => {
  setActiveTab(t);
  localStorage.setItem('admin_attendance_tab', t);
  }}
  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
  activeTab === t 
  ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20" 
  : "bg-surface text-muted border-border-subtle hover:border-subtle"
  }`}
  >
  {t === "half-day" ? "Half Day" : t}
  </button>
  ))}
  </div>
 <div className="glass-card p-0 overflow-hidden">
 <TableWithPagination
 columns={attendanceColumns}
 data={activeTabLogs}
 loading={loading}
 emptyMessage="No records found for this category."
 defaultSort={{ key: "date", direction: "desc" }}
 />
 </div>
 </PageContainer>

  {isEditModalOpen && (
    <GlassModal
      isOpen={true}
      onClose={() => setIsEditModalOpen(false)}
      maxWidth="max-w-md"
      title="Edit Attendance"
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={() => setIsEditModalOpen(false)}
            className="flex-1 py-2 text-xs font-bold text-muted hover:text-main uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            className="btn btn-primary flex-1 flex justify-center items-center gap-2"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Check In Time</label>
          <DatePicker
            selected={editFormData.checkInTime}
            onChange={(date) => setEditFormData({ ...editFormData, checkInTime: date })}
            showTimeSelect
            dateFormat="Pp"
            wrapperClassName="w-full"
            className="w-full border border-border-subtle rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-100 outline-none"
            popperProps={{ strategy: "fixed" }}
            portalId="portal-root"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Check Out Time</label>
          <DatePicker
            selected={editFormData.checkOutTime}
            onChange={(date) => setEditFormData({ ...editFormData, checkOutTime: date })}
            showTimeSelect
            dateFormat="Pp"
            wrapperClassName="w-full"
            className="w-full border border-border-subtle rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-100 outline-none"
            popperProps={{ strategy: "fixed" }}
            portalId="portal-root"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Status</label>
          <select
            className="w-full border border-border-subtle rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-100 outline-none bg-surface"
            value={editFormData.status}
            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
          >
        <option value="Present">Present</option>
        <option value="Half Day">Half Day</option>
        <option value="Absent">Absent</option>
        <option value="On Leave">On Leave</option>
      </select>
        </div>
      </div>
    </GlassModal>
  )}

 {/* NEW MODALS */}
 {isAddAttendanceOpen && (
 <AdminAddAttendanceModal
 open={isAddAttendanceOpen}
 onClose={() => setIsAddAttendanceOpen(false)}
 onSuccess={() => fetchSummary(filterDate)}
 allUsers={allUsers}
 />
 )}
 </>
 );
};

export default AdminAttendance;