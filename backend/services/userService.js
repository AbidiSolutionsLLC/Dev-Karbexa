const User = require("../models/userSchema");
const Department = require("../models/department");
const Task = require('../models/taskSchema');
const TimeLog = require('../models/timeLogsSchema');
const userRepository = require("../repositories/userRepository");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../utils/ExpressError");
const { sendInvitationEmail } = require('../config/emailConfig');
const { getSearchScope } = require("../utils/rbac");
const { createNotification } = require('../utils/notificationService');

class UserService {
  async checkWritePermission(actor, targetUserId = null, targetRole = null) {
    if (!actor) return false;
    const actorId = actor._id || actor.id;

    if (actor.role === 'Super Admin') return true;

    if (targetUserId && String(actorId) === String(targetUserId)) {
      return "SELF_EDIT";
    }

    const isManagerTech = actor.role === 'Manager' && actor.isTechnician === true;

    if (actor.role === 'Admin' || actor.role === 'HR' || isManagerTech) {
      const restrictedRoles = ['Super Admin', 'Admin'];
      if (targetRole && restrictedRoles.includes(targetRole)) {
        throw new ForbiddenError("You cannot assign or manage Admin or Super Admin roles.");
      }

      if (targetUserId) {
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) throw new NotFoundError("User not found");
        if (restrictedRoles.includes(targetUser.role)) {
          throw new ForbiddenError("Permission Denied: You cannot modify Admins or Super Admins.");
        }
      }
      return true;
    }

    if (['Manager', 'Technician', 'Employee'].includes(actor.role)) {
      throw new ForbiddenError("You do not have permission to manage users.");
    }

    return false;
  }

  async generateEmpID() {
    const lastUser = await userRepository.getLastEmpId();
    if (!lastUser || !lastUser.empID || !lastUser.empID.startsWith("EMP-")) return "EMP-001";
    const lastIdStr = lastUser.empID.split("-")[1];
    const lastIdNum = parseInt(lastIdStr, 10);
    return isNaN(lastIdNum) ? "EMP-001" : `EMP-${String(lastIdNum + 1).padStart(3, "0")}`;
  }

  async sendInviteEmail(user) {
    let resetToken = null;
    const crypto = require("crypto");
    
    // Always generate a fresh reset token for the invitation
    resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    await user.save();

    const frontendBaseUrl = (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost'))
        ? process.env.FRONTEND_URL.replace(/\/+$/, '')
        : 'https://abidipro.abidisolutions.com';
    const loginUrlWithToken = `${frontendBaseUrl}/auth/reset-password/${resetToken}`;

    try {
      await sendInvitationEmail({
        to: user.email,
        name: user.name,
        role: user.role,
        loginURL: loginUrlWithToken,
        companyId: user.company
      });
    } catch (error) {
      throw new Error("Email failed to send: " + error.message);
    }
  }

  async createInitialSuperAdmin(data) {
    const superAdminExists = await User.findOne({ role: 'Super Admin' });
    if (superAdminExists) {
      throw new ForbiddenError("A Super Admin already exists. This setup route is disabled.");
    }

    let { email, name, ...otherData } = data;

    if (!email || !name) {
      throw new BadRequestError("Email and Name are required for setup.");
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new BadRequestError("User with this email already exists.");

    const newEmpID = await this.generateEmpID();
    const defaultCards = [
      { type: 'todo', id: Date.now().toString() + '-1' },
      { type: 'holidays', id: Date.now().toString() + '-2' },
      { type: 'leavelog', id: Date.now().toString() + '-3' }
    ];

    const newUser = new User({
      email,
      name,
      ...otherData,
      role: "Super Admin",
      empID: newEmpID,
      dashboardCards: defaultCards,
      empStatus: "Active",
      isTechnician: false
    });

    return newUser.save();
  }

  async createUser(actor, data) {
    let { email, hourlyWage, ...otherData } = data;
    
    await this.checkWritePermission(actor, null, otherData.role);

    if (otherData.reportsTo === "NO MANAGER (TOP LEVEL)" || otherData.reportsTo === "") otherData.reportsTo = null;

    if (actor?.role === 'Admin' && (!otherData.reportsTo || otherData.reportsTo !== actor.id)) {
       otherData.reportsTo = actor.id;
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new BadRequestError("User with this email already exists");

    const newEmpID = await this.generateEmpID();
    const defaultCards = [
      { type: 'todo', id: Date.now().toString() + '-1' },
      { type: 'holidays', id: Date.now().toString() + '-2' },
      { type: 'leavelog', id: Date.now().toString() + '-3' }
    ];

    // --- TEMPORARY: Hardcode company to Abidi Solutions until SaaS shift ---
    const Company = require("../models/companySchema");
    const abidiCompany = await Company.findOne({ name: "Abidi Solutions" });
    const companyIdToUse = abidiCompany ? abidiCompany._id : actor.company;
    
    const newUser = new User({
      email,
      company: companyIdToUse,
      ...otherData,
      hourlyWage: Number(hourlyWage) || 0,
      empID: newEmpID,
      dashboardCards: defaultCards,
      empStatus: "Pending",
      isTechnician: otherData.isTechnician || false
    });

    const savedUser = await newUser.save();
    if (otherData.department) await Department.findByIdAndUpdate(otherData.department, { $push: { members: savedUser._id } });

    try {
      await this.sendInviteEmail(savedUser);
    } catch (err) {
      console.error("❌ Failed to send invite email:", err.message);
      await User.findByIdAndDelete(savedUser._id);
      if (otherData.department) await Department.findByIdAndUpdate(otherData.department, { $pull: { members: savedUser._id } });
      throw new BadRequestError("Failed to send invitation email: " + err.message + ". User was not created.");
    }

    try {
      const admins = await User.find({
        $or: [{ role: 'Super Admin' }, { role: 'Admin' }]
      }).select('_id');
      const notifPromises = admins.map(admin =>
        createNotification({
          recipient: admin._id,
          type: 'USER_CREATED',
          title: 'New User Added',
          message: `A new user "${savedUser.name}" (${savedUser.email}) has been added to the system.`,
          relatedEntity: { entityType: 'user', entityId: savedUser._id },
        })
      );
      await Promise.all(notifPromises);
    } catch (notifErr) {
      console.error('[Notification] User created:', notifErr.message);
    }

    return savedUser;
  }

  async resendInvitation(actor, targetId) {
    await this.checkWritePermission(actor, targetId);

    const user = await User.findById(targetId);
    if (!user) throw new NotFoundError("User not found");
    if (user.empStatus !== "Pending" && user.empStatus !== "Inactive") throw new BadRequestError("User already active.");
    
    try {
      await this.sendInviteEmail(user);
    } catch (error) {
      throw new BadRequestError("Failed to send email: " + error.message);
    }
    return user;
  }

  async getAllUsers(actor, queryParams, companyId) {
    const { page = 1, limit = 1000, search = '', status, role, department } = queryParams;
    const skip = (page - 1) * limit;

    const rbacFilter = await getSearchScope(actor, 'usermanagement'); 
    const query = { ...rbacFilter, company: companyId };

    if (status && status !== 'All') query.empStatus = status;
    if (role && role !== 'All') query.role = role;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { empID: { $regex: search, $options: 'i' } }
      ];
    }

    if (department && department !== 'All') {
      const dept = await Department.findOne({ name: department, company: companyId });
      if (dept) {
        query.department = dept._id;
      } else {
        query.department = null; 
      }
    }

    const [data, total] = await Promise.all([
      User.find(query)
        .populate("department", "name")
        .populate("reportsTo", "name designation")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments(query)
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(id) {
    const user = await User.findById(id)
      .populate({ path: "department", populate: { path: "members", model: "User", select: "name email designation avatar role empStatus" } })
      .populate({ path: "reportsTo", select: "name email designation avatar role" })
      .lean();
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async getUserSummary(id, companyId) {
    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User not found");

    const taskCount = await Task.countDocuments({ assignee: id, company: companyId, status: { $ne: 'Done' } });
    const leavesTaken = user.bookedLeaves || 0;
    
    const timeLogs = await TimeLog.find({ user: id, company: companyId });
    const hoursLogged = timeLogs.reduce((total, log) => {
      if (log.duration) return total + log.duration;
      if (log.startTime && log.endTime) {
         return total + (new Date(log.endTime) - new Date(log.startTime)) / (1000 * 60 * 60);
      }
      return total;
    }, 0);

    return {
      taskCount,
      leavesTaken,
      hoursLogged: Math.round(hoursLogged * 10) / 10
    };
  }

  async updateUser(actor, targetId, updates) {
    const permission = await this.checkWritePermission(actor, targetId, updates.role);

    const user = await User.findById(targetId);
    if (!user) throw new NotFoundError("User not found");

    let allowedFields = [];

    if (permission === "SELF_EDIT") {
        const sensitiveFields = [
            "role", "salary", "hourlyWage", "department", "reportsTo", 
            "designation", "email", "empID", "empStatus", 
            "joiningDate", "empType", "avalaibleLeaves", "bookedLeaves", "isTechnician"
        ];
        sensitiveFields.forEach(field => delete updates[field]);

        allowedFields = [
            "name", "phoneNumber", "about", "education", 
            "address", "experience", "DOB", "maritalStatus", 
            "emergencyContact", "timeZone"
        ];
    } else {
        if (updates.department && updates.department !== user.department?.toString()) {
          const oldDeptId = user.department;
          const newDeptId = updates.department;
          if (oldDeptId) await Department.findByIdAndUpdate(oldDeptId, { $pull: { members: targetId } });
          if (newDeptId) {
            const dept = await Department.findByIdAndUpdate(newDeptId, { $push: { members: targetId } });
            if (dept) {
              createNotification({
                recipient: targetId,
                type: 'DEPARTMENT_MEMBER_ADDED',
                title: 'Department Assignment',
                message: `You have been added to the ${dept.name} department.`,
                relatedEntity: { entityType: 'department', entityId: dept._id },
              }).catch(console.error);
            }
          }
        }
        
        if (updates.reportsTo === "" || updates.reportsTo === "NO MANAGER") updates.reportsTo = null;

        allowedFields = [
            "name", "email", "timeZone", "reportsTo", "empID", "role", "phoneNumber", 
            "designation", "department", "branch", "empType", "joiningDate", "endDate", "about", 
            "salary", "hourlyWage", "education", "address", "experience", "DOB", "maritalStatus", 
            "emergencyContact", "addedby", "empStatus", "avalaibleLeaves", "isTechnician"
        ];
    }

    Object.keys(updates).forEach(field => { 
        if (allowedFields.includes(field) && updates[field] !== undefined) {
            user[field] = field === 'hourlyWage' ? Number(updates[field]) : updates[field]; 
        }
    });

    const updatedUser = await user.save();

    if (updates.empStatus === 'Inactive' && user.empStatus !== 'Inactive') {
      try {
        const admins = await User.find({
          $or: [{ role: 'Super Admin' }, { role: 'Admin' }],
          _id: { $ne: updatedUser._id }
        }).select('_id');
        const notifPromises = admins.map(admin =>
          createNotification({
            recipient: admin._id,
            type: 'USER_DEACTIVATED',
            title: 'User Deactivated',
            message: `User "${updatedUser.name}" has been deactivated.`,
            relatedEntity: { entityType: 'user', entityId: updatedUser._id },
          })
        );
        await Promise.all(notifPromises);
      } catch (notifErr) {
        console.error('[Notification] User deactivated:', notifErr.message);
      }
    }

    return updatedUser;
  }

  async deleteUser(actor, targetId) {
    if (actor.role === 'HR') {
      throw new ForbiddenError("HR is not permitted to delete users.");
    }
    const permission = await this.checkWritePermission(actor, targetId);

    if (permission === "SELF_EDIT") {
        throw new ForbiddenError("You cannot delete your own account.");
    }

    const user = await User.findById(targetId);
    if (!user) throw new NotFoundError("User not found");
    if (user.department) await Department.findByIdAndUpdate(user.department, { $pull: { members: targetId } });
    await User.updateMany({ reportsTo: targetId }, { $set: { reportsTo: null } });
    
    const mongoose = require("mongoose");
    await mongoose.model("Project").updateMany({}, { $pull: { team: targetId } });

    user.email = `${user.email}_deleted_${Date.now()}`;
    await user.save();

    await user.delete();
  }

  async getUserByRole(role, companyId) {
    const query = { role };
    if (companyId) query.company = companyId;
    return User.find(query);
  }

  async getDashboardCards(id) {
    const user = await User.findById(id).select('dashboardCards');
    if (!user) throw new NotFoundError("User not found");
    return user.dashboardCards || [];
  }

  async addDashboardCard(id, type) {
    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User");
    if (user.dashboardCards.some(card => card.type === type)) throw new BadRequestError("Card already exists");
    user.dashboardCards.push({ type, id: Date.now().toString() });
    await user.save();
    return user.dashboardCards;
  }

  async removeDashboardCard(id, cardId) {
    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User");
    const initialLength = user.dashboardCards.length;
    user.dashboardCards = user.dashboardCards.filter(card => card.id !== cardId);
    if (user.dashboardCards.length === initialLength) throw new NotFoundError("Card not found");
    await user.save();
    return user.dashboardCards;
  }

  async getUserLeaves(id) {
    const user = await User.findById(id).select('leaves');
    if (!user) throw new NotFoundError("User");
    return user.leaves;
  }

  async updateUserLeaves(actor, targetId, updates) {
    const { pto, sick } = updates;
    const user = await User.findById(targetId);
    if (!user) throw new NotFoundError("User");

    const role = actor.role;

    if (role === 'SuperAdmin' || role === 'Super Admin' || role === 'HR') {
      // Allowed
    } 
    else if (role === 'Admin' || role === 'Manager') {
      const isSubordinate = 
        (user.reportsTo && user.reportsTo.toString() === actor.id) ||
        (user.reportingManager && user.reportingManager.toString() === actor.id);
        
      if (!isSubordinate) {
        throw new ForbiddenError("You can only update leaves for your direct subordinates.");
      }
    } 
    else {
      throw new ForbiddenError("Permission denied.");
    }

    if (pto !== undefined) user.leaves.pto = pto;
    if (sick !== undefined) user.leaves.sick = sick;
    const totalAllocated = (user.leaves.pto || 0) + (user.leaves.sick || 0);
    user.avalaibleLeaves = totalAllocated - (user.bookedLeaves || 0);
    await user.save();
    return user.leaves;
  }

  async getUserLeaveHistory(id) {
    const LeaveRequest = require("../models/leaveRequestSchema");
    const history = await LeaveRequest.find({ employee: id }).sort({ createdAt: -1 });
    return history;
  }

  async getUpcomingBirthdays(companyId) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();

    const matchQuery = { DOB: { $exists: true, $nin: [null, ""] } };
    if (companyId) matchQuery.company = companyId;

    const users = await User.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          dobDate: { $convert: { input: "$DOB", to: "date", onError: null, onNull: null } },
        },
      },
      { $match: { dobDate: { $ne: null } } },
      {
        $addFields: {
          birthMonth: { $month: "$dobDate" },
          birthDay: { $dayOfMonth: "$dobDate" },
        },
      },
      {
        $addFields: {
          nextBirthday: {
            $dateFromParts: {
              year: {
                $cond: [
                  {
                    $or: [
                      { $gt: ["$birthMonth", currentMonth] },
                      { $and: [{ $eq: ["$birthMonth", currentMonth] }, { $gte: ["$birthDay", currentDay] }] },
                    ],
                  },
                  currentYear,
                  currentYear + 1,
                ],
              },
              month: "$birthMonth",
              day: "$birthDay",
            },
          },
        },
      },
      {
        $addFields: {
          daysUntilBirthday: { $divide: [{ $subtract: ["$nextBirthday", now] }, 1000 * 60 * 60 * 24] },
        },
      },
      { $match: { daysUntilBirthday: { $gte: 0, $lte: 30 } } },
      { $sort: { daysUntilBirthday: 1 } },
      { $limit: 3 },
    ]);

    return users.map((user) => {
      const birthDate = new Date(user.dobDate);
      return {
        name: user.name,
        date: birthDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        day: birthDate.toLocaleDateString('en-US', { weekday: 'long' }),
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
        color: `bg-blue-100 text-blue-700`,
      };
    });
  }

  async uploadAvatar(actor, targetId, fileUrl) {
    const permission = await this.checkWritePermission(actor, targetId);
    if (!permission) throw new ForbiddenError("Permission denied");

    const user = await User.findByIdAndUpdate(targetId, { avatar: fileUrl }, { new: true });
    if (!user) throw new NotFoundError("User");
    return user.avatar;
  }

  async getOrgChart(companyId) {
    const query = { empStatus: "Active" };
    if (companyId) query.company = companyId;
    const users = await User.find(query).select("name designation avatar role email phone reportsTo department").populate("department", "name").lean();
    const buildTree = (users, managerId = null) => {
      return users.filter((user) => { if (managerId === null) return !user.reportsTo; return user.reportsTo && user.reportsTo.toString() === managerId.toString(); }).map((user) => ({ ...user, children: buildTree(users, user._id) }));
    };
    return buildTree(users, null);
  }

  async uploadCover(actor, targetId, fileUrl) {
    const permission = await this.checkWritePermission(actor, targetId);
    if (!permission) throw new ForbiddenError("Permission denied");

    const user = await User.findByIdAndUpdate(targetId, { coverImage: fileUrl }, { new: true });
    if (!user) throw new NotFoundError("User not found");
    return user.coverImage;
  }

  async updateMyProfile(userId, updates) {
    const restrictedFields = [
      "role", "salary", "hourlyWage", "department", "reportsTo", 
      "designation", "email", "empID", "empStatus", 
      "joiningDate", "empType", "avalaibleLeaves", "bookedLeaves", "isTechnician", "company"
    ];
    restrictedFields.forEach(field => delete updates[field]);

    const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async updateMySettings(userId, settings) {
    const { theme, notificationPreferences } = settings;
    const updates = {};
    if (theme) updates.theme = theme;
    
    if (notificationPreferences) {
      const user = await User.findById(userId);
      if (!user) throw new NotFoundError("User not found");
      
      updates.notificationPreferences = {
        email: { ...user.notificationPreferences?.email, ...notificationPreferences.email },
        push: { ...user.notificationPreferences?.push, ...notificationPreferences.push }
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!updatedUser) throw new NotFoundError("User not found");
    return updatedUser;
  }
}

module.exports = new UserService();
