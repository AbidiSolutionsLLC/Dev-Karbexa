const mongoose = require("mongoose");
const mongooseDelete = require('mongoose-delete');

const userSchema = new mongoose.Schema(
  {
    azureId: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      select: false, 
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
      select: false,
    },
    otpGeneratedAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["Super Admin", "Admin", "HR", "Manager", "Employee" , "Technician", "Global Reader"],
      required: true,
      default: "Employee",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'violet', 'slate', 'system'],
      default: 'system'
    },
    notificationPreferences: {
      email: {
        ticketUpdates: { type: Boolean, default: true },
        leaveApprovals: { type: Boolean, default: true },
        expenseUpdates: { type: Boolean, default: true },
        dailyDigest: { type: Boolean, default: false }
      },
      push: {
        ticketUpdates: { type: Boolean, default: true },
        leaveApprovals: { type: Boolean, default: true },
        expenseUpdates: { type: Boolean, default: true },
        directMessages: { type: Boolean, default: true }
      }
    },
    // --- NEW FIELD: DUAL ROLE SUPPORT ---
    isTechnician: {
      type: Boolean,
      default: false
    },
    hourlyWage: {
      type: Number,
      default: 0,
      min: 0
    },
        department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    reportsTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    jobLevel: {
      type: Number,
      default: 5,
    },
    designation: {
      type: String,
      default: "New Hire",
    },
    branch: {
      type: String,
      default: "Main",
    },
    empType: {
      type: String,
      enum: ["Permanent", "Contractor", "Intern", "Part Time"],
      default: "Permanent",
    },
    endDate: {
      type: Date,
      default: null,
    },
    empID: {
      type: String,
      default: "TBD",
    },
    empStatus: {
      type: String,
      enum: ["Active", "Inactive", "Pending"],
      default: "Active",
    },
    timeZone: {
      type: String,
      default: "America/New_York",
    },
    avatar: {
      type: String,
      default: "",
    },
    coverImage: {
      type: String,
      default: "",
    },
    joiningDate: { type: Date, default: Date.now },
    phoneNumber: {
      type: String,
      sparse: true, 
    },
    address: { type: String },
    salary: { type: Number },
    about: { type: String },
    experience: [
      {
        company: String,
        jobType: String,
        startDate: Date,
        endDate: Date,
        description: String,
      },
    ],
    education: [
      {
        institution: String,
        degree: String,
        startYear: Number,
        endYear: Number,
      },
    ],
    DOB: { type: String },
    maritalStatus: { type: String },
    emergencyContact: [
      {
        name: String,
        relation: String,
        phone: Number,
      },
    ],
    addedby: { type: String },
    avalaibleLeaves: { type: Number, default: 15 },
    bookedLeaves: { type: Number, default: 0 },
    leaveHistory: [
      {
        leaveId: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveRequest" },
        leaveType: String,
        startDate: String,
        endDate: String,
        status: String,
        daysTaken: Number,
        reason: String,
        appliedAt: Date,
        createdAt: Date,
      },
    ],
    leaves: {
      pto: { type: Number, default: 10 },
      sick: { type: Number, default: 5 },
    },
    dashboardCards: [
      {
        type: {
          type: String,
          enum: [
            "feeds",
            "attendance",
            "holidays",
            "todo",
            "notes",
            "recent activities",
            "birthdays",
            "leavelog",
            "upcomingDeadlines",
            "timeoffBalance",
            "tasksAssignedToMe",
          ],
        },
        id: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function(next) {
  if (this.isModified("password")) {
    this.password = await require("bcryptjs").hash(this.password, 12);
  }
  next();
});

userSchema.pre("findOneAndDelete", async function (next) {
  const user = await this.model.findOne(this.getFilter());
  if (!user) return next();

  const userId = user._id;

  // Clean dependent collections
  await Promise.all([
    mongoose.model("Ticket").deleteMany({
      $or: [{ closedBy: userId }, { assignedTo: userId }],
    }),
    mongoose.model("LeaveRequest").deleteMany({ employee: userId }),
    mongoose.model("Todo").deleteMany({ user: userId }),
    mongoose.model("TimeLog").deleteMany({ employee: userId }),
    mongoose.model("Timesheet").deleteMany({ employee: userId }),
    mongoose.model("TimeTracker").deleteMany({ user: userId }),

    mongoose.model("Department").updateMany(
      {},
      {
        $pull: { members: userId },
        $set: { manager: null },
      }
    ),

    mongoose.model("User").updateMany(
      { reportsTo: userId },
      { $set: { reportsTo: null } }
    ),

    mongoose.model("Expense").deleteMany({ submittedBy: userId }),
    mongoose.model("Notification").deleteMany({ recipient: userId }),
    mongoose.model("Project").updateMany(
      {},
      { $pull: { team: userId } }
    ),
    mongoose.model("Project").deleteMany({ owner: userId }),
    mongoose.model("File").deleteMany({ ownerId: userId }),
  ]);

  next();
});

userSchema.index({ company: 1, role: 1, empStatus: 1 });
userSchema.index({ company: 1, reportsTo: 1 });
userSchema.index({ DOB: 1 });
userSchema.index({ company: 1, empStatus: 1 });

userSchema.plugin(mongooseDelete, { overrideMethods: 'all', deletedAt: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;