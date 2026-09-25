const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    unique: true,
  },
  companyOwner: {
    type: String,
    required: true
  },
  contactNo: {
    type: String,
    required: true
  },
  companyEmail: {
    type: String,
    required: true,
    unique: true
  },
  website: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    required: true,
  },
  noOfEmployees: {
    type: Number,
    required: true,
  },
  noOfApps: {
    type: Number,
    default: 0
  },
  aboutCompany: {
    type: String
  },
  companyLogo: {
    type: String 
  },
  companyType: {
    type: String,
    required: true
  },
  branches: {
    type: String,
  },
  departments: {
    type: String,
  },
  isMasterTenant: {
    type: Boolean,
    default: false
  },
  azureTenantId: {
    type: String,
    default: null
  },
  azureClientId: {
    type: String,
    default: null
  },
  emailConfig: {
    provider: { type: String, enum: ['Default', 'Custom'], default: 'Default' },
    smtpHost: { type: String, default: null },
    smtpPort: { type: Number, default: null },
    smtpUser: { type: String, default: null },
    smtpPass: { type: String, default: null },
    fromEmail: { type: String, default: null }
  },
  subscriptionStatus: {
    type: String,
    enum: ['Active', 'Suspended'],
    default: 'Active'
  },
  maxUsers: {
    type: Number,
    default: 50 // Enforces a default limit to prevent abuse
  },
  timezone: {
    type: String,
    default: 'America/New_York' // Critical for TimeTracker rollover limits
  },
  currency: {
    type: String,
    default: 'USD' // Critical for Payroll & Expenses
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Company", companySchema);

