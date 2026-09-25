import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { 
 ClipboardDocumentCheckIcon, 
 FunnelIcon, 
 EyeIcon,
 XMarkIcon,
 PaperClipIcon,
 ArrowDownTrayIcon,
 PaperAirplaneIcon,
 MagnifyingGlassIcon,
 ChevronDownIcon
} from "@heroicons/react/24/solid";
import api from "../../axios";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { downloadFile } from "../../utils/downloadFile";
import { Paperclip } from "lucide-react";
import { validateDescription, getApiError } from "../../utils/validationUtils";
import PageContainer from "../../components/ui/PageContainer";
import TableWithPagination from "../../components/TableWithPagination";
import GlassModal from "../../components/ui/GlassModal";
import Loader from "../../components/ui/Loader";
import GlassInput from "../../components/ui/GlassInput";
import ModernSelect from "../../components/ui/ModernSelect";

export default function AssignedTickets() {
 const [tickets, setTickets] = useState([]);
 const [filteredTickets, setFilteredTickets] = useState([]);
 const [loading, setLoading] = useState(true);
 const [currentUser, setCurrentUser] = useState(null);
 
 // Filters
 const [statusFilter, setStatusFilter] = useState("All");
 const [priorityFilter, setPriorityFilter] = useState("All");
 const [searchTerm, setSearchTerm] = useState("");
 
 // Modal & Dropdown State
 const [selectedTicket, setSelectedTicket] = useState(null);
 const [commentText, setCommentText] = useState("");
 const [commentError, setCommentError] = useState(null);
 const [sendingComment, setSendingComment] = useState(false);
 const [openDropdownId, setOpenDropdownId] = useState(null);
 const [dropdownPos, setDropdownPos] = useState(null);
 const dropdownRef = useRef(null);

 const closeStatusMenu = () => {
 setOpenDropdownId(null);
 setDropdownPos(null);
 };

 const openStatusMenu = (e, ticketId) => {
 e.stopPropagation();
 if (openDropdownId === ticketId) {
 closeStatusMenu();
 return;
 }
 const rect = e.currentTarget.getBoundingClientRect();
 setDropdownPos({
 top: rect.bottom + 4,
 left: rect.left
 });
 setOpenDropdownId(ticketId);
 };

 // 1. Fetch Data
 const fetchData = async () => {
 try {
 setLoading(true);
 const userRes = await api.get("/auth/me");
 const user = userRes.data.user;
 setCurrentUser(user);

 const ticketRes = await api.get("/tickets");

 // RBAC RULE: Super Admin sees all. Technicians & Tech-Managers see assigned only 
 let myAssignments;
 if (user.role === "Super Admin") {
 myAssignments = ticketRes.data;
 } else {
 myAssignments = ticketRes.data.filter(t => {
 const assignId = t.assignedTo?._id || t.assignedTo;
 const myId = user._id || user.id;
 return assignId && String(assignId) === String(myId);
 });
 }
 
 setTickets(myAssignments);
 setFilteredTickets(myAssignments);
 } catch {
 toast.error("Failed to load tickets");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 // Close dropdown on click outside
 function handleClickOutside(event) {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
 closeStatusMenu();
 }
 }
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 // 2. Advanced Filtering Logic
 useEffect(() => {
 let result = tickets;

 // Status Filter
 if (statusFilter !== "All") {
 if (statusFilter === "Open") {
 result = result.filter(t => t.status.toLowerCase() === "open" || t.status.toLowerCase() === "opened");
 } else {
 result = result.filter(t => t.status.toLowerCase() === statusFilter.toLowerCase());
 }
 }

 // Priority Filter
 if (priorityFilter !== "All") {
 result = result.filter(t => t.priority.toLowerCase().includes(priorityFilter.toLowerCase()));
 }

 // Search Filter
 if (searchTerm) {
  result = result.filter(t => 
  String(t.ticketID || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
  String(t.subject || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
 }

 setFilteredTickets(result);
 }, [statusFilter, priorityFilter, searchTerm, tickets]);

 // 3. Handlers
 const handleStatusChange = async (ticketId, newStatus) => {
 try {
 await api.patch(`/tickets/${ticketId}/status`, { status: newStatus });
 const updatedList = tickets.map(t => t._id === ticketId ? { ...t, status: newStatus } : t);
 setTickets(updatedList);
 if (selectedTicket && selectedTicket._id === ticketId) {
 setSelectedTicket(prev => ({ ...prev, status: newStatus }));
 }
 closeStatusMenu();
 toast.success("Status Updated");
 } catch {
 toast.error("Failed to update status");
 }
 };

 const handleDownload = async (blobName, originalName) => {
 if (!blobName) {
 toast.error("File details missing");
 return;
 }
 await downloadFile(blobName, originalName);
 };

 const handleAddComment = async () => {
 const err = validateDescription(commentText, { min: 10, max: 500, required: true });
 if (err) { setCommentError(err); return; }
 setCommentError(null);
 try {
 setSendingComment(true);
 const res = await api.post(`/tickets/${selectedTicket._id}/response`, {
 content: commentText,
 avatar: currentUser.avatar
 });
 setSelectedTicket(res.data);
 setTickets(prev => prev.map(t => t._id === res.data._id ? res.data : t));
 setCommentText("");
 toast.success("Reply sent");
 } catch (err) {
 toast.error(getApiError(err, "Failed to send reply"));
 } finally {
 setSendingComment(false);
 }
 };

 // UI Helpers
  const getPriorityColor = (p) => {
    if (p.includes("High")) return "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50";
    if (p.includes("Medium")) return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50";
    return "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50";
  };

  const getStatusColor = (s) => {
    const status = s.toLowerCase();
    if (status === "open") return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50";
    if (status === "in progress") return "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50";
    return "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50";
  };

 const assignedTicketColumns = [
 {
 key: "ticketId",
 label: "Ticket ID",
 render: (_, ticket) => (
 <>
 <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md">
 #{ticket.ticketID}
 </span>
 <div className="text-[10px] text-muted mt-1 pl-1 font-bold">
 {format(new Date(ticket.createdAt), "MMM dd, yyyy")}
 </div>
 </>
 )
 },
 {
 key: "subject",
 label: "Subject",
 render: (_, ticket) => (
 <>
 <div className="text-sm font-bold text-main">{ticket.subject}</div>
 <div className="text-xs text-muted mt-0.5 line-clamp-1 font-medium">{ticket.description}</div>
 </>
 )
 },
 {
 key: "priority",
 label: "Priority",
 render: (_, ticket) => (
 <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${getPriorityColor(ticket.priority)}`}>
 {ticket.priority.replace(' Priority', '')}
 </span>
 )
 },
 {
 key: "status",
 label: "Status",
 render: (_, ticket) => (
 <div className="relative">
 <button
 onClick={(e) => openStatusMenu(e, ticket._id)}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${getStatusColor(ticket.status)}`}
 >
 {ticket.status}
 <ChevronDownIcon className="w-3 h-3 opacity-60" />
 </button>

 {openDropdownId === ticket._id && dropdownPos && createPortal(
 <div
 ref={dropdownRef}
 className="fixed z-[9999] w-36 bg-surface rounded-xl shadow-xl border border-border-subtle overflow-hidden py-1 animate-fadeIn"
 style={{ top: dropdownPos.top, left: dropdownPos.left }}
 >
 {["Open", "In Progress", "Closed"].map((s) => (
 <button
 key={s}
 onClick={(e) => { e.stopPropagation(); handleStatusChange(ticket._id, s); }}
 className="w-full text-left px-4 py-2 text-[10px] font-bold text-muted hover:bg-surface hover:text-amber-600 dark:text-amber-400 uppercase"
 >
 {s}
 </button>
 ))}
 </div>,
 document.body
 )}
 </div>
 )
 },
 {
 key: "action",
 label: "Action",
 align: "right",
 render: (_, ticket) => (
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
 className="p-2 bg-surface border border-border-subtle text-muted rounded-xl hover:border-amber-300 hover:text-amber-600 dark:text-amber-400 transition-all shadow-sm"
 >
 <EyeIcon className="w-4 h-4" />
 </button>
 )
 }
 ];

 return (
 <PageContainer
 title="Assigned Tickets"
 subtitle="Manage your tasks efficiently"
 filters={
        <div className="flex flex-wrap items-center gap-3 w-full">
          {/* Search */}
          <GlassInput
            placeholder="Search ID or Subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          {/* Priority Filter */}
          <div className="min-w-[140px]">
            <ModernSelect
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: "All", label: "All Priorities" },
                { value: "High", label: "High" },
                { value: "Medium", label: "Medium" },
                { value: "Low", label: "Low" }
              ]}
              placeholder="PRIORITY"
            />
          </div>

          {/* Status Filter */}
          <div className="flex bg-surface/50 dark:bg-slate-800/50 p-1 rounded-xl border border-border-subtle shrink-0">
            {["All", "Open", "In Progress", "Closed"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                  statusFilter === s ? "bg-surface shadow-sm text-main" : "text-muted hover:text-main"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
 }
 >
        {/* --- CONTAINER 2: DATA TABLE --- */}
        <div className="bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
 <TableWithPagination
 columns={assignedTicketColumns}
 data={filteredTickets}
 loading={loading}
 emptyMessage="No tickets match your filters."
 onRowClick={(ticket) => setSelectedTicket(ticket)}
 defaultSort={{ key: "createdAt", direction: "desc" }}
 />
 </div>

        {/* --- TICKET DETAIL MODAL --- */}
        {selectedTicket && (
          <GlassModal
            isOpen={!!selectedTicket}
            onClose={() => setSelectedTicket(null)}
            maxWidth="max-w-4xl"
            title={
              <div>
                <div className="flex items-center gap-3">
                  {selectedTicket.subject}
                  <span className={`text-[10px] px-2 py-1 rounded-md border uppercase tracking-wider ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <p className="text-muted text-xs font-mono mt-1 font-bold">Ticket ID: {selectedTicket.ticketID}</p>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-surface p-6 rounded-[1.5rem] shadow-sm border border-border-subtle">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest mb-3">Description</h3>
                  <p className="text-main text-sm leading-relaxed font-medium whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div className="bg-surface p-6 rounded-[1.5rem] shadow-sm border border-border-subtle">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <PaperClipIcon className="w-4 h-4" /> Attachments
                  </h3>
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedTicket.attachments.map((file, idx) => (
                        <button 
                          key={idx}
                          onClick={() => handleDownload(file.blobName, file.name)}
                          className="w-full flex items-center justify-between p-3 bg-surface rounded-xl border border-border-subtle hover:bg-amber-50 dark:bg-amber-900/30 hover:border-amber-200 dark:border-amber-800/50 transition-all group text-left"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs shrink-0">
                              {file.name.split('.').pop().toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-main truncate">{file.name}</span>
                          </div>
                          <div className="text-muted group-hover:text-amber-600 dark:text-amber-400">
                            <Paperclip size={16}/>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">No files attached.</p>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest pl-2">Discussion</h3>
                  {selectedTicket.responses?.map((res, idx) => (
                    <div key={idx} className="bg-surface p-5 rounded-[1.5rem] shadow-sm border border-border-subtle flex gap-4">
                      <img src={res.avatar || `https://ui-avatars.com/api/?name=${res.author}`} className="w-8 h-8 rounded-full border border-border-subtle" />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-sm text-heading">{res.author}</span>
                          <span className="text-[10px] text-muted font-bold">{format(new Date(res.time), "MMM dd, hh:mm a")}</span>
                        </div>
                        <p className="text-sm text-muted font-medium">{res.content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="bg-surface p-2 rounded-[1.5rem] shadow-sm border border-border-subtle flex items-center gap-2 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                    <textarea 
                      value={commentText}
                      onChange={(e) => {
                        setCommentText(e.target.value);
                        setCommentError(validateDescription(e.target.value, { min: 10, max: 500, required: true }));
                      }}
                      onBlur={() => setCommentError(validateDescription(commentText, { min: 10, max: 500, required: true }))}
                      placeholder="Type your reply (min 10 chars, at least 3 words)..."
                      className={`flex-1 bg-transparent border-none focus:ring-0 text-sm p-3 resize-none h-12 font-medium ${commentError ? "placeholder:text-red-300" : ""}`}
                    ></textarea>
                    <button 
                      onClick={() => {
                        if (!commentError) handleAddComment();
                      }}
                      disabled={sendingComment || !!commentError}
                      className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {sendingComment ? <Loader variant="spinner" size="sm" className="text-white" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  {commentError && (
                    <p className="text-xs text-red-500 mt-1 pl-2">{commentError}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-surface p-6 rounded-[1.5rem] shadow-sm border border-border-subtle">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest mb-4">Requester</h3>
                  <div className="flex items-center gap-3">
                    <img src={selectedTicket.user?.avatar || `https://ui-avatars.com/api/?name=${selectedTicket.emailAddress}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                    <div>
                      <p className="text-sm font-bold text-main">{selectedTicket.user?.name || "Unknown"}</p>
                      <p className="text-xs text-muted font-medium">{selectedTicket.emailAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassModal>
        )}
 </PageContainer>
 );
}