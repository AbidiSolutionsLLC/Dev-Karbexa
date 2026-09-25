const Company = require("../models/companySchema");
const User = require("../models/userSchema");
const bcrypt = require("bcryptjs");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");
const { BadRequestError } = require("../utils/ExpressError");

exports.onboardCompany = catchAsync(async (req, res) => {
  const {
    companyName,
    companyOwner,
    contactNo,
    companyEmail,
    website,
    address,
    noOfEmployees,
    companyType,
    azureTenantId,
    azureClientId,
    emailConfig,
    adminPassword,
    maxUsers,
    timezone,
    currency
  } = req.body;

  const existingCompany = await Company.findOne({ $or: [{ companyEmail }, { companyName }] });
  if (existingCompany) {
    throw new BadRequestError("A company with this email or name already exists.");
  }

  const newCompany = await Company.create({
    companyName,
    companyOwner,
    contactNo,
    companyEmail,
    website,
    address,
    noOfEmployees,
    companyType,
    azureTenantId: azureTenantId || null,
    azureClientId: azureClientId || null,
    emailConfig: emailConfig || { provider: "Default" },
    maxUsers: maxUsers || 50,
    timezone: timezone || "America/New_York",
    currency: currency || "USD",
    isMasterTenant: false
  });

  const newAdmin = new User({
    name: companyOwner,
    email: companyEmail,
    password: adminPassword,
    role: "Super Admin",
    company: newCompany._id,
    empStatus: "Active",
    designation: "CEO / Owner"
  });

  await newAdmin.save();

  res.status(201).json(ApiResponse.success({
    company: newCompany,
    admin: { email: newAdmin.email, name: newAdmin.name, role: newAdmin.role }
  }, "Company onboarded successfully."));
});

exports.getAllCompanies = catchAsync(async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.status(200).json(ApiResponse.success(companies));
});

exports.updateCompanyConfig = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { azureTenantId, azureClientId, emailConfig, maxUsers, subscriptionStatus } = req.body;
  
  const company = await Company.findByIdAndUpdate(id, {
    azureTenantId,
    azureClientId,
    emailConfig,
    ...(maxUsers && { maxUsers }),
    ...(subscriptionStatus && { subscriptionStatus })
  }, { new: true });
  
  if (!company) throw new BadRequestError("Company not found");
  
  res.status(200).json(ApiResponse.success(company, "Configuration updated."));
});
exports.updateCompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Prevent modifying critical system fields
  delete updates._id;
  delete updates.isMasterTenant;

  const company = await Company.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!company) throw new BadRequestError("Company not found");

  res.status(200).json(ApiResponse.success(company, "Company updated successfully."));
});

exports.deleteCompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const company = await Company.findById(id);
  if (!company) throw new BadRequestError("Company not found");
  if (company.isMasterTenant) throw new BadRequestError("Cannot delete the Master Tenant.");

  await Company.findByIdAndDelete(id);
  
  // Optionally, you could also delete all users, timesheets, and logs associated with this company.
  // For now, we will just delete the company to sever access.
  await User.deleteMany({ company: id });

  res.status(200).json(ApiResponse.success(null, "Company and its users deleted successfully."));
});
