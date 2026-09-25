"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../axios";
import Toast from "../../components/Toast";
import ModernSelect from "../../components/ui/ModernSelect";
import { downloadFile } from "../../utils/downloadFile";
import { validateDescription, getApiError } from "../../utils/validationUtils";
import {
  ArrowLeft, Trash2, ChevronDown, Flag, User, AlertTriangle,
  Clock, Check, UserPlus, Paperclip, Send, Mail, Calendar, ShieldAlert
} from "lucide-react";
import PageContainer from "../../components/ui/PageContainer";
import GlassModal from "../../components/ui/GlassModal";
import Loader from "../../components/ui/Loader";

const STATUS_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Closed", label: "Closed" }
];

const PRIORITY_OPTIONS = [
  { value: "High Priority", label: "High" },
  { value: "Medium Priority", label: "Medium" },
  { value: "Low Priority", label: "Low" }
];

const AssignTicket = () => {
  const navigate = useNavigate();
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(null);
  const [newResponse, setNewResponse] = useState("");
  const [responseError, setResponseError] = useState(null);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(null);
  const [assigningUserId, setAssigningUserId] = useState(null);

  const [technician, setTechnician] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [addTechnicianModal, setAddTechnicianModal] = useState(false);
  const [selectedUserToPromote, setSelectedUserToPromote] = useState(null);
  const [promoting, setPromoting] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await api.get(`/tickets/${ticketId}`);
        setTicket(res.data);
        setSelectedAssigneeId(res.data.assignedTo?._id || null);
      } catch (error) {
        showToast(getApiError(error, "Failed to fetch ticket"), "error");
      } finally {
        setLoading(false);
      }
    };

    const fetchUsersData = async () => {
      try {
        const res = await api.get("/users?status=Active");

        const usersArray = Array.isArray(res.data) ? res.data : res.data.data || [];
        const safeUsers = usersArray.filter(u => u.role !== "SuperAdmin");

        const techList = safeUsers.filter(user =>
          user.role === 'Technician' ||
          user.isTechnician === true ||
          (user.designation && user.designation.toLowerCase() === 'technician')
        );
        setTechnician(techList);

        const promotableList = safeUsers.filter(user =>
          user.role !== 'Technician' &&
          user.isTechnician !== true &&
          (user.designation && user.designation.toLowerCase() !== 'technician')
        );
        setAllUsers(promotableList);

      } catch (error) {
        showToast(getApiError(error, "Failed to fetch users"), "error");
      }
    };

    if (ticketId) {
      fetchTicket();
      fetchUsersData();
    } else {
      setLoading(false);
    }
  }, [ticketId]);

  const assignToUser = async (userId) => {
    setAssigningUserId(userId);
    try {
      const res = await api.patch(`/tickets/${ticketId}/assign`, { assignedTo: userId });
      setTicket(res.data);
      setSelectedAssigneeId(userId);
      showToast("Ticket assigned successfully");
    } catch (error) {
      showToast(getApiError(error, "Failed to assign ticket"), "error");
    } finally {
      setAssignDropdownOpen(false);
      setAssigningUserId(null);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      setTicket(prev => ({ ...prev, status: res.data.status }));
      showToast("Status updated");
    } catch (error) {
      showToast(getApiError(error, "Failed to update status"), "error");
    }
  };

  const handlePriorityChange = async (newPriority) => {
    try {
      const res = await api.patch(`/tickets/${ticketId}/priority`, { priority: newPriority });
      setTicket(prev => ({ ...prev, priority: res.data.priority }));
      showToast("Priority updated");
    } catch (error) {
      showToast(getApiError(error, "Failed to update priority"), "error");
    }
  };

  const handleSubmitResponse = async () => {
    const err = validateDescription(newResponse, { min: 10, max: 500, required: true });
    if (err) {
      setResponseError(err);
      return;
    }
    setResponseError(null);
    try {
      const res = await api.post(`/tickets/${ticketId}/response`, {
        content: newResponse,
        avatar: "👤"
      });
      setTicket(res.data);
      setNewResponse("");
      showToast("Response submitted");
    } catch (error) {
      showToast(getApiError(error, "Failed to submit response"), "error");
    }
  };

  const handleDeleteTicket = async () => {
    setDeleting(true);
    try {
      await api.delete(`/tickets/${ticketId}`);
      showToast("Ticket deleted");
      setTimeout(() => navigate("/admin/assign-ticket", { replace: true }), 1000);
    } catch (error) {
      showToast(getApiError(error, "Failed to delete ticket"), "error");
      setDeleting(false);
    }
  };

  const handlePromoteToTechnician = async () => {
    if (!selectedUserToPromote) {
      showToast("Please select a user to promote", "error");
      return;
    }

    setPromoting(true);
    try {
      const response = await api.put(`/users/${selectedUserToPromote._id}`, {
        isTechnician: true
      });

      const updatedUser = response.data;

      setTechnician(prev => {
        if (!prev.find(u => u._id === updatedUser._id)) {
          return [...prev, updatedUser];
        }
        return prev;
      });

      setAllUsers(prev => prev.filter(u => u._id !== updatedUser._id));

      showToast(`${updatedUser.name} added to Technician list`);
      setAddTechnicianModal(false);
      setSelectedUserToPromote(null);
    } catch (error) {
      showToast(getApiError(error, "Failed to update user"), "error");
    } finally {
      setPromoting(false);
    }
  };

  const selectedAssignee = technician.find((u) => u._id === selectedAssigneeId);

  const renderAssigneeMenu = () => (
    <>
      <button
        onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
        className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm ${selectedAssignee
          ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800/50"
          : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
        } hover:brightness-95`}
      >
        <User size={16} />
        <span className="text-sm font-medium hidden sm:inline">
          {selectedAssignee ? selectedAssignee.name : "Assign"}
        </span>
        <ChevronDown size={16} />
      </button>

      {assignDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg z-[9999] border border-border-subtle overflow-hidden max-h-60 overflow-y-auto">
          <div className="py-1">
            {technician.length > 0 ? (
              <>
                <div className="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider border-b border-border-subtle">
                  Available Technicians
                </div>
                {technician.map((user) => {
                  const isAssigning = assigningUserId === user._id;
                  return (
                    <button
                      key={user._id}
                      onClick={() => assignToUser(user._id)}
                      disabled={!!assigningUserId}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                        assigningUserId ? "opacity-50 cursor-not-allowed" : "hover:bg-surface"
                      } ${selectedAssigneeId === user._id ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "text-main"
                      }`}
                    >
                      <User className="w-4 h-4 text-muted" />
                      <div className="flex flex-col truncate flex-1">
                        <span className="font-medium truncate">{user.name}</span>
                        <span className="text-[10px] text-muted uppercase">
                          {user.designation || user.role}
                        </span>
                      </div>
                      {isAssigning ? (
                        <Loader variant="spinner" size="sm" className="text-amber-500 ml-auto" />
                      ) : selectedAssigneeId === user._id ? (
                        <Check className="w-4 h-4 text-green-500 ml-auto" />
                      ) : null}
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="px-3 py-3 text-center">
                <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted font-medium">No technicians found</p>
                <p className="text-xs text-muted mt-1">Use "Add Technician" to update privileges</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <PageContainer title="Loading Ticket..." loading={true} isCard={false}>
        <div className="min-h-screen bg-transparent p-2 flex items-center justify-center"></div>
      </PageContainer>
    );
  }

  if (!ticket) {
    return (
      <PageContainer title="Ticket Not Found" isCard={false}>
        <div className="min-h-screen bg-transparent p-2 flex items-center justify-center">
          <div className="text-center">
            <p className="mt-3 text-sm font-medium text-muted">Ticket not found</p>
            <button
              onClick={() => navigate("/admin/assign-ticket")}
              className="mt-4 px-4 py-2 bg-surface text-main rounded-lg text-sm font-medium hover:bg-slate-200 transition"
            >
              Back to Tickets
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const currentAssignee = ticket.assignedTo?.name || selectedAssignee?.name || "Unassigned";

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Back button - left side, standard placement */}
      <div className="relative z-0">
        <button
          onClick={() => navigate("/admin/assign-ticket")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-muted hover:text-main hover:bg-surface border border-transparent hover:border-border-subtle transition-all shadow-sm"
          title="Back to Tickets"
        >
          <ArrowLeft size={16} />
          <span>Back to Tickets</span>
        </button>
      </div>

      <PageContainer
        title={`Ticket #${ticket.ticketID || ticket._id?.slice(0, 6)}: ${ticket.subject || ticket.title}`}
        subtitle={`Created ${new Date(ticket.createdAt).toLocaleString()}`}
        isCard={false}
        headerActions={
          <div className="flex items-center gap-2">
            <div className="relative z-30">
              {renderAssigneeMenu()}
            </div>

            <button
              onClick={() => setAddTechnicianModal(true)}
              className="px-4 py-2 rounded-xl flex items-center gap-2 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 hover:brightness-95 transition-all shadow-sm hover:shadow-md"
              title="Add New Technician"
            >
              <UserPlus size={16} />
              <span className="text-sm font-medium hidden sm:inline">Add Technician</span>
            </button>

            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="p-2 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all shadow-sm"
              title="Delete Ticket"
            >
              <Trash2 size={18} />
            </button>
          </div>
        }
      >

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-0">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket ID strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800/50">
              #{ticket.ticketID || ticket._id?.slice(0, 8)}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide 
              ${ticket.status === 'Open' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50'
              : ticket.status === 'In Progress' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50'
              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'}`}>
              {ticket.status}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide 
              ${ticket.priority === 'High Priority' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50'
              : ticket.priority === 'Medium Priority' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50'
              : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'}`}>
              <Flag size={11} className="inline mr-1" />
              {ticket.priority}
            </span>
          </div>

          {/* Description */}
          <div className="glass-card p-5 relative z-10">
            <h3 className="text-sm font-bold text-heading uppercase tracking-wide border-b border-border-subtle pb-3 mb-3">
              Description
            </h3>
            <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* DISCUSSION / CHAT SECTION */}
          <div className="glass-card p-5 relative z-10">
            <h3 className="text-sm font-bold text-heading uppercase tracking-wide mb-4">Discussion</h3>
            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar">
              {ticket.responses?.map((res, i) => (
                <div key={i} className="bg-surface/50 rounded-xl p-3 border border-border-subtle">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 rounded-full text-sm font-bold shrink-0">
                      {res.avatar && res.avatar !== "👤" && !res.avatar.includes("Unknown") ?
                        <img src={res.avatar} alt="av" className="w-full h-full rounded-full object-cover" /> :
                        res.author?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <h4 className="text-sm font-bold text-heading">{res.author}</h4>
                        <span className="text-xs text-muted">{new Date(res.time).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-main whitespace-pre-wrap">{res.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!ticket.responses || ticket.responses.length === 0) && <p className="text-center text-xs text-muted italic">No messages yet.</p>}
            </div>

            <div className="relative">
              <textarea
                value={newResponse}
                onChange={e => {
                  setNewResponse(e.target.value);
                  setResponseError(validateDescription(e.target.value, { min: 10, max: 500, required: true }));
                }}
                onBlur={() => setResponseError(validateDescription(newResponse, { min: 10, max: 500, required: true }))}
                className={`glass-input pr-12 min-h-[60px] resize-none ${responseError ? "!border-red-400" : ""}`}
                placeholder="Type a reply (min 10 characters, at least 3 words)..."
              />
              {responseError && (
                <p className="text-xs text-red-500 mt-1">{responseError}</p>
              )}
              <button
                onClick={handleSubmitResponse}
                disabled={!newResponse.trim() || !!responseError}
                className="btn-ghost absolute right-2 p-2 rounded-lg"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div className="glass-card p-5 relative z-10">
            <h3 className="text-sm font-bold text-heading uppercase tracking-wide border-b border-border-subtle pb-3 mb-4">
              Ticket Details
            </h3>
            <div className="space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} /> Status
                </p>
                <ModernSelect
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Flag size={12} /> Priority
                </p>
                <ModernSelect
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  options={PRIORITY_OPTIONS}
                />
              </div>

              <hr className="border-border-subtle" />

              {/* Assignee */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Assignee</p>
                  <p className="text-sm font-bold text-heading truncate">{currentAssignee}</p>
                </div>
              </div>

              {/* Requester */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                  <Mail size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Requester</p>
                  <p className="text-sm font-bold text-heading truncate">{ticket.emailAddress || "—"}</p>
                </div>
              </div>

              {/* Created */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Created</p>
                  <p className="text-sm font-bold text-heading truncate">
                    {new Date(ticket.createdAt).toLocaleDateString()} · {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="glass-card p-5 relative z-10">
            <h3 className="text-sm font-bold text-heading uppercase tracking-wide border-b border-border-subtle pb-3 mb-3">
              Attachments
            </h3>
            {ticket.attachments && ticket.attachments.length > 0 ? (
              <div className="space-y-2">
                {ticket.attachments.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      downloadFile(file.blobName || file.url, file.name);
                    }}
                    className="w-full flex items-center justify-between p-3 bg-surface rounded-xl border border-border-subtle hover:bg-amber-50 dark:bg-amber-900/30 hover:border-amber-200 dark:border-amber-800/50 transition-all group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden text-left">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                        {file.name.split('.').pop().toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-main truncate">{file.name}</span>
                    </div>
                    <div className="text-muted group-hover:text-amber-600 dark:text-amber-400">
                      <Paperclip size={16} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No attachments found.</p>
            )}
          </div>
        </div>
      </div>
      </PageContainer>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <GlassModal
          isOpen={true}
          onClose={() => {
            if (!deleting) {
              setDeleteConfirmOpen(false);
            }
          }}
          maxWidth="max-w-md"
          title={
            <div>
              <h2 className="text-base sm:text-lg font-black text-heading tracking-widest uppercase">
                Delete Ticket
              </h2>
              <p className="text-[9px] text-muted font-black tracking-[0.2em] mt-1 uppercase">This action cannot be undone</p>
            </div>
          }
          footer={
            <div className="flex gap-3 sm:gap-4 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="flex-1 py-3 sm:py-4 font-black text-[10px] sm:text-[11px] text-muted uppercase tracking-widest hover:text-main transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleDeleteTicket}
                disabled={deleting}
                className="flex-1 sm:py-4 text-[10px] sm:text-[10px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed btn"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader variant="spinner" size="sm" className="text-white" />
                    DELETING...
                  </span>
                ) : (
                  "DELETE TICKET"
                )}
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-main">
                <ShieldAlert size={14} className="inline mr-1" />
                Are you sure you want to delete this ticket?
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Ticket <span className="font-mono font-bold text-red-500">#{ticket.ticketID || ticket._id?.slice(0, 8)}</span> along with its
                discussion history and attachments will be permanently removed.
              </p>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Add Technician Modal */}
      {addTechnicianModal && (
        <GlassModal
          isOpen={true}
          onClose={() => {
            if (!promoting) {
              setAddTechnicianModal(false);
              setSelectedUserToPromote(null);
            }
          }}
          maxWidth="max-w-md"
          title={
            <div>
              <h2 className="text-base sm:text-lg font-black text-heading tracking-widest uppercase">
                ADD TECHNICIAN
              </h2>
              <p className="text-[9px] text-muted font-black tracking-[0.2em] mt-1 uppercase">Grant Technician Privileges</p>
            </div>
          }
          footer={
            <div className="flex gap-3 sm:gap-4 w-full">
              <button
                type="button"
                onClick={() => {
                  setAddTechnicianModal(false);
                  setSelectedUserToPromote(null);
                }}
                disabled={promoting}
                className="flex-1 py-3 sm:py-4 font-black text-[10px] sm:text-[11px] text-muted uppercase tracking-widest hover:text-muted transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handlePromoteToTechnician}
                disabled={!selectedUserToPromote || promoting}
                className="flex-1 sm:py-4 text-[10px] sm:text-[10px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed btn btn-primary"
              >
                {promoting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader variant="spinner" size="sm" className="text-white" />
                    UPDATING...
                  </span>
                ) : (
                  "GRANT PERMISSION"
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar min-h-[400px]">
            <ModernSelect
              label="SELECT USER"
              name="userSelect"
              value={selectedUserToPromote?._id || ""}
              onChange={(e) => {
                const user = allUsers.find(u => u._id === e.target.value);
                setSelectedUserToPromote(user);
              }}
              options={allUsers.map(user => ({
                value: user._id,
                label: `${user.name.toUpperCase()} (${user.designation || user.role})`
              }))}
              placeholder="Choose a user..."
              disabled={promoting}
            />

            {selectedUserToPromote && (
              <div className="bg-surface/50 border border-border-subtle rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">NAME</p>
                    <p className="text-sm font-bold text-main truncate">{selectedUserToPromote.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">CURRENT DESIGNATION</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400`}>
                      {selectedUserToPromote.designation || selectedUserToPromote.role}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">ACTION</p>
                    <p className="text-xs text-muted">
                      This user will be added to the <strong>Technician List</strong>. <br />
                      Their existing Role ({selectedUserToPromote.role}) and Designation will remain unchanged.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassModal>
      )}
    </>
  );
};

export default AssignTicket;