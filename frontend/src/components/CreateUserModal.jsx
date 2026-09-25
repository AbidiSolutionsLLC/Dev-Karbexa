import React, { useState, useRef, useEffect } from "react";
import api from "../axios";
import { toast } from "react-toastify";
import CreateDepartmentModal from "./CreateDepartmentModal";
import { FaPlus, FaCheck } from "react-icons/fa";
import ModernSelect from "./ui/ModernSelect";
import ModernDatePicker from "./ui/ModernDatePicker";
import { validateText, validateEmail, validatePassword, validatePhone, sanitizeText } from "../utils/validationUtils";
import GlassModal from "./ui/GlassModal";
import GlassButton from "./ui/GlassButton";
import { dispatchReadOnlyModal } from "../utils/readOnlyEvent";

const CreateUserModal = ({ isOpen, setIsOpen, onUserCreated, allDepartments, allManagers }) => {
 const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [currentUser, setCurrentUser] = useState(null);

 const initialFormState = {
 firstName: "",
 lastName: "",
 email: "",
 password: "",
 designation: "",
 department: "",
 reportsTo: "",
 role: "Employee",
 empType: "Permanent",
 endDate: "",
 joiningDate: "",
 phoneNumber: "",
 branch: "Karachi",
 timeZone: "America/New_York",
 isTechnician: false,
 hourlyWage: "",
 };

 const [formData, setFormData] = useState(initialFormState);
 const [errors, setErrors] = useState({});

 useEffect(() => {
 const fetchMe = async () => {
 try {
 const res = await api.get("/auth/me");
 setCurrentUser(res.data.user);
 } catch {}
 };
 if (isOpen) fetchMe();
 }, [isOpen]);

 const validateField = (name, value) => {
 let error = null;
 switch (name) {
 case "firstName":
 if (!value || !value.trim()) { error = "First name is required"; break; }
 error = validateText(value);
 if (!error && value.length < 2) error = "Must be at least 2 characters.";
 if (!error && !/^[a-zA-Z\s'-]+$/.test(value)) error = "Only letters allowed.";
 break;
 case "lastName":
 if (!value || !value.trim()) { error = "Last name is required"; break; }
 error = validateText(value);
 if (!error && value.length < 2) error = "Must be at least 2 characters.";
 if (!error && !/^[a-zA-Z\s'-]+$/.test(value)) error = "Only letters allowed.";
 break;
 case "email":
 error = validateEmail(value);
 break;
 case "password":
 error = validatePassword(value);
 break;
 case "phoneNumber":
 error = validatePhone(value, true);
 break;
 case "department":
 error = value ? null : "Department is required.";
 break;
 case "reportsTo":
 error = value ? null : "Reporting manager is required.";
 break;
 default:
 break;
 }
 setErrors(p => ({ ...p, [name]: error }));
 return error;
 };

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData((p) => {
 const updated = { ...p, [name]: value };
 if (name === 'empType' && value !== 'Contractor' && value !== 'Intern') {
 updated.endDate = "";
 }
 return updated;
 });
 // Validate on change for better UX
 validateField(name, value);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (currentUser?.role === "Global Reader") {
   dispatchReadOnlyModal();
   return;
 }
 
 // Validate all fields
 const fNameError = validateField("firstName", formData.firstName);
 const lNameError = validateField("lastName", formData.lastName);
 const emailError = validateField("email", formData.email);
 const passError = validateField("password", formData.password);
 const phoneError = validateField("phoneNumber", formData.phoneNumber);

 const deptError = validateField("department", formData.department);
 const reportsToError = validateField("reportsTo", formData.reportsTo);

 if (fNameError || lNameError || emailError || passError || phoneError || deptError || reportsToError) {
 toast.error("Please fix errors before submitting.");
 return;
 }

 setIsLoading(true);
 try {
 const submissionData = {
 ...formData,
 name: sanitizeText(`${formData.firstName} ${formData.lastName}`),
 email: formData.email.toLowerCase()
 };
 // Remove local fields not in model
 delete submissionData.firstName;
 delete submissionData.lastName;

 await api.post("/users", submissionData);
 onUserCreated();
 setIsOpen(false);
 setFormData(initialFormState);
 setErrors({});
 toast.success("User created successfully");
 } catch (err) {
 toast.error(err.response?.data?.message || "Failed to create user");
 } finally {
 setIsLoading(false);
 }
 };

  const baseRoles = [
    { value: "Employee", label: "EMPLOYEE" },
    { value: "Technician", label: "TECHNICIAN" },
    { value: "Manager", label: "MANAGER" },
    { value: "HR", label: "HR" },
    { value: "Admin", label: "ADMIN" },
    { value: "Super Admin", label: "SUPER ADMIN" },
    { value: "Global Reader", label: "GLOBAL READER" },
  ];

 const filteredRoles =
 currentUser?.role === "Admin"
 ? baseRoles.filter((r) => r.value !== "Super Admin")
 : baseRoles;

 return (
 <>
 <GlassModal
 isOpen={isOpen}
 onClose={() => setIsOpen(false)}
 title="Create New User"
 maxWidth="max-w-3xl"
 footer={
 <>
 <GlassButton variant="ghost" onClick={() => setIsOpen(false)}>
 Cancel
 </GlassButton>
 <GlassButton variant="primary" onClick={handleSubmit} isLoading={isLoading}>
 {isLoading ? "Creating..." : "Create User"}
 </GlassButton>
 </>
 }
 >
 <form id="create-user-form" onSubmit={handleSubmit} className="space-y-6">

 {/* Name + Email */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" error={errors.firstName} required />
 <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" error={errors.lastName} required />
 <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" error={errors.email} required />
 </div>

 {/* Password + Phone */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="********" error={errors.password} required />
 <Input label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+1234567890" error={errors.phoneNumber} required />
 </div>

 {/* Role + Designation + Technician */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <ModernSelect label="Role" name="role" value={formData.role} onChange={handleChange} options={filteredRoles} error={errors.role} />

 <Input label="Designation" name="designation" value={formData.designation} onChange={handleChange} placeholder="Senior Developer" />

 <div>
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase">Technician</label>
 <div
 onClick={() => setFormData((p) => ({ ...p, isTechnician: !p.isTechnician }))}
 className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-colors ${
 formData.isTechnician ? "bg-brand-primary/10 border-brand-primary" : "border-border-subtle hover:bg-surface/50"
 }`}
 >
 <div className={`w-5 h-5 border rounded flex items-center justify-center ${
 formData.isTechnician ? "bg-brand-primary border-brand-primary" : "border-subtle"
 }`}>
 {formData.isTechnician && <FaCheck className="text-white w-3 h-3" />}
 </div>
 <span className="text-sm text-heading dark:text-white">Assign as Technician</span>
 </div>
 </div>
 </div>

 {/* Department + ReportsTo + Wage */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="flex gap-2 items-end">
 <ModernSelect
 label="Department"
 name="department"
 value={formData.department}
 onChange={handleChange}
 options={allDepartments.map((d) => ({ value: d._id, label: d.name }))}
 error={errors.department}
 />
 <button 
 type="button" 
 onClick={() => setIsDeptModalOpen(true)} 
 className="h-[46px] px-4 bg-brand-primary/10 rounded-xl text-brand-primary hover:bg-brand-primary/20 transition-colors"
 aria-label="Add Department"
 >
 <FaPlus />
 </button>
 </div>

 <ModernSelect
 label="Reports To"
 name="reportsTo"
 value={formData.reportsTo}
 onChange={handleChange}
 options={allManagers.map((m) => ({ value: m._id, label: m.name }))}
 error={errors.reportsTo}
 />

 <Input label="Hourly Wage" name="hourlyWage" type="number" value={formData.hourlyWage} onChange={handleChange} placeholder="25.50" />
 </div>

 {/* Type + Joining Date + Branch + Timezone */}
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
 <ModernSelect
 label="Employee Type"
 name="empType"
 value={formData.empType}
 onChange={handleChange}
 options={[
 { value: "Permanent", label: "Permanent" },
 { value: "Contractor", label: "Contractor" },
 { value: "Intern", label: "Intern" },
 { value: "Part Time", label: "Part Time" },
 ]}
 />

 <div className="grid grid-cols-1 gap-4">
 <ModernDatePicker label="Joining Date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} />
 {(formData.empType === "Contractor" || formData.empType === "Intern") && (
 <ModernDatePicker label="End Date" name="endDate" value={formData.endDate} onChange={handleChange} />
 )}
 </div>

 <Input label="Branch" name="branch" value={formData.branch} onChange={handleChange} placeholder="New York Office" />

 <ModernSelect
 label="Timezone"
 name="timeZone"
 value={formData.timeZone}
 onChange={handleChange}
 options={[
 { value: "America/New_York", label: "America/New_York (Eastern US & Canada)" },
 { value: "Asia/Karachi", label: "Asia/Karachi" },
 { value: "Europe/London", label: "Europe/London" },
 ]}
 />
 </div>
 </form>
 </GlassModal>

 <CreateDepartmentModal
 isOpen={isDeptModalOpen}
 onClose={() => setIsDeptModalOpen(false)}
 onDepartmentCreated={onUserCreated}
 potentialManagers={allManagers}
 />
 </>
 );
};

export default CreateUserModal;

/* Input Component */
const Input = ({ label, error, ...props }) => (
 <div>
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase tracking-widest">
 {label}
 </label>
 <input
 className={`glass-input w-full ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}
 {...props}
 />
 {error && <p className="text-[10px] text-red-500 mt-1 font-bold">{error}</p>}
 </div>
);