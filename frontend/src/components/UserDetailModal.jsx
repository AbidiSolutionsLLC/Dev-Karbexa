import React, { useState, useEffect } from "react";
import api from "../axios";
import { FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import CreateDepartmentModal from "./CreateDepartmentModal";
import ModernSelect from "./ui/ModernSelect";
import ModernDatePicker from "./ui/ModernDatePicker";
import { validateText, validateEmail, validatePhone, sanitizeText } from "../utils/validationUtils";
import GlassModal from "./ui/GlassModal";
import GlassButton from "./ui/GlassButton";
import { useConfirm } from "../context/ConfirmContext";

const UserDetailModal = ({ user, currentUser, isOpen, onClose, onUserUpdated, allManagers, allDepartments }) => {
 const confirm = useConfirm();
 const [isEditing, setIsEditing] = useState(false);
 const [formData, setFormData] = useState({});
 const [isLoading, setIsLoading] = useState(false);
 const [isDeleting, setIsDeleting] = useState(false);
 const [isResending, setIsResending] = useState(false);
 const [errors, setErrors] = useState({});
 const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

 // ================== INIT FORM ==================
 useEffect(() => {
 if (user && isOpen) {
 const [fName, ...lNameParts] = (user.name || "").split(" ");
 setFormData({
 firstName: fName || "",
 lastName: lNameParts.join(" ") || "",
 email: user.email || "",
 designation: user.designation || "",
 department: user.department?._id || "",
 reportsTo: user.reportsTo?._id || "",
 role: user.role || "Employee",
 empType: user.empType || "Permanent",
 endDate: user.endDate?.split("T")[0] || "",
 joiningDate: user.joiningDate?.split("T")[0] || "",
 phoneNumber: user.phoneNumber || "",
 branch: user.branch || "Karachi",
 timeZone: user.timeZone || "America/New_York",
 empStatus: user.empStatus || "Pending",
 isTechnician: user.isTechnician || false,
 hourlyWage: user.hourlyWage || ""
 });
 setErrors({});
 setIsEditing(false);
 }
 }, [user, isOpen]);

 // ================== VALIDATION ==================
 const validateField = (name, value) => {
 let error = "";
 switch (name) {
      case "firstName":
        if (!value || !value.trim()) { error = "First name is required"; break; }
        error = validateText(value);
        if (!error && value.length < 2) error = "Min 2 characters";
        if (!error && !/^[a-zA-Z\s'-]+$/.test(value)) error = "Only letters allowed.";
        break;
      case "lastName":
        if (!value || !value.trim()) { error = "Last name is required"; break; }
        error = validateText(value);
        if (!error && value.length < 2) error = "Min 2 characters";
        if (!error && !/^[a-zA-Z\s'-]+$/.test(value)) error = "Only letters allowed.";
        break;
 case "email":
 error = validateEmail(value);
 break;
 case "phoneNumber":
 error = validatePhone(value, false);
 break;
 case "designation":
 error = value.trim() ? "" : "Designation is required";
 break;
 case "branch":
 error = value.trim() ? "" : "Branch is required";
 break;
 case "hourlyWage":
 error = (value === "" || value == null || value >= 0) ? "" : "Invalid wage";
 break;
 default:
 break;
 }
 setErrors(prev => ({ ...prev, [name]: error }));
 return error;
 };

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => {
 const updated = { ...prev, [name]: value };
 if (name === "empType" && value !== "Contractor" && value !== "Intern") {
 updated.endDate = "";
 }
 return updated;
 });
 validateField(name, value);
 };

 const validateForm = () => {
 const fieldsToValidate = ["firstName", "lastName", "email", "phoneNumber", "designation", "branch", "hourlyWage"];
 const newErrors = {};
 fieldsToValidate.forEach(field => {
 const error = validateField(field, formData[field]);
 if (error) newErrors[field] = error;
 });
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 // ================== SUBMIT ==================
 const handleSubmit = async (e) => {
 e.preventDefault();

 if (user && currentUser && user._id === currentUser._id) {
 toast.error("You cannot edit yourself", { toastId: "self-edit-error" });
 setIsEditing(false);
 return;
 }

 const restrictedRoles = ['Super Admin', 'Admin'];
 if ((currentUser.role === 'Admin' || currentUser.role === 'HR') && restrictedRoles.includes(user.role)) {
 toast.error("Permission Denied: You cannot modify Admins or Super Admins.");
 setIsEditing(false);
 return;
 }

 if (!validateForm()) return toast.error("Fix validation errors");

 setIsLoading(true);
 try {
 const changedFields = {};

 Object.keys(formData).forEach(key => {
 let original = user[key];
 let current = formData[key];

 if (key === "firstName" || key === "lastName") {
 const fullName = sanitizeText(`${formData.firstName} ${formData.lastName}`);
 if (fullName !== user.name) changedFields.name = fullName;
 return;
 }

 if (key === "department") original = user.department?._id || "";
 if (key === "reportsTo") original = user.reportsTo?._id || "";
 if (key === "joiningDate") original = user.joiningDate?.split("T")[0] || "";
 if (key === "endDate") original = user.endDate?.split("T")[0] || "";
 if (key === "hourlyWage") original = user.hourlyWage || "";

 if (original == null) original = "";
 if (current == null) current = "";

 if (key === "isTechnician") {
 const currentBool = typeof current === "string" ? current === "true" : Boolean(current);
 if (currentBool !== Boolean(original)) changedFields[key] = currentBool;
 } else if (key === "hourlyWage") {
 const parsedCurrent = current === "" || current == null ? 0 : parseFloat(current);
 const parsedOriginal = original === "" || original == null ? 0 : parseFloat(original);
 if (parsedCurrent !== parsedOriginal) changedFields[key] = parsedCurrent;
 } else {
 if (String(current) !== String(original)) changedFields[key] = current;
 }
 });

 if (!Object.keys(changedFields).length) {
 toast.info("No changes to save");
 setIsEditing(false);
 return;
 }

 await api.put(`/users/${user._id}`, changedFields);
 onUserUpdated();
 onClose();
 setIsEditing(false);
 } catch (err) {
 console.error(err);
 toast.error(err.response?.data?.message || "Update failed");
 } finally {
 setIsLoading(false);
 }
 };

 // ================== ACTIONS ==================
 const handleDeleteUser = async () => {
 await confirm({ 
  title: "Delete User", 
  message: `Delete ${user.name}?`,
  onConfirmAction: async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/users/${user._id}`);
      toast.success("Deleted");
      onUserUpdated("delete");
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }
 });
 };
 const handleResendInvite = async () => {
 setIsResending(true);
 try {
 await api.post(`/users/${user._id}/resend-invite`);
 toast.success("Invite resent");
 } catch (err) {
 toast.error(err.response?.data?.message || "Failed to resend invite");
 } finally {
 setIsResending(false);
 }
 };

 // ================== FIELD RENDER ==================
 const renderField = (label, name, value, type = "text", options = [], required = true) => {
 const error = errors[name];
 const formattedOptions = options.map(opt => ({
 value: opt.value || opt._id,
 label: opt.label || opt.name?.toUpperCase()
 }));

 if (isEditing) {
 if (type === "select") {
 if (name === "department") {
 return (
 <div className="flex gap-2 items-end">
 <ModernSelect label={label} name={name} value={value} onChange={handleChange} options={formattedOptions} required={required} placeholder={`SELECT ${label}`} className="flex-1" />
 <button 
 type="button" 
 onClick={() => setIsDeptModalOpen(true)} 
 className="h-[46px] px-4 bg-brand-primary/10 rounded-xl text-brand-primary hover:bg-brand-primary/20 transition-colors"
 >
 <FaPlus />
 </button>
 </div>
 );
 }
 return <ModernSelect label={label} name={name} value={value} onChange={handleChange} options={formattedOptions} required={required} placeholder={`SELECT ${label}`} />;
 }

 if (type === "date") return <ModernDatePicker label={label} name={name} value={value} onChange={handleChange} />;

 return (
 <div>
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase tracking-widest">{label}</label>
 <input
 type={type}
 name={name}
 value={value}
 onChange={handleChange}
 className={`glass-input w-full ${error ? "border-red-400 ring-1 ring-red-400" : ""}`}
 />
 {error && <p className="text-[10px] text-red-500 mt-1 font-bold">{error}</p>}
 </div>
 );
 }

 // VIEW MODE
 return (
 <div>
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-1 uppercase tracking-widest">{label}</label>
 <div className="glass-input px-4 py-3 text-sm min-h-[44px] flex items-center bg-surface/50 dark:bg-slate-800/50">
 {name === "department" ? allDepartments.find(d => d._id === value)?.name :
 name === "reportsTo" ? allManagers.find(m => m._id === value)?.name :
 (name === "joiningDate" || name === "endDate") ? (value ? new Date(value).toLocaleDateString() : "-") :
 name === "hourlyWage" ? `$${value}/hr` :
 value || "-"}
 </div>
 </div>
 );
 };

 const canDelete = currentUser && ["Super Admin", "Admin"].includes(currentUser.role);
 const canEdit = currentUser && ["Super Admin", "Admin", "HR"].includes(currentUser.role);

 const headerActions = (
 <div className="flex gap-2">
 {!isEditing && <GlassButton variant="secondary" size="sm" onClick={handleResendInvite} isLoading={isResending}>Invite</GlassButton>}
 {!isEditing && canDelete && <GlassButton variant="danger" size="sm" onClick={handleDeleteUser} isLoading={isDeleting}>Delete</GlassButton>}
 {canEdit && <GlassButton variant="secondary" size="sm" onClick={() => setIsEditing(!isEditing)}>{isEditing ? "Cancel Edit" : "Edit"}</GlassButton>}
 </div>
 );

 return (
 <>
 <GlassModal
 isOpen={isOpen}
 onClose={() => {
 onClose();
 setIsEditing(false);
 }}
 title={<div className="flex items-center gap-4">{user?.name} {headerActions}</div>}
 maxWidth="max-w-4xl"
 footer={isEditing ? (
 <>
 <GlassButton variant="ghost" onClick={() => setIsEditing(false)}>
 Cancel
 </GlassButton>
 <GlassButton variant="primary" onClick={handleSubmit} isLoading={isLoading}>
 {isLoading ? "Saving..." : "Save Changes"}
 </GlassButton>
 </>
 ) : null}
 >
 <form onSubmit={handleSubmit} className="space-y-6">

 <div>
 <h3 className="font-bold text-muted dark:text-muted text-xs uppercase mb-3 border-b border-border-subtle pb-2">Personal</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {isEditing ? (
 <>
 {renderField("First Name", "firstName", formData.firstName)}
 {renderField("Last Name", "lastName", formData.lastName)}
 </>
 ) : (
 renderField("Full Name", "name", user?.name)
 )}
 {renderField("Email", "email", formData.email, "email")}
 {renderField("Phone", "phoneNumber", formData.phoneNumber)}
 </div>
 </div>

 <div>
 <h3 className="font-bold text-muted dark:text-muted text-xs uppercase mb-3 border-b border-border-subtle pb-2">Employment</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {renderField("Status", "empStatus", formData.empStatus, "select", ["Active", "Inactive", "Pending"].map(v => ({ value: v, label: v })))}
 {renderField("Role", "role", formData.role, "select", ["Employee", "Manager", "HR", "Admin", "Super Admin"].map(v => ({ value: v, label: v })))}
 {renderField("Designation", "designation", formData.designation)}
 {renderField("Hourly Wage", "hourlyWage", formData.hourlyWage, "number")}
 {renderField("Type", "empType", formData.empType, "select", ["Permanent", "Contractor", "Intern", "Part Time"].map(v => ({ value: v, label: v })))}
 {renderField("Department", "department", formData.department, "select", allDepartments)}
 {renderField("Reports To", "reportsTo", formData.reportsTo, "select", allManagers)}
 {renderField("Is Technician?", "isTechnician", String(formData.isTechnician === "true" || formData.isTechnician === true), "select", [{ value: "true", label: "Yes" }, { value: "false", label: "No" }])}
 </div>
 </div>

 <div>
 <h3 className="font-bold text-muted dark:text-muted text-xs uppercase mb-3 border-b border-border-subtle pb-2">Company</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {renderField("Joining Date", "joiningDate", formData.joiningDate, "date")}
 {(formData.empType === "Contractor" || formData.empType === "Intern") && renderField("End Date", "endDate", formData.endDate, "date")}
 {renderField("Branch", "branch", formData.branch)}
 {renderField("Timezone", "timeZone", formData.timeZone, "select", ["America/New_York", "Asia/Karachi", "Europe/London", "Asia/Dubai"].map(v => ({ value: v, label: v })))}
 </div>
 </div>

 </form>
 </GlassModal>

 <CreateDepartmentModal
 isOpen={isDeptModalOpen}
 onClose={() => setIsDeptModalOpen(false)}
 onDepartmentCreated={onUserUpdated}
 potentialManagers={allManagers}
 />
 </>
 );
};

export default UserDetailModal;