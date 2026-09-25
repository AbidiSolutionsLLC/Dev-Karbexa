import React, { useState, useEffect } from "react";
import PageContainer from "../../components/ui/PageContainer";
import GlassModal from "../../components/ui/GlassModal";
import TableWithPagination from "../../components/TableWithPagination";
import ModernSelect from "../../components/ui/ModernSelect";
import api from "../../axios";
import { toast } from "react-toastify";
import Loader from "../../components/ui/Loader";
import { Plus, X, Search, ShieldCheck, Eye, Edit2, Trash2 } from "lucide-react";
import { useConfirm } from "../../context/ConfirmContext";

const TenantManagement = () => {
  const confirm = useConfirm();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const initialFormState = {
    companyName: "",
    companyOwner: "",
    contactNo: "",
    companyEmail: "",
    website: "",
    address: "",
    noOfEmployees: "",
    companyType: "Tech",
    customCompanyType: "",
    adminPassword: "",
    maxUsers: 50,
    timezone: "America/New_York",
    currency: "USD",
    azureTenantId: "",
    azureClientId: "",
    emailProvider: "Default",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    subscriptionStatus: "Active"
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/master/companies");
      setCompanies(res.data || []);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("Access Denied: Master Tenant Only");
      } else {
        toast.error("Failed to load companies");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const finalCompanyType = formData.companyType === "Other" && formData.customCompanyType 
        ? formData.customCompanyType 
        : formData.companyType;

      const payload = {
        companyName: formData.companyName,
        companyOwner: formData.companyOwner,
        contactNo: formData.contactNo,
        companyEmail: formData.companyEmail,
        website: formData.website,
        address: formData.address,
        noOfEmployees: formData.noOfEmployees,
        ...formData,
        companyType: finalCompanyType,
        emailConfig: {
          provider: formData.emailProvider,
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpUser: formData.smtpUser,
          smtpPass: formData.smtpPass,
          fromEmail: formData.fromEmail
        }
      };
      await api.post("/master/onboard", payload);
      toast.success("Company onboarded successfully");
      setIsModalOpen(false);
      setFormData(initialFormState);
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to onboard company");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        companyName: formData.companyName,
        companyOwner: formData.companyOwner,
        contactNo: formData.contactNo,
        companyEmail: formData.companyEmail,
        website: formData.website,
        address: formData.address,
        noOfEmployees: formData.noOfEmployees,
        maxUsers: formData.maxUsers,
        subscriptionStatus: formData.subscriptionStatus,
        azureTenantId: formData.azureTenantId,
        azureClientId: formData.azureClientId,
        emailConfig: {
          provider: formData.emailProvider,
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpUser: formData.smtpUser,
          smtpPass: formData.smtpPass,
          fromEmail: formData.fromEmail
        }
      };
      await api.put(`/master/companies/${selectedTenant._id}`, payload);
      toast.success("Company configuration updated");
      setIsEditModalOpen(false);
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update company");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/master/companies/${id}`);
      toast.success("Company deleted successfully");
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete company");
    }
  };

  const openEditModal = (tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      ...initialFormState,
      companyName: tenant.companyName || "",
      companyOwner: tenant.companyOwner || "",
      contactNo: tenant.contactNo || "",
      companyEmail: tenant.companyEmail || "",
      website: tenant.website || "",
      address: tenant.address || "",
      noOfEmployees: tenant.noOfEmployees || "",
      maxUsers: tenant.maxUsers || 50,
      subscriptionStatus: tenant.subscriptionStatus || "Active",
      azureTenantId: tenant.azureTenantId || "",
      azureClientId: tenant.azureClientId || "",
      emailProvider: tenant.emailConfig?.provider || "Default",
      smtpHost: tenant.emailConfig?.smtpHost || "",
      smtpPort: tenant.emailConfig?.smtpPort || "",
      smtpUser: tenant.emailConfig?.smtpUser || "",
      smtpPass: tenant.emailConfig?.smtpPass || "",
      fromEmail: tenant.emailConfig?.fromEmail || ""
    });
    setIsEditModalOpen(true);
  };

  // Filter Data
  const getFilteredData = () => {
    return companies.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
                            (c.companyName?.toLowerCase() || "").includes(searchLower) ||
                            (c.companyOwner?.toLowerCase() || "").includes(searchLower) ||
                            (c.companyEmail?.toLowerCase() || "").includes(searchLower);
      const matchesType = filterType === "All" || c.companyType === filterType;
      const matchesStatus = filterStatus === "All" || (c.subscriptionStatus || "Active") === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  };

  // Table Columns Setup
  const tenantColumns = [
    {
      key: "companyName",
      label: "Company Name",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
            {row.companyName?.charAt(0).toUpperCase() || "C"}
          </div>
          <span className="text-main font-medium truncate max-w-[200px]" title={row.companyName}>
            {row.companyName}
          </span>
        </div>
      )
    },
    {
      key: "companyOwner",
      label: "Owner",
      sortable: true,
      render: (_, row) => <span className="text-main font-medium">{row.companyOwner}</span>
    },
    {
      key: "companyEmail",
      label: "Admin Email",
      sortable: true,
      render: (_, row) => <span className="text-muted text-sm">{row.companyEmail}</span>
    },
    {
      key: "companyType",
      label: "Type",
      sortable: true,
      render: (_, row) => (
        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {row.companyType}
        </span>
      )
    },
    {
      key: "maxUsers",
      label: "User Limit",
      sortable: true,
      render: (_, row) => <span className="text-main font-medium">{row.maxUsers || 50}</span>
    },
    {
      key: "isMasterTenant",
      label: "Master Tenant",
      sortable: true,
      render: (_, row) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 w-max ${
          row.isMasterTenant 
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" 
            : "bg-surface border border-border-subtle text-muted"
        }`}>
          {row.isMasterTenant && <ShieldCheck size={12} />}
          {row.isMasterTenant ? "Yes" : "No"}
        </span>
      )
    }
  ];

  const tableActions = [
    {
      icon: <Eye size={16} />,
      title: "View Details",
      onClick: (row) => {
        setSelectedTenant(row);
        setIsViewModalOpen(true);
      }
    },
    {
      icon: <Edit2 size={16} />,
      title: "Edit Configuration",
      onClick: (row) => openEditModal(row)
    },
    {
      icon: <Trash2 size={16} />,
      title: "Delete Tenant",
      onClick: (row) => {
        if (row.isMasterTenant) {
          toast.warn("Master Tenant cannot be deleted.");
          return;
        }
        confirm({
          title: "Delete Tenant?",
          message: `Are you sure you want to completely remove ${row.companyName}? This action is irreversible and deletes all associated user accounts.`,
          confirmText: "Delete",
          cancelText: "Cancel",
          onConfirmAction: () => handleDelete(row._id)
        });
      },
      className: (row) => row.isMasterTenant ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
    }
  ];

  return (
    <PageContainer 
      title="Tenant Management" 
      subtitle="Manage and onboard isolated tenants"
      isCard={true}
      headerActions={
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setFormData(initialFormState); setIsModalOpen(true); }}
            className="btn btn-primary flex items-center gap-2 active:scale-95"
          >
            <Plus size={16} strokeWidth={3} /> Onboard New Tenant
          </button>
        </div>
      }
      filters={
        <div className="flex flex-col w-full">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative group">
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input pl-9 pr-9 w-64"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-brand-primary transition-colors pointer-events-none" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="w-[180px]">
              <ModernSelect
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: "All", label: "All Types" },
                  { value: "Tech", label: "Tech" },
                  { value: "Marketing", label: "Marketing" },
                  { value: "E-Commerce", label: "E-Commerce" },
                  { value: "Other", label: "Other" }
                ]}
                placeholder="Company Type"
              />
            </div>
            
            {/* Status Filter */}
            <div className="w-[180px]">
              <ModernSelect
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: "All", label: "All Statuses" },
                  { value: "Active", label: "Active" },
                  { value: "Suspended", label: "Suspended" }
                ]}
                placeholder="Status"
              />
            </div>
            
            {/* Counter Badge */}
            <div className="ml-auto bg-surface border border-border-subtle px-4 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Total Tenants</span>
              <span className="text-sm font-black text-heading">{getFilteredData().length}</span>
            </div>
          </div>
        </div>
      }
    >
      <div className="rounded-[1.5rem] shadow-sm border border-border-subtle overflow-hidden bg-surface dark:bg-app h-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader size="lg" className="mb-4" text="Loading tenants..." />
          </div>
        ) : (
          <TableWithPagination
            columns={tenantColumns}
            data={getFilteredData()}
            loading={loading}
            emptyMessage="No tenants found."
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(newVal) => setRowsPerPage(newVal)}
            onRowClick={(row) => { setSelectedTenant(row); setIsViewModalOpen(true); }}
            actions={tableActions}
          />
        )}
      </div>

      {/* --- CREATE MODAL --- */}
      <GlassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Tenant"
        description="Enter the details to create an isolated workspace."
        maxWidth="max-w-2xl"
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="onboard-form" className="btn btn-primary">Onboard Tenant</button>
          </>
        }
      >
        <form id="onboard-form" onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-brand-primary">Basic Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <input name="companyName" placeholder="Company Name" required onChange={handleInputChange} className="glass-input" />
              <input name="companyOwner" placeholder="Owner Name" required onChange={handleInputChange} className="glass-input" />
              <input name="contactNo" placeholder="Contact No" required onChange={handleInputChange} className="glass-input" />
              <input name="companyEmail" type="email" placeholder="Admin Email" required onChange={handleInputChange} className="glass-input" />
              <input name="website" placeholder="Website" required onChange={handleInputChange} className="glass-input" />
              <input name="address" placeholder="Address" required onChange={handleInputChange} className="glass-input" />
              <input name="noOfEmployees" type="number" placeholder="No. of Employees" required onChange={handleInputChange} className="glass-input" />
              <select name="companyType" onChange={handleInputChange} className="glass-input cursor-pointer">
                <option value="Tech">Tech</option>
                <option value="Marketing">Marketing</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Other">Other (Specify)</option>
              </select>
              {formData.companyType === "Other" && (
                <input name="customCompanyType" placeholder="Specify Company Type" required onChange={handleInputChange} className="glass-input sm:col-span-2" />
              )}
              <input name="adminPassword" type="password" placeholder="Initial Admin Password" required onChange={handleInputChange} className="glass-input sm:col-span-2" />
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group mt-6">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-muted group-focus-within:text-brand-primary transition-colors">Licensing & Preferences</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <input name="maxUsers" type="number" placeholder="Max Allowed Users (e.g. 50)" required onChange={handleInputChange} className="glass-input" />
              <select name="currency" onChange={handleInputChange} className="glass-input cursor-pointer">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
              <select name="timezone" onChange={handleInputChange} className="glass-input sm:col-span-2 cursor-pointer">
                <option value="America/New_York">America/New_York (Eastern US & Canada)</option>
                <option value="UTC">UTC (Default)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group mt-6">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-muted group-focus-within:text-brand-primary transition-colors">SSO Config (Optional)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <input name="azureTenantId" placeholder="Azure Tenant ID" onChange={handleInputChange} className="glass-input" />
              <input name="azureClientId" placeholder="Azure Client ID" onChange={handleInputChange} className="glass-input" />
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group mt-6">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-muted group-focus-within:text-brand-primary transition-colors">Email Service</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <select name="emailProvider" onChange={handleInputChange} className="glass-input sm:col-span-2 cursor-pointer">
                <option value="Default">Use Default (Abidi Solutions Gmail)</option>
                <option value="Custom">Custom SMTP Credentials</option>
              </select>
              
              {formData.emailProvider === "Custom" && (
                <>
                  <input name="smtpHost" placeholder="SMTP Host" onChange={handleInputChange} className="glass-input" />
                  <input name="smtpPort" placeholder="SMTP Port (e.g. 587)" onChange={handleInputChange} className="glass-input" />
                  <input name="smtpUser" placeholder="SMTP User" onChange={handleInputChange} className="glass-input" />
                  <input name="smtpPass" type="password" placeholder="SMTP Pass" onChange={handleInputChange} className="glass-input" />
                  <input name="fromEmail" placeholder="From Email (e.g. no-reply@company.com)" onChange={handleInputChange} className="glass-input sm:col-span-2" />
                </>
              )}
            </div>
          </div>
        </form>
      </GlassModal>

      {/* --- EDIT MODAL --- */}
      <GlassModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Tenant Configuration"
        description={`Update settings for ${selectedTenant?.companyName}`}
        maxWidth="max-w-2xl"
        footer={
          <>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="edit-form" className="btn btn-primary">Save Changes</button>
          </>
        }
      >
        <form id="edit-form" onSubmit={handleEditSubmit} className="space-y-6 pt-2">
          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-brand-primary">Basic Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <input name="companyName" value={formData.companyName} placeholder="Company Name" required onChange={handleInputChange} className="glass-input" />
              <input name="companyOwner" value={formData.companyOwner} placeholder="Owner Name" required onChange={handleInputChange} className="glass-input" />
              <input name="contactNo" value={formData.contactNo} placeholder="Contact No" required onChange={handleInputChange} className="glass-input" />
              <input name="companyEmail" value={formData.companyEmail} type="email" placeholder="Admin Email" required onChange={handleInputChange} className="glass-input" />
              <input name="website" value={formData.website} placeholder="Website" required onChange={handleInputChange} className="glass-input" />
              <input name="address" value={formData.address} placeholder="Address" required onChange={handleInputChange} className="glass-input" />
              <input name="noOfEmployees" value={formData.noOfEmployees} type="number" placeholder="No. of Employees" required onChange={handleInputChange} className="glass-input" />
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-brand-primary">Licensing & Access</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="text-[10px] font-black text-muted uppercase ml-1">User Limit</label>
                <input name="maxUsers" type="number" value={formData.maxUsers} onChange={handleInputChange} className="glass-input" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase ml-1">Status</label>
                <select name="subscriptionStatus" value={formData.subscriptionStatus} onChange={handleInputChange} className="glass-input cursor-pointer">
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group mt-6">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-muted group-focus-within:text-brand-primary transition-colors">SSO Config</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="text-[10px] font-black text-muted uppercase ml-1">Azure Tenant ID</label>
                <input name="azureTenantId" value={formData.azureTenantId} onChange={handleInputChange} className="glass-input" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted uppercase ml-1">Azure Client ID</label>
                <input name="azureClientId" value={formData.azureClientId} onChange={handleInputChange} className="glass-input" />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-5 rounded-2xl relative shadow-sm group mt-6">
            <h4 className="absolute -top-3 left-4 bg-surface px-2 text-[10px] font-black tracking-widest uppercase text-muted group-focus-within:text-brand-primary transition-colors">Email Service</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-muted uppercase ml-1">Email Provider</label>
                <select name="emailProvider" value={formData.emailProvider} onChange={handleInputChange} className="glass-input cursor-pointer">
                  <option value="Default">Use Default (Abidi Solutions Gmail)</option>
                  <option value="Custom">Custom SMTP Credentials</option>
                </select>
              </div>
              
              {formData.emailProvider === "Custom" && (
                <>
                  <input name="smtpHost" placeholder="SMTP Host" value={formData.smtpHost} onChange={handleInputChange} className="glass-input" />
                  <input name="smtpPort" placeholder="SMTP Port" value={formData.smtpPort} onChange={handleInputChange} className="glass-input" />
                  <input name="smtpUser" placeholder="SMTP User" value={formData.smtpUser} onChange={handleInputChange} className="glass-input" />
                  <input name="smtpPass" type="password" placeholder="SMTP Pass" value={formData.smtpPass} onChange={handleInputChange} className="glass-input" />
                  <input name="fromEmail" placeholder="From Email" value={formData.fromEmail} onChange={handleInputChange} className="glass-input sm:col-span-2" />
                </>
              )}
            </div>
          </div>
        </form>
      </GlassModal>

      {/* --- VIEW MODAL --- */}
      <GlassModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Tenant Details"
        description="Overview of company information."
        maxWidth="max-w-3xl"
        footer={
          <button type="button" onClick={() => setIsViewModalOpen(false)} className="btn btn-secondary">Close</button>
        }
      >
        {selectedTenant && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            <div className="space-y-4">
              <div className="bg-surface border border-border-subtle p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-black">
                    {selectedTenant.companyName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-heading">{selectedTenant.companyName}</h3>
                    <p className="text-xs text-muted flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full ${selectedTenant.subscriptionStatus === "Suspended" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"} font-bold tracking-widest uppercase text-[9px]`}>
                        {selectedTenant.subscriptionStatus || "Active"}
                      </span>
                      {selectedTenant.isMasterTenant && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold tracking-widest uppercase text-[9px]">Master</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Type</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.companyType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Address</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.address}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Website</p>
                    <p className="text-sm font-semibold text-brand-primary break-all">{selectedTenant.website}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-surface border border-border-subtle p-5 rounded-2xl shadow-sm">
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-3 border-b border-border-subtle pb-2">Primary Contact</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Owner Name</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.companyOwner}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Email Address</p>
                    <p className="text-sm font-semibold text-main break-all">{selectedTenant.companyEmail}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Contact No.</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.contactNo}</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border-subtle p-5 rounded-2xl shadow-sm">
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-3 border-b border-border-subtle pb-2">Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Employees</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.noOfEmployees} / {selectedTenant.maxUsers || 50}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Timezone</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.timezone || "America/New_York"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">SSO Status</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.azureTenantId ? "Configured" : "Not Set"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Email Status</p>
                    <p className="text-sm font-semibold text-main">{selectedTenant.emailConfig?.provider === "Custom" ? "Custom SMTP" : "Default"}</p>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </GlassModal>

    </PageContainer>
  );
};

export default TenantManagement;

