import React, { useState, useEffect } from "react";
import { Clock, Plus, Check, Search, UserPlus } from "lucide-react";
import { FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from "../../axios";
import AdminRaiseTicketModal from "../../pages/tickets/RaiseTicketModal";
import ModernSelect from "../../components/ui/ModernSelect";
import PageContainer from "../../components/ui/PageContainer";
import GlassInput from "../../components/ui/GlassInput";
import GlassModal from "../../components/ui/GlassModal";
import Loader from "../../components/ui/Loader";
import FilterRow from "../../components/ui/FilterRow";
import TableWithPagination from "../../components/TableWithPagination";
import { STATUS_VARIANTS, resolveStatusVariant } from "../../components/StatusBadge";

const AdminTickets = () => {
 const entriesPerPage = 10;
 const [searchTerm, setSearchTerm] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [priorityFilter, setPriorityFilter] = useState("all");
 const [startDate, setStartDate] = useState(null);
 const [endDate, setEndDate] = useState(null);
 const [showModal, setShowModal] = useState(false);
 const [tickets, setTickets] = useState([]);
 const [loading, setLoading] = useState(false);
 const [technicians, setTechnicians] = useState([]);
 const [loadingTechnicians, setLoadingTechnicians] = useState(false);
 const [assignTicket, setAssignTicket] = useState(null);
 const [assignSearch, setAssignSearch] = useState("");
 const [assigningUserId, setAssigningUserId] = useState(null);

 const navigate = useNavigate();

 useEffect(() => {
 const fetchTickets = async () => {
 setLoading(true);
 try {
 const res = await api.get("/tickets/all");
 const ticketsData = res.data?.data || res.data;
 setTickets(Array.isArray(ticketsData) ? ticketsData : []);
 } catch (error) {
 console.error("Failed to fetch tickets:", error);
 } finally {
 setLoading(false);
 }
 };

 const fetchTechnicians = async () => {
 try {
 setLoadingTechnicians(true);
 const res = await api.get("/users?status=Active");
 const usersArray = Array.isArray(res.data) ? res.data : res.data.data || [];
 const techList = usersArray.filter(user =>
 user.role === 'Technician' ||
 user.isTechnician === true ||
 (user.designation && user.designation.toLowerCase() === 'technician')
 );
 setTechnicians(techList);
 } catch (error) {
 console.error("Failed to fetch technicians:", error);
 } finally {
 setLoadingTechnicians(false);
 }
 };

 fetchTickets();
 fetchTechnicians();
 }, []);

 const handleNewTicketSubmit = (newTicket) => {
 setTickets((prev) => [...prev, newTicket]);
 setShowModal(false);
 };

 const handleStatusChange = async (ticketId, newStatus) => {
 try {
 const res = await api.patch(`/tickets/${ticketId}/status`, { status: newStatus });
 setTickets((prev) =>
 prev.map((ticket) =>
 ticket._id === ticketId ? { ...ticket, status: res.data.status } : ticket
 )
 );
 } catch (err) {
 console.error("Failed to update status:", err);
 }
 };

 const handlePriorityChange = async (ticketId, newPriority) => {
 try {
 await api.patch(`/tickets/${ticketId}/priority`, { priority: newPriority });
 setTickets((prev) =>
 prev.map((ticket) =>
 ticket._id === ticketId ? { ...ticket, priority: newPriority } : ticket
 )
 );
 } catch (err) {
 console.error("Failed to update priority:", err);
 }
 };

 const openTicketDetail = (ticket) => {
 navigate(`/admin/assign-ticket/${ticket._id}`, { state: { ticket } });
 };

 const handleAssignTicket = async (ticketId, userId) => {
 setAssigningUserId(userId);
 try {
 const res = await api.patch(`/tickets/${ticketId}/assign`, { assignedTo: userId });
 const updatedTicket = res.data;
 setTickets((prev) =>
 prev.map((t) => (t._id === ticketId ? { ...t, assignedTo: updatedTicket.assignedTo } : t))
 );
 setAssignTicket((prev) =>
 prev && prev._id === ticketId ? { ...prev, assignedTo: updatedTicket.assignedTo } : prev
 );
 toast.success("Ticket assigned successfully");
 } catch (err) {
 toast.error("Failed to assign ticket");
 console.error("Failed to assign ticket:", err);
 } finally {
 setAssigningUserId(null);
 }
 };

 const filteredTechnicians = technicians.filter((user) => {
 const query = assignSearch.trim().toLowerCase();
 if (!query) return true;
 return (
 String(user.name || "").toLowerCase().includes(query) ||
 String(user.designation || user.role || "").toLowerCase().includes(query) ||
 String(user.email || "").toLowerCase().includes(query)
 );
 });

 // Combined filter logic
 const filteredTickets = tickets.filter((ticket) => {
 const matchesSearch = String(ticket.subject || "").toLowerCase().includes(searchTerm.toLowerCase());
 const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
 const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
 const ticketDate = ticket.createdAt ? new Date(ticket.createdAt) : null;
 const startOk = !startDate || (ticketDate && ticketDate >= startDate);
 const endOk = !endDate || (ticketDate && ticketDate <= new Date(endDate.getTime() + 86399999));
 return matchesSearch && matchesStatus && matchesPriority && startOk && endOk;
 });

 const ticketColumns = [
 {
 key: "details",
 label: "Ticket Details",
 render: (_, ticket) => (
 <div className="flex flex-col group/cell" title="Click to view ticket details">
 <div className="font-medium text-heading text-sm flex items-center gap-2">
 {ticket.subject}
 <span className="text-muted opacity-0 group-hover/cell:opacity-100 transition-opacity">
 → 
 </span>
 </div>
 <div className="flex flex-wrap items-center gap-2 mt-2">
 <span className="text-xs text-muted font-mono">
 #{ticket.ticketID || ticket._id?.slice(0, 6)}
 </span>
  <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wide 
  ${STATUS_VARIANTS[resolveStatusVariant(ticket.status)]?.badge || STATUS_VARIANTS.neutral.badge}`}>
 {ticket.status}
 </span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wide 
 ${ticket.priority === "High Priority"
 ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400"
 : ticket.priority === "Medium Priority"
 ? "bg-yellow-100 text-yellow-800"
 : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400"
 }`}>
 {ticket.priority}
 </span>
 <span className="flex items-center gap-1 text-xs text-muted">
 <Clock className="w-3 h-3" />
 {new Date(ticket.createdAt).toLocaleDateString()}
 </span>
 </div>
 </div>
 )
 },
 {
 key: "raisedBy",
 label: "Raised By",
 render: (_, ticket) => (
 <div className="flex items-center gap-2">
 {ticket.closedBy?.avatar ? (
 <img src={ticket.closedBy.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
 ) : (
 <FaUserCircle className="text-muted w-6 h-6" />
 )}
 <div className="flex flex-col">
 <span className="text-xs text-main font-medium whitespace-nowrap">
 {ticket.closedBy?.name || "Unknown User"}
 </span>
 <span className="text-[10px] text-muted truncate max-w-[120px]" title={ticket.emailAddress}>
 {ticket.emailAddress}
 </span>
 </div>
 </div>
 )
 },
 {
 key: "assignee",
 label: "Assignee",
 render: (_, ticket) => (
 ticket.assignedTo ? (
 <div className="flex items-center gap-2">
 {ticket.assignedTo.avatar ? (
 <img src={ticket.assignedTo.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
 ) : (
 <FaUserCircle className="text-muted w-6 h-6" />
 )}
 <div className="flex flex-col">
 <span className="text-xs text-main font-medium whitespace-nowrap">
 {ticket.assignedTo.name || "Unknown Name"}
 </span>
 {ticket.assignedTo.email && (
 <span className="text-[10px] text-muted truncate max-w-[120px]" title={ticket.assignedTo.email}>
 {ticket.assignedTo.email}
 </span>
 )}
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center border border-border-subtle">
 <FaUserCircle className="text-slate-300 w-4 h-4" />
 </div>
 <span className="text-xs text-muted italic">Unassigned</span>
 </div>
 )
 )
 },
 {
 key: "actions",
 label: "Actions",
 align: "right",
 render: (_, ticket) => (
 <div className="flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
 <div className="w-32">
 <ModernSelect
 value={ticket.status}
 onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
 options={[
 { value: "Open", label: "Opened" },
 { value: "In Progress", label: "In Progress" },
 { value: "Closed", label: "Closed" }
 ]}
 />
 </div>
 <div className="w-32">
 <ModernSelect
 value={ticket.priority || "Medium Priority"}
 onChange={(e) => handlePriorityChange(ticket._id, e.target.value)}
 options={[
 { value: "High Priority", label: "High" },
 { value: "Medium Priority", label: "Medium" },
 { value: "Low Priority", label: "Low" }
 ]}
 />
 </div>
 <button
 onClick={() => setAssignTicket(ticket)}
 className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 px-3 py-2 rounded-lg text-xs font-bold hover:brightness-95 transition-all shadow-sm hover:shadow-md"
 title="Assign this ticket to a technician"
 >
 <UserPlus size={14} />
 Assign
 </button>
 </div>
 )
 }
 ];

 return (
 <>
 <PageContainer
 title="Tickets Management"
 subtitle="Manage and assign support tickets"
 loading={loading}
 headerActions={
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowModal(true)}
 className="btn btn-primary flex items-center gap-2"
 >
 <Plus className="h-4 w-4" />
 Create Ticket
 </button>
 </div>
 }
 filters={
 <FilterRow>
 {/* Search */}
 <GlassInput
 placeholder="Search tickets by subject..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="flex-1 min-w-[180px]"
 />

 {/* Status Filter */}
 <div className="min-w-[140px]">
 <ModernSelect
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 options={[
 { value: "all", label: "All Status" },
 { value: "Open", label: "Open" },
 { value: "In Progress", label: "In Progress" },
 { value: "Closed", label: "Closed" },
 ]}
 placeholder="All Status"
 />
 </div>

 {/* Priority Filter */}
 <div className="min-w-[140px]">
 <ModernSelect
 value={priorityFilter}
 onChange={(e) => setPriorityFilter(e.target.value)}
 options={[
 { value: "all", label: "All Priority" },
 { value: "High Priority", label: "High" },
 { value: "Medium Priority", label: "Medium" },
 { value: "Low Priority", label: "Low" },
 ]}
 placeholder="All Priority"
 />
 </div>

 {/* Date Range */}
 <div className="flex items-center gap-2 bg-surface border border-border-subtle rounded-xl px-3 h-[42px]">
 <DatePicker
 selected={startDate}
 onChange={(date) => setStartDate(date)}
 selectsStart
 startDate={startDate}
 endDate={endDate}
 placeholderText="From date"
 isClearable
 className="w-24 bg-transparent border-none text-xs font-semibold text-main outline-none cursor-pointer !py-0 !px-0 !rounded-none !shadow-none"
 />
 <span className="text-muted text-xs">→</span>
 <DatePicker
 selected={endDate}
 onChange={(date) => setEndDate(date)}
 selectsEnd
 startDate={startDate}
 endDate={endDate}
 minDate={startDate}
 placeholderText="To date"
 isClearable
 className="w-24 bg-transparent border-none text-xs font-semibold text-main outline-none cursor-pointer !py-0 !px-0 !rounded-none !shadow-none"
 />
 </div>
 </FilterRow>
 }
 >
<TableWithPagination
  columns={ticketColumns}
  data={filteredTickets}
  loading={loading}
  emptyMessage="No tickets found"
  rowsPerPage={entriesPerPage}
  defaultSort={{ key: "createdAt", direction: "desc" }}
  onRowClick={openTicketDetail}
  />
 </PageContainer>

 {showModal && (
 <AdminRaiseTicketModal
 onClose={() => setShowModal(false)}
 onSubmit={handleNewTicketSubmit}
 />
 )}

 {/* Assign Ticket Modal */}
 {assignTicket && (
 <GlassModal
 isOpen={!!assignTicket}
 onClose={() => {
 setAssignTicket(null);
 setAssignSearch("");
 setAssigningUserId(null);
 }}
 maxWidth="max-w-lg"
 title={
 <div>
 <h2 className="text-base sm:text-lg font-black text-heading tracking-widest uppercase">
 Assign Ticket
 </h2>
 <p className="text-muted text-xs font-mono mt-1 font-bold">
 #{assignTicket.ticketID || assignTicket._id?.slice(0, 6)} · {assignTicket.subject}
 </p>
 </div>
 }
 >
 <div className="space-y-4">
 {/* Current assignee summary */}
 <div className="flex items-center gap-3 p-3 bg-surface border border-border-subtle rounded-xl">
 <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shrink-0">
 <FaUserCircle className="w-6 h-6" />
 </div>
 <div className="min-w-0">
 <p className="text-[10px] font-black text-muted uppercase tracking-widest">Current Assignee</p>
 <p className="text-sm font-bold text-heading truncate">
 {assignTicket.assignedTo?.name || "Unassigned"}
 </p>
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
 <input
 type="text"
 value={assignSearch}
 onChange={(e) => setAssignSearch(e.target.value)}
 placeholder="Search technicians by name, role or email..."
 className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border-subtle text-sm font-medium outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/30 transition-all"
 />
 </div>

 {/* Technician list */}
 <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-xl border border-border-subtle divide-y divide-border-subtle">
 {loadingTechnicians ? (
 <div className="p-8 flex items-center justify-center">
 <Loader text="Loading technicians..." size="md" />
 </div>
 ) : filteredTechnicians.length > 0 ? (
 filteredTechnicians.map((user) => {
 const isAssigned = assignTicket.assignedTo?._id === user._id;
 const isAssigning = assigningUserId === user._id;
 return (
 <button
 key={user._id}
 onClick={() => handleAssignTicket(assignTicket._id, user._id)}
 disabled={!!assigningUserId}
 className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
 isAssigned
 ? "bg-amber-50 dark:bg-amber-900/30"
 : "hover:bg-surface/70"
 } ${assigningUserId ? "opacity-60 cursor-not-allowed" : ""}`}
 >
 <div className="flex items-center justify-center w-9 h-9 rounded-full bg-surface border border-border-subtle text-muted shrink-0 overflow-hidden">
 {user.avatar ? (
 <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
 ) : (
 <FaUserCircle className="w-6 h-6" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-bold text-main truncate">{user.name}</p>
 <p className="text-[10px] text-muted font-bold uppercase tracking-wide truncate">
 {user.designation || user.role || "Employee"}
 </p>
 </div>
 {isAssigning ? (
 <Loader variant="spinner" size="sm" className="text-amber-500" />
 ) : isAssigned ? (
 <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-600 dark:text-green-400">
 <Check className="w-4 h-4" /> Assigned
 </span>
 ) : null}
 </button>
 );
 })
 ) : (
 <div className="p-8 text-center">
 <div className="flex flex-col items-center gap-2">
 <UserPlus className="w-8 h-8 text-slate-300" />
 <p className="text-sm font-semibold text-muted uppercase tracking-wider">
 {technicians.length === 0 ? "No technicians available" : "No matching technicians"}
 </p>
 <p className="text-xs text-muted">
 {technicians.length === 0
 ? "Add a technician from the ticket details page to enable assignment."
 : "Try a different search term."}
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 </GlassModal>
 )}
 </>
 );
};

export default AdminTickets;