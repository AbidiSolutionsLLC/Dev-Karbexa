import React, { useState, useEffect } from "react";
import api from "../axios";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ModernSelect from "./ui/ModernSelect";
import GlassModal from "./ui/GlassModal";
import GlassButton from "./ui/GlassButton";

export default function AdminAddAttendanceModal({ open, onClose, onSuccess, allUsers }) {
 const [formData, setFormData] = useState({
 user: "",
 checkInTime: null,
 checkOutTime: null,
 status: "Present",
 notes: ""
 });
 const [errors, setErrors] = useState({});
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (open) {
 setFormData({
 user: "",
 checkInTime: new Date(),
 checkOutTime: new Date(),
 status: "Present",
 notes: ""
 });
 setErrors({});
 }
 }, [open]);

 const handleSubmit = async (e) => {
 if (e) e.preventDefault();
 const newErrors = {};
 if (!formData.user) newErrors.user = "Employee name is required";
 if (!formData.checkInTime) newErrors.checkInTime = "Check-in time is required.";
 
 if (formData.checkInTime && formData.checkOutTime) {
 if (new Date(formData.checkOutTime) <= new Date(formData.checkInTime)) {
 newErrors.checkOutTime = "Check-out cannot be before check-in";
 }
 }

 const now = new Date();
 if (formData.checkInTime && new Date(formData.checkInTime) > now) {
 newErrors.checkInTime = "Check-in time cannot be in the future";
 }
 if (formData.checkOutTime && new Date(formData.checkOutTime) > now) {
 newErrors.checkOutTime = "Check-out time cannot be in the future";
 }
 
 setErrors(newErrors);
 if (Object.keys(newErrors).length > 0) {
 const firstError = Object.values(newErrors)[0];
 toast.error(firstError);
 return;
 }

 setLoading(true);
 try {
 await api.post("/timetrackers", {
 user: formData.user,
 checkInTime: formData.checkInTime,
 checkOutTime: formData.checkOutTime,
 status: formData.status,
 notes: formData.notes,
 date: formData.checkInTime // use checkInTime as the base date
 });
 toast.success("Attendance record created successfully");
 if (onSuccess) onSuccess();
 onClose();
 } catch (error) {
 toast.error(error.response?.data?.message || "Failed to create attendance");
 } finally {
 setLoading(false);
 }
 };

 return (
 <GlassModal
 isOpen={open}
 onClose={onClose}
 title="ADD ATTENDANCE RECORD"
 maxWidth="max-w-lg"
 footer={
 <>
 <GlassButton variant="ghost" onClick={onClose} disabled={loading}>
 CANCEL
 </GlassButton>
 <GlassButton 
 variant="primary" 
 onClick={handleSubmit} 
 isLoading={loading}
 >
 {loading ? "SAVING..." : "CREATE RECORD"}
 </GlassButton>
 </>
 }
 >
 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="relative z-50">
 <ModernSelect
 label="Employee"
 name="user"
 value={formData.user}
 onChange={(e) => {
 setFormData({ ...formData, user: e.target.value });
 setErrors(prev => ({ ...prev, user: e.target.value ? null : "Employee name is required" }));
 }}
 required
 placeholder="Select Employee"
 options={[
 { value: "", label: "Select Employee" },
 ...allUsers.map((u) => ({ value: u._id, label: `${u.name} (${u.email})` }))
 ]}
 className={`w-full ${errors.user ? "border-red-400" : ""}`}
 />
 {errors.user && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.user}</p>}
 </div>

 <div className="relative z-40">
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase tracking-widest">
 CHECK IN TIME*
 </label>
 <DatePicker
 selected={formData.checkInTime}
 onChange={(date) => {
 setFormData({ ...formData, checkInTime: date });
 setErrors(prev => ({ ...prev, checkInTime: date ? null : "Check-in time is required." }));
 }}
 showTimeSelect
 dateFormat="Pp"
 className={`glass-input w-full cursor-pointer ${errors.checkInTime ? "border-red-400 ring-1 ring-red-400" : ""}`}
 popperProps={{ strategy: "fixed" }}
 portalId="portal-root"
 required
 />
 {errors.checkInTime && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.checkInTime}</p>}
 </div>

 <div className="relative z-30">
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase tracking-widest">
 CHECK OUT TIME
 </label>
 <DatePicker
 selected={formData.checkOutTime}
 onChange={(date) => setFormData({ ...formData, checkOutTime: date })}
 showTimeSelect
 dateFormat="Pp"
 className="glass-input w-full cursor-pointer"
 popperProps={{ strategy: "fixed" }}
 portalId="portal-root"
 />
 </div>

  <div className="relative z-20">
  <ModernSelect
  label="Status"
  name="status"
  value={formData.status}
  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
  options={[
  { value: "Present", label: "Present" },
  { value: "Half Day", label: "Half Day" },
  { value: "Absent", label: "Absent" },
  { value: "On Leave", label: "On Leave" }
  ]}
  className="w-full"
  />
  </div>
 
 <div className="relative z-10">
 <label className="block text-[10px] font-black text-muted dark:text-muted mb-2 uppercase tracking-widest">
 NOTES
 </label>
 <input
 type="text"
 value={formData.notes}
 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
 placeholder="e.g. Forgot to punch in"
 className="glass-input w-full"
 />
 </div>
 </form>
 </GlassModal>
 );
}
