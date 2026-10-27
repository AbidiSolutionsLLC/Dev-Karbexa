import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  X, Check, Sun, Moon, Monitor, Bell, Mail, User as UserIcon,
  LogOut, Palette, AlertTriangle, Loader2, FolderKanban, Search,
  UserPlus, ShieldCheck, Trash2, ChevronDown, HelpCircle
} from "lucide-react";
import api from "../axios";
import settingsApi from "../api/settingsApi";
import { logout, setAuthUser } from "../slices/authSlice";
import { setUser } from "../slices/userSlice";
import { useTheme } from "../context/ThemeContext";
import ToggleSwitch from "./ui/ToggleSwitch";
import GlassButton from "./ui/GlassButton";
import ModernSelect from "./ui/ModernSelect";

const EASE = [0.16, 1, 0.3, 1];

const TABS = [
  { id: "appearance", label: "Appearance", hint: "Theme & look", icon: Palette },
  { id: "notifications", label: "Notifications", hint: "Email alerts", icon: Bell },
  { id: "account", label: "Account", hint: "Profile & session", icon: UserIcon },
];

const PROJECT_ROLES = [
  {
    value: "Team Member",
    label: "Team Member",
    shortLabel: "Member",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    activeRing: "ring-emerald-500/40 border-emerald-500/40 bg-emerald-500/5",
    dot: "bg-emerald-500",
    desc: "View assigned projects, update tasks, and log time.",
    fullDesc: "Task contributor: view assigned projects, update task status, log worked hours, and collaborate.",
  },
  {
    value: "Project Manager",
    label: "Project Manager",
    shortLabel: "Manager",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    activeRing: "ring-blue-500/40 border-blue-500/40 bg-blue-500/5",
    dot: "bg-blue-500",
    desc: "Manage milestones, assign tasks, and track progress.",
    fullDesc: "Delivery lead: manage project milestones, create and assign tasks, and oversee project execution.",
  },
  {
    value: "Project Administrator",
    label: "Project Administrator",
    shortLabel: "Admin",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    activeRing: "ring-purple-500/40 border-purple-500/40 bg-purple-500/5",
    dot: "bg-purple-500",
    desc: "Full access to all projects, portal settings, and teams.",
    fullDesc: "Full portfolio administration: create/delete projects, manage groups, portal settings, and all tasks.",
  },
];

const PROJECT_ROLE_SELECT_OPTIONS = [
  { value: "Team Member", label: "Team Member" },
  { value: "Project Manager", label: "Project Manager" },
  { value: "Project Administrator", label: "Project Administrator" },
];

const formatProjectRoleDisplay = (role) => {
  if (!role) return null;
  const cleaned = String(role).toLowerCase().replace(/[\s_-]+/g, "");
  if (cleaned === "projectadministrator" || cleaned === "projectadmin" || cleaned === "superadmin" || cleaned === "admin") {
    return "Project Administrator";
  }
  if (cleaned === "projectmanager" || cleaned === "manager") {
    return "Project Manager";
  }
  return "Team Member";
};

const getEffectiveProjectRole = (user) => {
  if (!user) return null;
  // 1. Explicit Project Portal role takes top precedence
  if (user.projectRole) {
    return formatProjectRoleDisplay(user.projectRole);
  }
  // 2. Company-wide Super Admin & Admin default to Project Administrator
  const companyRole = (user.role || "").replace(/\s+/g, "").toLowerCase();
  if (companyRole === "superadmin" || companyRole === "admin") {
    return "Project Administrator";
  }
  // 3. Fallback: normalize company role
  return formatProjectRoleDisplay(user.role) || "Team Member";
};

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

function SectionHeading({ icon, title, subtitle }) {
  const Icon = icon;
  return (
    <div className="mb-5 flex items-start gap-3">
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <h3 className="text-base font-bold leading-tight" style={{ color: "var(--color-text-heading)" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--color-text-tertiary)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div
      className="flex items-center justify-between gap-6 py-2.5 last:border-0"
      style={{ borderBottom: "1px solid var(--color-border-secondary)" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { instance } = useMsal();
  const { themeMode, setThemeMode } = useTheme();

  const authStateUser = useSelector((s) => s.auth.user);
  const user = authStateUser?.data?.user || authStateUser?.user || authStateUser || null;
  const emailPreferences = user?.notificationPreferences?.email || {};
  const emailEnabled = emailPreferences.enabled !== false;

  const [tab, setTab] = useState("appearance");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // --- PROJECT PORTAL ASSIGNMENT STATE ---
  const userRole = (user?.role || '').replace(/\s+/g, '').toLowerCase();
  const isAdminOrSuper = userRole === 'superadmin' || userRole === 'admin';
  const [portalUsers, setPortalUsers] = useState([]);
  const [loadingPortalUsers, setLoadingPortalUsers] = useState(false);
  const [portalSearch, setPortalSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('Team Member');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);

  useEffect(() => {
    if (!isOpen || !isAdminOrSuper) return;
    let mounted = true;
    (async () => {
      try {
        setLoadingPortalUsers(true);
        const res = await api.get('/users?limit=1000');
        const list = res.data?.data || res.data || [];
        if (mounted) setPortalUsers(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load users for portal assignment', err);
      } finally {
        if (mounted) setLoadingPortalUsers(false);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, isAdminOrSuper]);

  const handleAssignUserRole = async (targetUserId, targetRole) => {
    if (!targetUserId || !targetRole) return;
    try {
      setSavingUserId(targetUserId);
      const res = await api.put('/users/project-portal-access', {
        userId: targetUserId,
        projectRole: targetRole,
        hasProjectPortalAccess: true,
      });
      const updatedList = res.data?.data || res.data || [];
      if (Array.isArray(updatedList)) {
        setPortalUsers(updatedList);
      } else {
        setPortalUsers(prev => prev.map(u => {
          if ((u._id || u.id) === targetUserId) {
            return { ...u, hasProjectPortalAccess: true, projectRole: targetRole };
          }
          return u;
        }));
      }

      const targetObj = portalUsers.find(u => (u._id || u.id) === targetUserId);
      toast.success(`Assigned ${targetObj?.name || 'User'} as ${targetRole} in Project Portal`);

      const currentId = user?._id || user?.id;
      if (currentId === targetUserId) {
        const updatedAuth = { ...user, hasProjectPortalAccess: true, projectRole: targetRole };
        dispatch(setAuthUser(updatedAuth));
        dispatch(setUser(updatedAuth));
      }

      setSelectedUserId('');
      setUserDropdownOpen(false);
      setUserSearchQuery('');
      setShowAddPanel(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update project portal role');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRevokeAccess = async (targetUserId) => {
    if (!targetUserId) return;
    try {
      setSavingUserId(targetUserId);
      const res = await api.put('/users/project-portal-access', {
        userId: targetUserId,
        hasProjectPortalAccess: false,
        projectRole: null,
      });
      const updatedList = res.data?.data || res.data || [];
      if (Array.isArray(updatedList)) {
        setPortalUsers(updatedList);
      } else {
        setPortalUsers(prev => prev.map(u => {
          if ((u._id || u.id) === targetUserId) {
            return { ...u, hasProjectPortalAccess: false, projectRole: null };
          }
          return u;
        }));
      }

      const targetObj = portalUsers.find(u => (u._id || u.id) === targetUserId);
      toast.info(`Revoked Project Portal access for ${targetObj?.name || 'User'}`);

      const currentId = user?._id || user?.id;
      if (currentId === targetUserId) {
        const updatedAuth = { ...user, hasProjectPortalAccess: false, projectRole: null };
        dispatch(setAuthUser(updatedAuth));
        dispatch(setUser(updatedAuth));
      }
      if (selectedUserId === targetUserId) {
        setSelectedUserId('');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to revoke project portal access');
    } finally {
      setSavingUserId(null);
    }
  };

  // Escape to close + scroll lock while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setConfirmSignOut(false);
      setAvatarError(false);
    }
  }, [isOpen]);
  // Load the role-eligible email categories lazily when the modal opens
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    (async () => {
      try {
        setLoadingCategories(true);
        const res = await settingsApi.getNotificationSettings();
        const data = res?.data || res;
        if (active) setCategories(Array.isArray(data?.emailCategories) ? data.emailCategories : []);
      } catch {
        if (active) setCategories([]);
      } finally {
        if (active) setLoadingCategories(false);
      }
    })();
    return () => { active = false; };
  }, [isOpen]);

  const updateEmailPreferences = async (patch) => {
    if (savingPrefs) return;
    const previous = user;
    const optimistic = {
      ...(user || {}),
      notificationPreferences: {
        ...(user?.notificationPreferences || {}),
        email: { ...emailPreferences, ...patch },
      },
    };
    dispatch(setAuthUser(optimistic));
    dispatch(setUser(optimistic));
    try {
      setSavingPrefs(true);
      const res = await settingsApi.updateSettings({ notificationPreferences: { email: patch } });
      const updated = res?.data?.user || res?.data || res;
      if (updated?.notificationPreferences) {
        const merged = { ...(previous || {}), ...updated, notificationPreferences: updated.notificationPreferences };
        dispatch(setAuthUser(merged));
        dispatch(setUser(merged));
      }
      toast.success("Notification preferences updated");
    } catch (err) {
      if (previous) { dispatch(setAuthUser(previous)); dispatch(setUser(previous)); }
      toast.error(err?.response?.data?.message || "Failed to update notification preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {}, { headers: { _isLogoutRequest: true } });
    } catch (err) {
      console.warn("Logout API failed:", err.message);
    } finally {
      dispatch(logout());
      const accounts = instance?.getAllAccounts?.();
      if (accounts && accounts.length > 0) {
        instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
      } else {
        navigate("/auth/login");
      }
    }
  };

  if (!isOpen) return null;

  const initials = (user?.name || "User")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const role = user?.role || "Member";
  const department = typeof user?.department === "object" ? user?.department?.name : user?.department;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      style={{ background: "var(--color-overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-[10000] flex h-[88vh] max-h-[740px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border shadow-2xl animate-slideInUp"
        style={{ background: "var(--color-bg-primary)", borderColor: "var(--color-border-accent)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header
          className="relative flex shrink-0 items-center gap-4 px-5 py-4 sm:px-6 sm:py-5"
          style={{ borderBottom: "1px solid var(--color-border-accent)" }}
        >
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-black shadow-lg"
            style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
          >
            {user?.avatar && !avatarError ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </div>

          <div className="relative min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold leading-tight" style={{ color: "var(--color-text-heading)" }}>
              {user?.name || "Settings"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: "var(--color-bg-hover)", color: "var(--color-brand-text)", border: "1px solid var(--color-border-accent)" }}
              >
                {role}
              </span>
              {user?.email && (
                <span className="truncate text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {user.email}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-bg-hover)]"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Navigation */}
          <nav
            className="flex shrink-0 gap-2 overflow-x-auto border-b p-3 no-scrollbar sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
            style={{ borderColor: "var(--color-border-primary)" }}
          >
            {[
              ...TABS,
              ...(isAdminOrSuper ? [{ id: "portalAccess", label: "Project Access", hint: "Roles & permissions", icon: FolderKanban }] : [])
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className="group flex items-center gap-3 whitespace-nowrap rounded-2xl px-3 py-2.5 text-left transition-all"
                  style={{
                    background: active ? "var(--color-bg-active)" : "transparent",
                    border: `1px solid ${active ? "var(--color-border-accent)" : "transparent"}`,
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors"
                    style={{
                      background: active ? "var(--gradient-gold-foil)" : "var(--color-bg-hover)",
                      color: active ? "var(--color-text-on-brand)" : "var(--color-brand-primary)",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: active ? "var(--color-brand-text)" : "var(--color-text-secondary)" }}>
                      {item.label}
                    </span>
                    <span className="hidden text-[11px] sm:block" style={{ color: "var(--color-text-tertiary)" }}>
                      {item.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="custom-scrollbar-visible min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <AnimatePresence mode="wait">
              <Motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {/* ─── APPEARANCE ─── */}
                {tab === "appearance" && (
                  <div>
                    <SectionHeading
                      icon={Palette}
                      title="Appearance"
                      subtitle="Choose how Karbexa looks on this device."
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {THEME_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = themeMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setThemeMode(option.id)}
                            className="relative flex flex-col gap-3 rounded-2xl p-4 text-left transition-all"
                            style={{
                              background: "var(--color-bg-secondary)",
                              border: `2px solid ${active ? "var(--color-brand-primary)" : "var(--color-border-primary)"}`,
                              boxShadow: active ? "0 10px 26px rgba(184,134,11,0.22)" : "none",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-xl"
                                style={{ background: "var(--color-bg-hover)", color: "var(--color-brand-primary)" }}
                              >
                                <Icon className="h-[18px] w-[18px]" />
                              </span>
                              {active && (
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-full"
                                  style={{ background: "var(--color-brand-primary)" }}
                                >
                                  <Check className="h-3 w-3" style={{ color: "var(--color-text-on-brand)" }} />
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: "var(--color-text-heading)" }}>
                                {option.label}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                                {active ? "Currently active" : "Click to apply"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─── NOTIFICATIONS ─── */}
                {tab === "notifications" && (
                  <div>
                    <SectionHeading
                      icon={Bell}
                      title="Email notifications"
                      subtitle="Choose which emails you receive. Only notifications relevant to your role are shown."
                    />

                    <div
                      className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5"
                      style={{ background: "var(--color-bg-hover)", border: "1px solid var(--color-border-accent)" }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
                      >
                        <Mail className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" style={{ color: "var(--color-text-heading)" }}>
                          {emailEnabled ? "Email notifications are on" : "Email notifications are off"}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {emailEnabled
                            ? "You'll receive emails for the categories below."
                            : "You won't receive any notification emails."}
                        </p>
                      </div>
                      <ToggleSwitch
                        id="settings-email-master-toggle"
                        checked={emailEnabled}
                        disabled={savingPrefs}
                        onChange={(val) => updateEmailPreferences({ enabled: val })}
                        ariaLabel="Enable or disable all email notifications"
                      />
                    </div>

                    <div className={emailEnabled ? "transition-opacity" : "pointer-events-none opacity-40 transition-opacity"}>
                      {loadingCategories && (
                        <div className="space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-xl px-4 py-3"
                              style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-primary)" }}
                            >
                              <div className="space-y-2">
                                <div className="h-3 w-32 rounded-full" style={{ background: "var(--color-bg-hover)" }} />
                                <div className="h-2.5 w-48 rounded-full" style={{ background: "var(--color-bg-hover)" }} />
                              </div>
                              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-text-muted)" }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {!loadingCategories && categories.length === 0 && (
                        <div
                          className="flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center"
                          style={{ background: "var(--color-bg-secondary)", border: "1px dashed var(--color-border-accent)" }}
                        >
                          <Bell className="h-6 w-6" style={{ color: "var(--color-text-muted)" }} />
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                            No email notifications for your role
                          </p>
                          <p className="max-w-xs text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                            Your role doesn't receive notification emails, so there's nothing to configure here.
                          </p>
                        </div>
                      )}

                      {!loadingCategories && categories.map((category) => {
                        const isOn = emailPreferences[category.key] !== false;
                        return (
                          <div
                            key={category.key}
                            className="mb-2 flex items-center gap-3 rounded-xl px-4 py-3"
                            style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-primary)" }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {category.label}
                              </p>
                              {category.description && (
                                <p className="text-xs leading-snug" style={{ color: "var(--color-text-tertiary)" }}>
                                  {category.description}
                                </p>
                              )}
                            </div>
                            <ToggleSwitch
                              id={`settings-email-${category.key}`}
                              size="sm"
                              checked={isOn}
                              disabled={savingPrefs}
                              onChange={(val) => updateEmailPreferences({ [category.key]: val })}
                              ariaLabel={`Toggle ${category.label} emails`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─── PROJECT PORTAL ACCESS & ROLES (SUPER ADMIN & ADMIN ONLY) ─── */}
                {tab === "portalAccess" && isAdminOrSuper && (() => {
                  const selectedUser = portalUsers.find(u => (u._id || u.id) === selectedUserId);
                  const isAssigned = (u) => {
                    const clean = (u.role || "").replace(/\s+/g, "").toLowerCase();
                    return clean === "superadmin" || clean === "admin" || Boolean(u.hasProjectPortalAccess || u.projectRole);
                  };
                  const assignedUsers = portalUsers.filter(isAssigned);

                  // Role breakdown metrics
                  const adminCount = assignedUsers.filter((u) => getEffectiveProjectRole(u) === "Project Administrator").length;

                  const managerCount = assignedUsers.filter((u) => getEffectiveProjectRole(u) === "Project Manager").length;

                  const memberCount = assignedUsers.filter((u) => getEffectiveProjectRole(u) === "Team Member").length;

                  // Filtered users for table
                  const filteredUsers = assignedUsers.filter((u) => {
                    const currentProjectRole = getEffectiveProjectRole(u);

                    if (roleFilter === "admin" && currentProjectRole !== "Project Administrator") return false;
                    if (roleFilter === "manager" && currentProjectRole !== "Project Manager") return false;
                    if (roleFilter === "member" && currentProjectRole !== "Team Member") return false;

                    if (!portalSearch.trim()) return true;
                    const q = portalSearch.toLowerCase().trim();
                    const name = (u.name || "").toLowerCase();
                    const email = (u.email || "").toLowerCase();
                    const role = (u.role || "").toLowerCase();
                    const pRole = currentProjectRole ? currentProjectRole.toLowerCase() : "";
                    return name.includes(q) || email.includes(q) || role.includes(q) || pRole.includes(q);
                  });

                  return (
                    <div className="space-y-4">
                      {/* ── Header ── */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-primary)]">
                        <div>
                          <h3 className="text-base font-bold text-heading flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-[var(--color-brand-primary)]" />
                            Project Access & Roles
                          </h3>
                          <p className="mt-0.5 text-xs text-muted">
                            Control which team members have access to the Project Portal and configure their role permissions.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddPanel((prev) => !prev);
                              setSelectedUserId("");
                              setUserDropdownOpen(false);
                              setUserSearchQuery("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                            style={{
                              background: showAddPanel ? "var(--color-bg-hover)" : "var(--gradient-gold-foil)",
                              color: showAddPanel ? "var(--color-text-secondary)" : "var(--color-text-on-brand)",
                              border: "1px solid " + (showAddPanel ? "var(--color-border-primary)" : "transparent"),
                            }}
                          >
                            {showAddPanel ? (
                              <>
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3.5 w-3.5" />
                                Grant Access
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* ── Collapsible Add / Grant Access Drawer ── */}
                      <AnimatePresence>
                        {showAddPanel && (
                          <Motion.div
                            initial={{ opacity: 0, height: 0, y: -6 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -6 }}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <div
                              className="rounded-2xl p-4 sm:p-5 border space-y-4 shadow-sm"
                              style={{
                                background: "var(--color-bg-secondary)",
                                borderColor: "var(--color-border-accent)",
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="flex h-6 w-6 items-center justify-center rounded-lg"
                                    style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="text-xs font-bold text-heading">Grant Project Portal Access</span>
                                </div>
                                {selectedUser && (
                                  <span className="text-[11px] text-muted">
                                    Configuring: <strong className="text-heading">{selectedUser.name}</strong>
                                  </span>
                                )}
                              </div>

                              {/* Member Combobox Selector */}
                              <div className="relative">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                                  1. Select Team Member
                                </label>
                                <div
                                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all hover:border-[var(--color-brand-primary)]"
                                  style={{
                                    background: "var(--color-bg-primary)",
                                    borderColor: userDropdownOpen ? "var(--color-brand-primary)" : "var(--color-border-primary)",
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Search className="h-4 w-4 text-muted shrink-0" />
                                    {selectedUser ? (
                                      <div className="flex items-center gap-2 truncate">
                                        <div
                                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                          style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
                                        >
                                          {selectedUser.avatar ? (
                                            <img src={selectedUser.avatar} alt="" className="h-full w-full object-cover rounded-full" />
                                          ) : (
                                            (selectedUser.name || "U").charAt(0).toUpperCase()
                                          )}
                                        </div>
                                        <span className="text-sm font-semibold text-heading truncate">{selectedUser.name}</span>
                                        <span className="text-xs text-muted truncate">({selectedUser.email})</span>
                                        {selectedUser.projectRole && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                            Current: {formatProjectRoleDisplay(selectedUser.projectRole)}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted">Search team member by name, email, or role...</span>
                                    )}
                                  </div>
                                  <ChevronDown className={"h-4 w-4 text-muted transition-transform duration-200 " + (userDropdownOpen ? "rotate-180" : "")} />
                                </div>

                                {/* Dropdown Menu */}
                                {userDropdownOpen && (
                                  <div
                                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border shadow-xl p-2 max-h-60 overflow-y-auto custom-scrollbar-visible"
                                    style={{
                                      background: "var(--color-bg-primary)",
                                      borderColor: "var(--color-border-accent)",
                                    }}
                                  >
                                    <div className="p-1 mb-1.5">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        placeholder="Type to filter team members..."
                                        className="glass-input !py-1.5 !px-3 !text-xs w-full rounded-xl"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      {portalUsers
                                        .filter((u) => {
                                          const q = userSearchQuery.toLowerCase().trim();
                                          if (!q) return true;
                                          const name = (u.name || "").toLowerCase();
                                          const email = (u.email || "").toLowerCase();
                                          const role = (u.role || "").toLowerCase();
                                          return name.includes(q) || email.includes(q) || role.includes(q);
                                        })
                                        .map((u) => {
                                          const uId = u._id || u.id;
                                          const isCurrentSelected = uId === selectedUserId;
                                          const cleanRole = (u.role || "").replace(/\s+/g, "").toLowerCase();
                                          const isCompanyAdmin = cleanRole === "superadmin" || cleanRole === "admin";
                                          const activeProjectRole = (u.hasProjectPortalAccess || u.projectRole || isCompanyAdmin)
                                            ? getEffectiveProjectRole(u)
                                            : null;

                                          return (
                                            <div
                                              key={uId}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedUserId(uId);
                                                setSelectedRole(getEffectiveProjectRole(u) || "Team Member");
                                                setUserDropdownOpen(false);
                                              }}
                                              className={"flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors " + (
                                                isCurrentSelected
                                                  ? "bg-[var(--color-bg-active)] border border-[var(--color-border-accent)]"
                                                  : "hover:bg-[var(--color-bg-hover)]"
                                              )}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                                                  style={{ background: "var(--gradient-gold-foil)", color: "var(--color-text-on-brand)" }}
                                                >
                                                  {u.avatar ? (
                                                    <img src={u.avatar} alt="" className="h-full w-full object-cover rounded-lg" />
                                                  ) : (
                                                    (u.name || "U").charAt(0).toUpperCase()
                                                  )}
                                                </div>
                                                <div className="min-w-0">
                                                  <p className="text-xs font-semibold text-heading truncate">{u.name}</p>
                                                  <p className="text-[10px] text-muted truncate">{u.email}</p>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--color-bg-hover)] text-muted border border-[var(--color-border-primary)]">
                                                  {u.role || "Employee"}
                                                </span>
                                                {activeProjectRole ? (
                                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                    {activeProjectRole}
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] text-muted px-1.5">No Access</span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Role Selection Grid */}
                              <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                                  2. Choose Role & Permission Level
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  {PROJECT_ROLES.map((r) => {
                                    const isSelected = selectedRole === r.value;
                                    return (
                                      <div
                                        key={r.value}
                                        onClick={() => setSelectedRole(r.value)}
                                        className={"cursor-pointer rounded-xl p-3 border transition-all flex flex-col justify-between " + (
                                          isSelected
                                            ? r.activeRing + " ring-2 shadow-sm"
                                            : "border-[var(--color-border-primary)] hover:border-[var(--color-border-accent)] bg-[var(--color-bg-primary)]"
                                        )}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                              <span className={"h-2 w-2 rounded-full " + r.dot} />
                                              <span className="text-xs font-bold text-heading">{r.label}</span>
                                            </div>
                                            <input
                                              type="radio"
                                              name="selectedProjectRole"
                                              checked={isSelected}
                                              onChange={() => setSelectedRole(r.value)}
                                              className="accent-[var(--color-brand-primary)] h-3.5 w-3.5 cursor-pointer"
                                            />
                                          </div>
                                          <p className="text-[11px] text-muted leading-relaxed">{r.desc}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Action Footer */}
                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-primary)]">
                                <GlassButton
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setShowAddPanel(false);
                                    setSelectedUserId("");
                                    setUserDropdownOpen(false);
                                  }}
                                >
                                  Cancel
                                </GlassButton>
                                <GlassButton
                                  variant="primary"
                                  size="sm"
                                  disabled={!selectedUserId}
                                  isLoading={savingUserId === selectedUserId}
                                  onClick={() => handleAssignUserRole(selectedUserId, selectedRole)}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  {selectedUser?.hasProjectPortalAccess ? "Update Access" : "Grant Access"}
                                </GlassButton>
                              </div>
                            </div>
                          </Motion.div>
                        )}
                      </AnimatePresence>

                      {/* ── Toolbar: Role Filter Pills & Search ── */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] overflow-x-auto no-scrollbar">
                          {[
                            { id: "all", label: "All (" + assignedUsers.length + ")" },
                            { id: "admin", label: "Admins (" + adminCount + ")" },
                            { id: "manager", label: "Managers (" + managerCount + ")" },
                            { id: "member", label: "Members (" + memberCount + ")" },
                          ].map((f) => {
                            const active = roleFilter === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setRoleFilter(f.id)}
                                className={"px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer " + (
                                  active
                                    ? "bg-[var(--color-bg-primary)] text-heading shadow-sm"
                                    : "text-muted hover:text-heading"
                                )}
                                style={active ? { border: "1px solid var(--color-border-accent)" } : {}}
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full sm:w-60">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                          <input
                            type="text"
                            value={portalSearch}
                            onChange={(e) => setPortalSearch(e.target.value)}
                            placeholder="Filter members..."
                            className="glass-input !pl-8 !py-1.5 !text-xs w-full rounded-xl"
                          />
                          {portalSearch && (
                            <button
                              type="button"
                              onClick={() => setPortalSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-heading cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Members List ── */}
                      {loadingPortalUsers ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted">
                          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
                          <span className="text-xs">Loading portal users...</span>
                        </div>
                      ) : assignedUsers.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--color-border-primary)] text-muted text-xs space-y-2">
                          <p className="font-semibold text-heading">No users assigned to Project Portal yet</p>
                          <p className="text-muted">Click the &quot;Grant Access&quot; button above to assign company members to the Project Portal.</p>
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl border border-dashed border-[var(--color-border-primary)] text-muted text-xs space-y-2">
                          <p>No project members found matching your search or filter.</p>
                          <button
                            type="button"
                            onClick={() => { setPortalSearch(""); setRoleFilter("all"); }}
                            className="text-xs font-semibold text-[var(--color-brand-text)] hover:underline cursor-pointer"
                          >
                            Reset filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[350px] overflow-y-auto custom-scrollbar-visible pr-1">
                          {/* Table Column Headers */}
                          <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted select-none">
                            <div className="col-span-5 sm:col-span-5">Team Member</div>
                            <div className="hidden sm:block sm:col-span-2">People Role</div>
                            <div className="col-span-6 sm:col-span-4">Project Role</div>
                            <div className="col-span-1 text-right"></div>
                          </div>

                          {filteredUsers.map((u) => {
                            const uId = u._id || u.id;
                            const cleanCompanyRole = (u.role || "").replace(/\s+/g, "").toLowerCase();
                            const isCompanyAdmin = cleanCompanyRole === "superadmin" || cleanCompanyRole === "admin";
                            const currentProjectRole = getEffectiveProjectRole(u) || "Team Member";
                            const isSaving = savingUserId === uId;

                            return (
                              <div
                                key={uId}
                                className="grid grid-cols-12 gap-2 items-center rounded-xl px-3 py-2 border transition-all hover:bg-[var(--color-bg-hover)]/30"
                                style={{
                                  background: "var(--color-bg-secondary)",
                                  borderColor: "var(--color-border-primary)",
                                }}
                              >
                                {/* Col 1: Member Profile */}
                                <div className="col-span-5 sm:col-span-5 flex items-center gap-2.5 min-w-0">
                                  <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-sm"
                                    style={{
                                      background: "var(--gradient-gold-foil)",
                                      color: "var(--color-text-on-brand)",
                                    }}
                                  >
                                    {u.avatar ? (
                                      <img src={u.avatar} alt="" className="h-full w-full object-cover rounded-xl" />
                                    ) : (
                                      (u.name || "U").charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-heading truncate">
                                      {u.name || u.email}
                                    </p>
                                    <p className="text-[10px] text-muted truncate">{u.email}</p>
                                  </div>
                                </div>

                                {/* Col 2: People Portal Role */}
                                <div className="hidden sm:flex sm:col-span-2 items-center min-w-0">
                                  <span className="truncate rounded-md px-2 py-0.5 text-[10px] font-medium bg-[var(--color-bg-hover)] text-muted border border-[var(--color-border-primary)]">
                                    {u.role || "Employee"}
                                  </span>
                                </div>

                                {/* Col 3: Project Portal Role (Standard Website ModernSelect) */}
                                <div className="col-span-6 sm:col-span-4 flex items-center min-w-0">
                                  <div className="flex items-center gap-1.5 w-full">
                                    <div className="flex-1 min-w-0">
                                      <ModernSelect
                                        value={currentProjectRole}
                                        onChange={(e) => handleAssignUserRole(uId, e.target.value)}
                                        disabled={isSaving}
                                        options={PROJECT_ROLE_SELECT_OPTIONS}
                                        buttonClassName={"!py-1.5 !px-2.5 !text-xs !font-semibold !rounded-xl !min-h-[34px] !h-[34px] transition-colors " + (
                                          currentProjectRole === "Project Administrator"
                                            ? "!border-purple-500/30 !bg-purple-500/10 !text-purple-700 dark:!text-purple-300 hover:!border-purple-500/50"
                                            : currentProjectRole === "Project Manager"
                                            ? "!border-blue-500/30 !bg-blue-500/10 !text-blue-700 dark:!text-blue-300 hover:!border-blue-500/50"
                                            : "!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-700 dark:!text-emerald-300 hover:!border-emerald-500/50"
                                        )}
                                        className="w-full"
                                      />
                                    </div>
                                    {isSaving && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-brand-primary)] shrink-0" />
                                    )}
                                  </div>
                                </div>

                                {/* Col 4: Action (Revoke or Root Protection) */}
                                <div className="col-span-1 flex items-center justify-end">
                                  {isCompanyAdmin ? (
                                    <span
                                      className="p-1 text-muted/60 cursor-default"
                                      title="Company Administrator has root portal access"
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => handleRevokeAccess(uId)}
                                      title="Revoke Project Access"
                                      className="p-1 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Discreet Role Permissions Reference Guide ── */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowRoleGuide(!showRoleGuide)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-heading transition-colors cursor-pointer"
                        >
                          <HelpCircle className="h-3 w-3" />
                          <span>Role permissions guide</span>
                          <ChevronDown className={"h-3 w-3 transition-transform " + (showRoleGuide ? "rotate-180" : "")} />
                        </button>

                        {showRoleGuide && (
                          <div
                            className="mt-2 p-3 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] animate-fadeIn"
                            style={{
                              background: "var(--color-bg-secondary)",
                              borderColor: "var(--color-border-primary)",
                            }}
                          >
                            <div>
                              <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Project Administrator</span>
                              <p className="text-muted leading-relaxed">Full portfolio control, create & delete projects, configure settings, and manage all tasks.</p>
                            </div>
                            <div>
                              <span className="font-bold text-blue-600 dark:text-blue-400 block mb-0.5">Project Manager</span>
                              <p className="text-muted leading-relaxed">Oversee project execution, plan milestones, assign tasks, and track team progress.</p>
                            </div>
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Team Member</span>
                              <p className="text-muted leading-relaxed">Contribute to assigned tasks, log work hours, update status, and collaborate with team.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
{/* ─── ACCOUNT ─── */}
                {tab === "account" && (
                  <div>
                    <SectionHeading
                      icon={UserIcon}
                      title="Account"
                      subtitle="Your profile details and session."
                    />

                    <div
                      className="rounded-2xl px-4 py-2"
                      style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-primary)" }}
                    >
                      <InfoRow label="Name" value={user?.name} />
                      <InfoRow label="Email" value={user?.email} />
                      <InfoRow label="Role" value={role} />
                      <InfoRow label="Department" value={department} />
                      <InfoRow label="Designation" value={user?.designation} />
                      <InfoRow label="Employee ID" value={user?.empID} />
                    </div>

                    <div
                      className="mt-6 rounded-2xl p-4"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.28)" }}
                    >
                      {!confirmSignOut ? (
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ background: "var(--color-bg-secondary)", color: "#ef4444" }}
                          >
                            <LogOut className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold" style={{ color: "var(--color-text-heading)" }}>
                              Sign out
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                              End your session on this device.
                            </p>
                          </div>
                          <GlassButton variant="danger" size="sm" onClick={() => setConfirmSignOut(true)}>
                            Sign out
                          </GlassButton>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#ef4444" }} />
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-heading)" }}>
                              Are you sure you want to sign out?
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <GlassButton variant="secondary" size="sm" onClick={() => setConfirmSignOut(false)}>
                              Cancel
                            </GlassButton>
                            <GlassButton
                              variant="danger"
                              size="sm"
                              icon={LogOut}
                              onClick={handleLogout}
                            >
                              Sign out
                            </GlassButton>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
