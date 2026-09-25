import { useEffect, useState } from "react";
import {
  MapPin,
  Clock,
  Mail,
  Briefcase,
  Phone,
  GraduationCap,
  Camera,
  Pencil,
  Building2,
  Timer,
  UserCheck,
  Calendar,
  Cake,
  Heart,
  Home as HomeIcon,
  PhoneCall,
  Shield,
  Award,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../axios";
import { toast } from "react-toastify";
import PageContainer from "../../components/ui/PageContainer";
import Loader from "../../components/ui/Loader";

const DEFAULT_COVER =
  "https://data3262.blob.core.windows.net/hr-portal/abidiPro/users/profile_photos/Abidi-Solutions-Banner%201_1774560002057.jpg";

const formatMonthYear = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date)) return null;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const formatFullDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date)) return null;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const computeTenure = (value) => {
  if (!value) return null;
  const start = new Date(value);
  if (isNaN(start)) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return "New this month";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo${rem > 1 ? "s" : ""}`;
  if (rem === 0) return `${years} yr${years > 1 ? "s" : ""}`;
  return `${years} yr${years > 1 ? "s" : ""} ${rem} mo${rem > 1 ? "s" : ""}`;
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

const SectionHeading = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 border-b border-border-subtle pb-4 mb-6">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent text-on-brand shadow-sm flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <h3 className="text-sm font-black text-heading uppercase tracking-wider">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[10px] text-muted font-medium mt-0.5">{subtitle}</p>
      )}
    </div>
  </div>
);

export default function Profile({ userId: propUserId }) {
  const navigate = useNavigate();
  const { id: paramUserId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const targetUserId = propUserId || paramUserId;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        let response;
        if (targetUserId) {
          response = await api.get(`/users/${targetUserId}`, { withCredentials: true });
          setUser(response.data.user || response.data);
        } else {
          response = await api.get("/auth/me", { withCredentials: true });
          setUser(response.data.user);
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
        toast.error("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [targetUserId]);

  const handleAvatarUpload = async (e) => {
    if (targetUserId) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size must be less than 25MB");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setUploadingAvatar(true);
      const response = await api.post(`/users/${user._id}/upload-avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser((prev) => ({ ...prev, avatar: response.data.avatarUrl }));
      toast.success("Profile picture updated!");
    } catch {
      toast.error("Failed to update profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e) => {
    if (targetUserId) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size must be less than 25MB");
      return;
    }

    const formData = new FormData();
    formData.append("coverImage", file);

    try {
      setUploadingCover(true);
      const response = await api.post(`/users/${user._id}/upload-cover`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser((prev) => ({ ...prev, coverImage: response.data.coverUrl }));
      toast.success("Cover image updated!");
    } catch {
      toast.error("Failed to update cover image");
    } finally {
      setUploadingCover(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="User Profile" subtitle="View personal and professional details">
        <div className="text-center p-6 glass-card m-4">
          <Loader size="lg" text="Loading profile..." />
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer title="User Profile" subtitle="View personal and professional details">
        <div className="glass-card m-4 p-10 text-center">
          <p className="text-red-500 text-center text-sm font-medium">No user data available.</p>
        </div>
      </PageContainer>
    );
  }

  const departmentName =
    user.department?.name ||
    (typeof user.department === "string" ? user.department : null) ||
    "N/A";
  const reporter = user.reportsTo?.name || "Not Assigned";
  const joinedLabel = formatMonthYear(user.joiningDate);
  const tenureLabel = computeTenure(user.joiningDate);
  const dobLabel = formatFullDate(user.DOB);
  const roleLabel =
    typeof user.role === "string" ? user.role : user.role?.name || "Employee";
  const avatarSrc = user.avatar || "";
  const initials = getInitials(user.name);

  const stats = [
    { icon: Calendar, label: "Joined", value: joinedLabel || "—" },
    { icon: Timer, label: "Tenure", value: tenureLabel || "—" },
    { icon: Shield, label: "Employment", value: user.empType || "Permanent" },
    { icon: Award, label: "Role", value: roleLabel },
  ];

  const detailCards = [
    { icon: MapPin, label: "Branch / Location", value: user.branch || "N/A", accent: "bg-success-bg text-success" },
    { icon: Building2, label: "Department", value: departmentName, accent: "bg-warning-bg text-warning" },
    { icon: Clock, label: "Time Zone", value: user.timeZone || "N/A", accent: "bg-info-bg text-info" },
    { icon: Mail, label: "Email Address", value: user.email, accent: "bg-brand-primary/15 text-brand-text" },
    { icon: Phone, label: "Work Phone", value: user.phoneNumber || "N/A", accent: "bg-success-bg text-success" },
    { icon: UserCheck, label: "Reporting To", value: reporter, accent: "bg-info-bg text-info" },
  ];

  const personalCards = [
    { icon: Cake, label: "Date of Birth", value: dobLabel || "—", accent: "bg-brand-primary/15 text-brand-text" },
    { icon: Heart, label: "Marital Status", value: user.maritalStatus || "—", accent: "bg-danger-bg text-danger" },
    { icon: HomeIcon, label: "Address", value: user.address || "—", accent: "bg-warning-bg text-warning" },
  ];

  const avatarBlock = (
    <div className="relative rounded-full p-[3px] bg-gradient-to-br from-brand-primary via-brand-sec to-brand-accent shadow-lg shadow-brand-primary/20">
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={user.name}
          className="w-24 h-24 md:w-36 md:h-36 rounded-full object-cover ring-4 ring-surface bg-surface"
        />
      ) : (
        <>
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-full ring-4 ring-surface bg-gradient-to-br from-brand-primary to-brand-accent text-on-brand flex items-center justify-center text-3xl md:text-4xl font-black select-none">
            {initials}
          </div>
          <img
            src={`https://randomuser.me/api/portraits/lego/${user?._id ? user._id.length % 10 : 1}.jpg`}
            alt={user.name}
            className="w-24 h-24 md:w-36 md:h-36 rounded-full object-cover ring-4 ring-surface bg-surface absolute inset-0"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </>
      )}
      {!targetUserId && (
        <>
          <label
            htmlFor="avatar-upload"
            className="absolute -bottom-0.5 -right-0.5 bg-brand-primary text-on-brand p-2 rounded-full shadow-md cursor-pointer border-4 border-surface hover:scale-110 transition-transform"
            title="Change Profile Picture"
          >
            {uploadingAvatar ? (
              <Loader variant="spinner" size="sm" className="text-on-brand" />
            ) : (
              <Camera size={15} strokeWidth={2.5} />
            )}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
          />
        </>
      )}
    </div>
  );

  return (
    <PageContainer
      title="User Profile"
      subtitle="View personal and professional details"
    >
      <div className="pb-2">
        {/* ================= COVER & IDENTITY ================= */}
        <section className="relative">
          {/* Cover */}
          <div className="relative h-36 sm:h-48 md:h-56 rounded-[2rem] overflow-hidden shadow-md border border-border-subtle">
            <img
              src={user.coverImage || DEFAULT_COVER}
              alt="Cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = DEFAULT_COVER;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/25 via-transparent to-brand-accent/10" />

            {!targetUserId && (
              <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-2 z-30">
                <label
                  htmlFor="cover-upload"
                  className="inline-flex items-center justify-center gap-2 bg-surface/85 backdrop-blur-md text-heading font-bold text-xs w-9 h-9 md:w-10 md:h-10 rounded-xl shadow-sm border border-border-subtle hover:border-border-accent hover:translate-y-[-1px] transition-all cursor-pointer"
                  title="Change Cover Image"
                >
                  {uploadingCover ? (
                    <Loader variant="spinner" size="sm" className="text-brand-text" />
                  ) : (
                    <Camera size={16} />
                  )}
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                />

                <button
                  onClick={() => navigate("/people/edit-profile")}
                  className="inline-flex items-center gap-2 bg-surface/85 backdrop-blur-md text-heading font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-xl shadow-sm border border-border-subtle hover:border-border-accent hover:translate-y-[-1px] transition-all text-xs"
                >
                  <Pencil size={15} />
                  <span className="hidden sm:inline">Edit Profile</span>
                </button>
              </div>
            )}
          </div>

          {/* Avatar overlapping cover */}
          <div className="absolute left-5 md:left-8 -bottom-10 md:-bottom-12 z-20">
            {avatarBlock}
          </div>
        </section>

        {/* ---------- Identity panel ---------- */}
        <section className="relative z-10 bg-surface rounded-[2rem] shadow-sm border border-border-subtle p-5 md:p-6 pt-20 md:pt-6 md:pl-56">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-black text-xl md:text-2xl text-heading tracking-tight break-words">
              {user.name}
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-brand-primary/15 text-brand-text border border-brand-primary/20">
              {roleLabel}
            </span>
            {user.empStatus && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  user.empStatus === "Active"
                    ? "bg-success-bg text-success border-success-border"
                    : user.empStatus === "Pending"
                    ? "bg-warning-bg text-warning border-warning-border"
                    : "bg-danger-bg text-danger border-danger-border"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {user.empStatus}
              </span>
            )}
          </div>

          <p className="text-muted font-bold text-xs uppercase tracking-wider mt-1.5">
            {user.designation || "Team Member"}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase size={13} className="text-brand-text" />
              <span className="font-mono font-semibold">{user.empID || "ID: --"}</span>
            </span>
            {joinedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-text" />
                Joined {joinedLabel}
              </span>
            )}
          </div>
        </section>

        {/* ================= STATS STRIP ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 bg-surface rounded-2xl border border-border-subtle px-4 py-3.5 shadow-sm hover:shadow-md hover:border-border-accent transition-all min-w-0"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent text-on-brand shadow-sm flex items-center justify-center">
                <stat.icon size={18} strokeWidth={2.4} />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest truncate">
                  {stat.label}
                </p>
                <p className="text-sm font-bold text-heading truncate" title={stat.value}>
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ================= DETAIL CARDS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 mt-4">
          {detailCards.map((item, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-3 bg-surface rounded-2xl border border-border-subtle p-4 shadow-sm hover:shadow-md hover:border-border-accent transition-all min-w-0"
            >
              <div
                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl shadow-sm group-hover:scale-105 transition-transform ${item.accent}`}
              >
                <item.icon size={19} strokeWidth={2.3} />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest truncate">
                  {item.label}
                </p>
                <p className="text-sm font-bold text-main truncate" title={item.value}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ================= PERSONAL CARDS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-4">
          {personalCards.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 bg-surface rounded-2xl border border-border-subtle p-4 shadow-sm hover:shadow-md hover:border-border-accent transition-all min-w-0"
            >
              <div
                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl shadow-sm ${item.accent}`}
              >
                <item.icon size={19} strokeWidth={2.3} />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest truncate">
                  {item.label}
                </p>
                <p className="text-sm font-bold text-main break-words" title={item.value}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ================= EMERGENCY CONTACTS ================= */}
        {user.emergencyContact?.length > 0 && (
          <div className="bg-surface rounded-[2rem] shadow-sm border border-border-subtle p-6 mt-4 hover:shadow-md hover:border-border-accent transition-all">
            <SectionHeading icon={<PhoneCall size={18} strokeWidth={2.4} />} title="Emergency Contacts" subtitle="People to reach in case of an emergency" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {user.emergencyContact
                .filter((contact) => contact.name || contact.phone)
                .map((contact, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-card border border-border-subtle rounded-2xl p-4"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-brand-primary/25 to-brand-accent/25 text-brand-text dark:text-brand-primary flex items-center justify-center font-black text-sm">
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-heading truncate">
                        {contact.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {[contact.relation, contact.phone].filter(Boolean).join(" • ") || "—"}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================= ABOUT ================= */}
        {user.about && (
          <div className="bg-surface rounded-[2rem] shadow-sm border border-border-subtle p-6 mt-4 hover:shadow-md hover:border-border-accent transition-all">
            <SectionHeading icon={<UserCheck size={18} strokeWidth={2.4} />} title="About" subtitle="A short introduction" />
            <div className="relative pl-5 border-l-2 border-brand-primary/30">
              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-brand-primary ring-4 ring-brand-primary/20" />
              <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">
                {user.about}
              </p>
            </div>
          </div>
        )}

        {/* ================= EXPERIENCE & EDUCATION ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Experience */}
          <div className="bg-surface rounded-[2rem] shadow-sm border border-border-subtle p-6 hover:shadow-md hover:border-border-accent transition-all">
            <SectionHeading icon={<Briefcase size={18} strokeWidth={2.4} />} title="Experience" subtitle="Professional journey" />
            <div className="space-y-6">
              {user.experience?.length > 0 ? (
                user.experience.map((exp, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2 border-border-subtle">
                    <span className="absolute -left-[6px] top-1 w-3 h-3 rounded-full bg-brand-primary ring-4 ring-brand-primary/20" />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h4 className="font-bold text-sm text-heading">{exp.company}</h4>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-text">
                        {exp.jobType || "Full-time"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted uppercase font-bold tracking-wide mt-1.5 mb-2">
                      {exp.startDate ? formatMonthYear(exp.startDate) : "—"} –{" "}
                      {exp.endDate ? formatMonthYear(exp.endDate) : "Present"}
                    </p>
                    {exp.description && (
                      <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted text-xs italic">No experience added yet.</p>
              )}
            </div>
          </div>

          {/* Education */}
          <div className="bg-surface rounded-[2rem] shadow-sm border border-border-subtle p-6 hover:shadow-md hover:border-border-accent transition-all">
            <SectionHeading icon={<GraduationCap size={18} strokeWidth={2.4} />} title="Education" subtitle="Academic background" />
            <div className="space-y-6">
              {user.education?.length > 0 ? (
                user.education.map((edu, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2 border-border-subtle">
                    <span className="absolute -left-[6px] top-1 w-3 h-3 rounded-full bg-brand-accent ring-4 ring-brand-accent/20" />
                    <h4 className="font-bold text-sm text-heading">{edu.degree}</h4>
                    <p className="text-xs text-muted font-medium mt-0.5 mb-1.5">
                      {edu.institution}
                    </p>
                    <p className="text-[10px] text-muted uppercase font-bold tracking-wide">
                      {edu.startYear || "—"} – {edu.endYear || "Present"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted text-xs italic">No education added yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}