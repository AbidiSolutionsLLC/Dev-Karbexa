const LeaveRequest = require("../models/leaveRequestSchema");
const User = require("../models/userSchema");
const TimeTracker = require("../models/timeTrackerSchema");
const { moment, TIMEZONE, calculateBusinessDays } = require("../utils/dateUtils");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../utils/ExpressError");
const { sendEmail } = require('../config/emailConfig');
const emailTemplates = require('../utils/emailTemplates');
const { generateActionUrl } = require('../utils/urlGenerator');
const { createNotification } = require('../utils/notificationService');
const APIFeatures = require("../utils/apiFeatures");
const { getTeamIds } = require("../utils/hierarchy"); // Assuming getTeamIds is centralized in hierarchy.js as used in expenseController
const { normalizeRole } = require("../utils/rbacUtils");

class LeaveService {
  async createLeaveRequest(userId, companyId, data) {
    const { leaveType, startDate, endDate, reason } = data;
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (!leaveType || !startDate || !endDate) throw new BadRequestError("Missing required fields");

    const start = moment.utc(startDate, 'YYYY-MM-DD').startOf('day');
    const end = moment.utc(endDate, 'YYYY-MM-DD').startOf('day');
    const daysDiff = calculateBusinessDays(startDate, endDate);
    if (daysDiff < 1) {
      throw new BadRequestError("Selected date range includes only weekends/holidays. Please choose at least one working day.");
    }

    const userLeaveBalance = user.leaves[leaveType.toLowerCase()] || 0;
    if (userLeaveBalance < daysDiff) throw new BadRequestError(`Not enough ${leaveType} leaves available`);

    const existingLeaves = await LeaveRequest.find({
      employee: user._id,
      company: companyId,
      status: { $in: ["Pending", "Approved"] }
    });

    const overlappingLeaves = existingLeaves.filter(leave => {
      const existingStart = new Date(leave.startDate);
      const existingEnd = new Date(leave.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      return (existingStart <= newEnd && newStart <= existingEnd);
    });

    if (overlappingLeaves.length > 0) {
      throw new BadRequestError('Leave dates overlap with an existing application');
    }

    const leaveRequest = new LeaveRequest({
      employee: user._id,
      company: companyId,
      employeeName: user.name,
      email: user.email,
      leaveType,
      startDate,
      endDate,
      reason,
      responses: []
    });

    const savedLeaveRequest = await leaveRequest.save();

    const updateObj = {
      $push: {
        leaveHistory: {
          leaveId: savedLeaveRequest._id,
          leaveType,
          startDate: startDate,
          endDate: endDate,
          status: 'Pending',
          daysTaken: daysDiff,
          reason: reason,
          appliedAt: savedLeaveRequest.appliedAt,
          createdAt: savedLeaveRequest.createdAt || new Date()
        }
      },
      $inc: {
        [`leaves.${leaveType.toLowerCase()}`]: -daysDiff,
        bookedLeaves: daysDiff,
        avalaibleLeaves: -daysDiff
      }
    };

    await User.findByIdAndUpdate(user._id, updateObj);

    this.sendLeaveCreationNotification(savedLeaveRequest).catch(console.error);

    try {
      const notifyRoles = await User.find({
        $or: [{ role: 'Super Admin' }, { role: 'Admin' }],
        company: companyId
      }).select('_id');
      
      let notifRecipients = [...notifyRoles.map(r => r._id.toString())];
      if (user.reportsTo) {
        notifRecipients.push(user.reportsTo.toString());
      }
      notifRecipients = [...new Set(notifRecipients)];

      const notifPromises = notifRecipients.map(mgrId =>
        createNotification({
          recipient: mgrId,
          type: 'LEAVE_REQUEST_SUBMITTED',
          title: 'New Leave Request',
          message: `${user.name} has submitted a ${leaveType} leave request from ${moment.utc(startDate).format('MMM DD, YYYY')} to ${moment.utc(endDate).format('MMM DD, YYYY')}. Action required.`,
          relatedEntity: { entityType: 'leave', entityId: savedLeaveRequest._id },
        })
      );
      await Promise.all(notifPromises);
    } catch (notifErr) {
      console.error('[Notification] Leave request submitted:', notifErr.message);
    }

    require("./activityLogService").recordActivity({
      actorId: user._id,
      action: `submitted a ${leaveType} leave request`,
      entityType: "leave",
      entityId: savedLeaveRequest._id,
      companyId,
      level: "info",
    }).catch(() => {});

    return savedLeaveRequest;
  }

  async getLeaveRequestResponses(user, companyId, id) {
    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId })
      .populate('responses.author', 'name email avatar role')
      .select('responses employee status');

    if (!leaveRequest) throw new NotFoundError("Leave request");

    const currentUserId = user.id || user._id;
    const roleKey = normalizeRole(user.role);

    const isOwner = leaveRequest.employee.toString() === currentUserId.toString();
    const isSuperAdminOrHR = ['superadmin', 'hr'].includes(roleKey);

    if (!isOwner && !isSuperAdminOrHR) {
      if (roleKey === 'admin' || roleKey === 'manager') {
        const teamIds = await getTeamIds(currentUserId);
        const isInTeam = teamIds.includes(leaveRequest.employee.toString());
        if (!isInTeam) {
          throw new ForbiddenError("You don't have permission to view responses for this leave request");
        }
      } else {
        throw new ForbiddenError("You don't have permission to view these responses");
      }
    }

    return leaveRequest.responses;
  }

  async updateLeaveResponse(userId, companyId, leaveId, responseId, content) {
    if (!content || content.trim() === '') {
      throw new BadRequestError("Response content is required");
    }

    const leaveRequest = await LeaveRequest.findOne({ _id: leaveId, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const response = leaveRequest.responses.id(responseId);
    if (!response) throw new NotFoundError("Response");

    if (response.author.toString() !== userId.toString()) {
      throw new ForbiddenError("You can only edit your own responses");
    }

    response.content = content.trim();
    response.editedAt = new Date();
    response.isEdited = true;

    await leaveRequest.save();

    const populatedLeaveRequest = await LeaveRequest.findOne({ _id: leaveId, company: companyId })
      .populate('responses.author', 'name email avatar role');

    return populatedLeaveRequest.responses.id(responseId);
  }

  async getLeaveRequests(user, companyId, query) {
    const roleKey = normalizeRole(user.role);
    let baseQuery = {};
    const currentUserId = user.id || user._id;

    if (query.my === 'true' || query.my === true) {
        baseQuery.employee = currentUserId;
        baseQuery.company = companyId;
    } else if (roleKey === 'superadmin' || roleKey === 'hr') {
        baseQuery = { company: companyId };
    }
    else if (roleKey === 'manager' || roleKey === 'admin') {
        const fullTeamIds = await getTeamIds(currentUserId);
        baseQuery.employee = { $in: fullTeamIds };
        baseQuery.company = companyId;
    }
    else {
        baseQuery.employee = currentUserId;
        baseQuery.company = companyId;
    }

    const featureQuery = { ...query };
    delete featureQuery.my;

    const features = new APIFeatures(
      LeaveRequest.find(baseQuery)
        .populate('employee', 'name email avatar department')
        .populate('responses.author', 'name email avatar role'),
      featureQuery
    )
      .filter()
      .search(['employeeName', 'reason', 'leaveType'])
      .sort()
      .limitFields()
      .paginate();

    const leaveRequests = await features.query;
    const totalCount = await LeaveRequest.countDocuments(baseQuery);
    
    return {
      total: totalCount,
      count: leaveRequests.length,
      page: query.page * 1 || 1,
      limit: query.limit * 1 || 100,
      data: leaveRequests
    };
  }

  async getLeaveRequestById(user, companyId, id) {
    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId })
      .populate('employee', 'name email avatar department position')
      .populate('responses.author', 'name email avatar role');
      
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const currentUserId = user.id || user._id;
    const roleKey = normalizeRole(user.role);

    const isOwner = leaveRequest.employee._id.toString() === currentUserId.toString();
    const isSuperAdminOrHR = ['superadmin', 'hr'].includes(roleKey);

    if (!isOwner && !isSuperAdminOrHR) {
      if (roleKey === 'admin' || roleKey === 'manager') {
        const teamIds = await getTeamIds(currentUserId);
        const isInTeam = teamIds.includes(leaveRequest.employee._id.toString());
        if (!isInTeam) {
          throw new ForbiddenError("You don't have permission to view this leave request");
        }
      } else {
        throw new ForbiddenError("You don't have permission to view this leave request");
      }
    }

    return leaveRequest;
  }

  async updateLeaveRequest(userId, companyId, id, data) {
    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const isOwner = leaveRequest.employee.toString() === userId.toString();

    if (!isOwner) {
      const callerUser = await User.findById(userId);
      const roleKey = normalizeRole(callerUser?.role || '');
      if (!['superadmin', 'hr', 'admin'].includes(roleKey)) {
        throw new ForbiddenError("You don't have permission to update this leave request");
      }
    }

    if (leaveRequest.status !== 'Pending') {
      throw new BadRequestError("Cannot update leave request after it has been processed");
    }

    const updatedStartDate = data.startDate || leaveRequest.startDate;
    const updatedEndDate = data.endDate || leaveRequest.endDate;
    const updatedBusinessDays = calculateBusinessDays(updatedStartDate, updatedEndDate);
    if (updatedBusinessDays < 1) {
      throw new BadRequestError("Selected date range includes only weekends/holidays. Please choose at least one working day.");
    }

    const updatedLeaveRequest = await LeaveRequest.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    ).populate('employee', 'name email avatar');

    if (isOwner && updatedLeaveRequest.employee) {
      const empId = updatedLeaveRequest.employee._id || updatedLeaveRequest.employee;
      
      const dayDifference = updatedBusinessDays - calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate);
      
      const updateData = {
        $set: {
          'leaveHistory.$[elem].leaveType': updatedLeaveRequest.leaveType,
          'leaveHistory.$[elem].startDate': updatedLeaveRequest.startDate,
          'leaveHistory.$[elem].endDate': updatedLeaveRequest.endDate,
          'leaveHistory.$[elem].reason': updatedLeaveRequest.reason,
          'leaveHistory.$[elem].status': updatedLeaveRequest.status,
          'leaveHistory.$[elem].daysTaken': updatedBusinessDays
        }
      };

      if (dayDifference !== 0) {
        updateData.$inc = {
          [`leaves.${updatedLeaveRequest.leaveType.toLowerCase()}`]: -dayDifference,
          bookedLeaves: dayDifference,
          avalaibleLeaves: -dayDifference
        };
      }

      await User.findByIdAndUpdate(
        empId,
        updateData,
        {
          runValidators: true,
          arrayFilters: [{ 'elem.leaveId': updatedLeaveRequest._id }]
        }
      );
    }

    return updatedLeaveRequest;
  }

  async addLeaveResponse(user, companyId, id, content) {
    if (!content || content.trim() === '') {
      throw new BadRequestError("Response content is required");
    }

    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const currentUser = await User.findById(user.id || user._id);
    if (!currentUser) throw new NotFoundError("User not found");

    const currentUserId = currentUser._id.toString();
    const roleKey = currentUser.role.replace(/\s+/g, '').toLowerCase();

    const isOwner = leaveRequest.employee.toString() === currentUserId;
    const isSuperAdminOrHR = ['superadmin', 'hr'].includes(roleKey);
    let isAuthorized = false;

    if (isOwner || isSuperAdminOrHR) {
      isAuthorized = true;
    } else if (roleKey === 'admin' || roleKey === 'manager') {
      const teamIds = await getTeamIds(currentUserId);
      if (teamIds.includes(leaveRequest.employee.toString())) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenError("You don't have permission to respond to this leave request");
    }

    const newResponse = {
      author: currentUser._id,
      content: content.trim(),
      time: new Date(),
      role: currentUser.role,
      isSystemNote: false,
      isEdited: false,
      attachments: []
    };

    leaveRequest.responses.push(newResponse);
    await leaveRequest.save();

    const savedResponse = leaveRequest.responses[leaveRequest.responses.length - 1];

    const populatedResponse = await LeaveRequest.findOne(
      { _id: id, 'responses._id': savedResponse._id },
      { 'responses.$': 1 }
    ).populate('responses.author', 'name email avatar role');

    const responseData = populatedResponse.responses[0];

    const formattedResponse = {
      _id: responseData._id,
      content: responseData.content,
      time: responseData.time,
      role: responseData.role,
      attachments: responseData.attachments || [],
      isEdited: responseData.isEdited || false,
      isSystemNote: responseData.isSystemNote || false,
      author: {
        _id: responseData.author._id,
        email: responseData.author.email,
        name: responseData.author.name,
        avatar: responseData.author.avatar,
        role: responseData.author.role
      }
    };

    this.sendLeaveResponseNotification(leaveRequest, currentUser, content).catch(console.error);

    return formattedResponse;
  }

  async deleteLeaveResponse(user, companyId, id, responseId) {
    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const response = leaveRequest.responses.id(responseId);
    if (!response) throw new NotFoundError("Response");

    const currentUserId = user.id || user._id;
    const isAuthor = response.author.toString() === currentUserId.toString();
    const roleKey = normalizeRole(user.role);
    const isSuperAdminOrHR = ['superadmin', 'hr'].includes(roleKey);

    if (!isAuthor && !isSuperAdminOrHR) {
      throw new ForbiddenError("You can only delete your own responses");
    }

    response.deleteOne();
    await leaveRequest.save();

    return leaveRequest;
  }

  async updateLeaveStatus(user, companyId, id, status, responseNote) {
    if (!["Pending", "Approved", "Rejected"].includes(status)) throw new BadRequestError("Invalid status");

    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request not found");

    const roleKey = normalizeRole(user.role);
    const currentUserId = user.id || user._id;

    if (!['superadmin', 'admin', 'manager'].includes(roleKey)) {
       throw new ForbiddenError("You do not have permission to update leave status.");
    }

    if (leaveRequest.employee.toString() === currentUserId.toString()) {
       throw new ForbiddenError("You cannot update the status of your own leave request.");
    }

    if (roleKey === 'admin' || roleKey === 'manager') {
       const adminTeam = await getTeamIds(currentUserId);
       if (!adminTeam.includes(leaveRequest.employee.toString())) {
          throw new ForbiddenError("You can only manage leaves for your own team hierarchy.");
       }
    }

    const start = moment.utc(leaveRequest.startDate, 'YYYY-MM-DD').startOf('day');
    const end = moment.utc(leaveRequest.endDate, 'YYYY-MM-DD').startOf('day');
    const daysDiff = calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate);

    if (status === 'Approved') {
      const existingLeaves = await LeaveRequest.find({
        employee: leaveRequest.employee,
        company: companyId,
        status: "Approved",
        _id: { $ne: leaveRequest._id }
      });
      const overlappingLeaves = existingLeaves.filter(leave => {
        const existingStart = new Date(leave.startDate);
        const existingEnd = new Date(leave.endDate);
        const newStart = new Date(leaveRequest.startDate);
        const newEnd = new Date(leaveRequest.endDate);
        return (existingStart <= newEnd && newStart <= existingEnd);
      });
      if (overlappingLeaves.length > 0) {
        throw new BadRequestError('Cannot approve: Leave dates overlap with an already approved leave.');
      }
    }

    const updateObj = { $set: { "leaveHistory.$[elem].status": status } };
    const oldStatus = leaveRequest.status;

    if (status === "Rejected" && oldStatus !== "Rejected") {
      updateObj.$inc = {
        [`leaves.${leaveRequest.leaveType.toLowerCase()}`]: daysDiff,
        bookedLeaves: -daysDiff,
        avalaibleLeaves: daysDiff
      };
    } else if (status === "Approved" && oldStatus === "Rejected") {
      updateObj.$inc = {
        [`leaves.${leaveRequest.leaveType.toLowerCase()}`]: -daysDiff,
        bookedLeaves: daysDiff,
        avalaibleLeaves: -daysDiff
      };
    }

    await User.findByIdAndUpdate(leaveRequest.employee, updateObj, {
      arrayFilters: [{ "elem.leaveId": leaveRequest._id }]
    });

    const currentUser = await User.findById(currentUserId);
    if (currentUser && (oldStatus !== status || responseNote)) {
      const responseContent = responseNote ||
        `Leave request status changed from "${oldStatus}" to "${status}" by ${currentUser.name} (${currentUser.role}).`;
     
      leaveRequest.responses.push({
        author: currentUser._id,
        content: responseContent,
        time: new Date(),
        role: currentUser.role,
        isSystemNote: !responseNote
      });
    }

    leaveRequest.status = status;
    await leaveRequest.save();

    if (leaveRequest.email) {
      const emailSubject = `Leave Request ${status}`;
      const User = require("../models/userSchema");
      const requester = await User.findOne({ email: leaveRequest.email, company: leaveRequest.company });
      const actionUrl = generateActionUrl(requester ? requester.role : 'employee', 'leave', 'status');

      const payload = {
        employeeName: leaveRequest.employeeName || 'Employee',
        leaveType: leaveRequest.leaveType === 'PTO' ? 'Paid Time Off (PTO)' : leaveRequest.leaveType,
        startDate: moment.utc(leaveRequest.startDate).format('MMM DD, YYYY'),
        endDate: moment.utc(leaveRequest.endDate).format('MMM DD, YYYY'),
        days: calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate),
        note: responseNote || '',
        actionUrl,
        refId: (leaveRequest._id.toString()).slice(-6).toUpperCase()
      };

      const emailBody = status === 'Approved' 
        ? emailTemplates.leaveApproved(payload) 
        : emailTemplates.leaveRejected(payload);

      sendEmail({
        to: leaveRequest.email,
        subject: emailSubject,
        htmlContent: emailBody,
        companyId: leaveRequest.company
      }).catch(err => console.error('[Email Error] Leave status update:', err.message));
    }

    try {
      const isApproved = status === 'Approved';
      if (status === 'Approved' || status === 'Rejected') {
        await createNotification({
          recipient: leaveRequest.employee,
          type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          title: isApproved ? 'Leave Approved' : 'Leave Rejected',
          message: isApproved
            ? `Your ${leaveRequest.leaveType} leave request from ${moment.utc(leaveRequest.startDate).format('MMM DD, YYYY')} to ${moment.utc(leaveRequest.endDate).format('MMM DD, YYYY')} has been approved.`
            : `Your ${leaveRequest.leaveType} leave request has been rejected.${responseNote ? ' Reason: ' + responseNote : ''}`,
          relatedEntity: { entityType: 'leave', entityId: leaveRequest._id },
        });
      }
    } catch (notifErr) {
      console.error('[Notification] Leave status update:', notifErr.message);
    }

    if (status === "Approved" && oldStatus !== "Approved") {
      const timeTrackerEntries = [];
      const curr = start.clone();
      while (curr.isSameOrBefore(end)) {
        const dateStart = curr.toDate();
        const existingEntry = await TimeTracker.findOne({ user: leaveRequest.employee, date: dateStart });
        if (existingEntry) {
          existingEntry.status = 'Leave';
          existingEntry.notes = `Leave Request Approved: ${leaveRequest.leaveType}`;
          await existingEntry.save();
        } else {
          timeTrackerEntries.push({
            user: leaveRequest.employee,
            company: leaveRequest.company,
            date: dateStart,
            status: 'Leave',
            notes: `Leave: ${leaveRequest.leaveType} - ${leaveRequest.reason || 'No reason provided'}`
          });
        }
        curr.add(1, 'days');
      }
      if (timeTrackerEntries.length > 0) await TimeTracker.insertMany(timeTrackerEntries);
    } else if (status !== "Approved" && oldStatus === "Approved") {
      await TimeTracker.deleteMany({
        user: leaveRequest.employee,
        date: { $gte: start.toDate(), $lte: end.toDate() },
        status: 'Leave'
      });
    }

    return leaveRequest;
  }

  async deleteLeaveRequest(user, companyId, id) {
    const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
    if (!leaveRequest) throw new NotFoundError("Leave request");

    const currentUserId = user.id || user._id;
    const isOwner = leaveRequest.employee.toString() === currentUserId.toString();
    const roleKey = normalizeRole(user.role);
    const isSuperAdminOrHR = ['superadmin', 'hr'].includes(roleKey);

    if (leaveRequest.status !== 'Pending') {
      throw new BadRequestError("Cannot delete leave request after it has been processed");
    }

    if (!isOwner && !isSuperAdminOrHR) {
      throw new ForbiddenError("You don't have permission to delete this leave request");
    }

    if (isSuperAdminOrHR || isOwner) {
      const start = moment.utc(leaveRequest.startDate, 'YYYY-MM-DD').startOf('day');
      const end = moment.utc(leaveRequest.endDate, 'YYYY-MM-DD').startOf('day');
      const daysDiff = calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate);
     
      await User.findByIdAndUpdate(leaveRequest.employee, {
        $inc: {
          [`leaves.${leaveRequest.leaveType.toLowerCase()}`]: daysDiff,
          bookedLeaves: -daysDiff,
          avalaibleLeaves: daysDiff
        },
        $pull: {
          leaveHistory: { leaveId: leaveRequest._id }
        }
      });
     
      await TimeTracker.deleteMany({
        user: leaveRequest.employee,
        date: { $gte: start.toDate(), $lte: end.toDate() },
        status: 'Leave'
      });
    }

    await LeaveRequest.findOneAndDelete({ _id: id, company: companyId });
  }

  async manageHolidays(user) {
    const roleKey = normalizeRole(user.role);
    if (!['superadmin', 'admin', 'hr'].includes(roleKey)) {
      throw new ForbiddenError("Permission Denied: Managers cannot manage company holidays.");
    }
  }

  async getLeaveBalance(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    return {
      leaves: user.leaves || {},
      bookedLeaves: user.bookedLeaves || 0,
      avalaibleLeaves: user.avalaibleLeaves || 0
    };
  }

  async bulkUpdateStatus(user, companyId, ids, status) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) throw new BadRequestError("No leave IDs provided");
    if (!["Pending", "Approved", "Rejected"].includes(status)) throw new BadRequestError("Invalid status");

    const roleKey = normalizeRole(user.role);
    if (!['superadmin', 'admin', 'manager'].includes(roleKey)) {
       throw new ForbiddenError("You do not have permission to update leave status.");
    }

    const results = [];
    const currentUserId = user.id || user._id;

    for (const id of ids) {
      try {
        const leaveRequest = await LeaveRequest.findOne({ _id: id, company: companyId });
        if (!leaveRequest || leaveRequest.status === status) continue;

        if (roleKey === 'admin' || roleKey === 'manager') {
           const adminTeam = await getTeamIds(currentUserId);
           if (!adminTeam.includes(leaveRequest.employee.toString())) continue;
        }

        const daysDiff = calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate);
        const updateObj = { $set: { "leaveHistory.$[elem].status": status } };
        const oldStatus = leaveRequest.status;

        if (status === "Rejected" && oldStatus !== "Rejected") {
          updateObj.$inc = {
            [`leaves.${leaveRequest.leaveType.toLowerCase()}`]: daysDiff,
            bookedLeaves: -daysDiff,
            avalaibleLeaves: daysDiff
          };
        } else if (status === "Approved" && oldStatus === "Rejected") {
          updateObj.$inc = {
            [`leaves.${leaveRequest.leaveType.toLowerCase()}`]: -daysDiff,
            bookedLeaves: daysDiff,
            avalaibleLeaves: -daysDiff
          };
        }

        await User.findByIdAndUpdate(leaveRequest.employee, updateObj, {
          arrayFilters: [{ "elem.leaveId": leaveRequest._id }]
        });

        leaveRequest.status = status;
        await leaveRequest.save();
        results.push(id);
      } catch (err) {
        console.error("Bulk update error for id", id, err);
      }
    }

    return results;
  }

  async exportLeaves(user, companyId) {
    const roleKey = normalizeRole(user.role);
    let baseQuery = { company: companyId };
    
    if (!['superadmin', 'hr', 'admin'].includes(roleKey)) {
      throw new ForbiddenError("You don't have permission to export leaves");
    }

    if (roleKey === 'admin') {
      const fullTeamIds = await getTeamIds(user.id || user._id);
      baseQuery.employee = { $in: fullTeamIds };
    }

    const leaves = await LeaveRequest.find(baseQuery)
      .populate('employee', 'name email department')
      .sort('-createdAt');

    let csv = 'Employee,Email,Department,Leave Type,Start Date,End Date,Reason,Status,Applied At\n';
    leaves.forEach(l => {
      const emp = l.employee || {};
      csv += `"${emp.name || l.employeeName}","${emp.email || l.email}","${emp.department || ''}","${l.leaveType}","${l.startDate}","${l.endDate}","${(l.reason || '').replace(/"/g, '""')}","${l.status}","${l.appliedAt}"\n`;
    });
    return csv;
  }

  // =========================================================
  // EMAIL HELPERS
  // =========================================================
  
  async sendLeaveCreationNotification(leaveRequest) {
    let employee = null;
    if (leaveRequest.employee) {
      employee = await User.findById(leaveRequest.employee).populate('department', 'name');
    }

    const notifyRoles = await User.find({
      $or: [{ role: 'Super Admin' }, { role: 'Admin' }, { role: 'HR' }],
      company: leaveRequest.company
    });
    
    let recipients = notifyRoles;
    if (employee && employee.reportsTo) {
      const manager = await User.findById(employee.reportsTo);
      if (manager) recipients.push(manager);
    }
   
    const recipientEmails = [...new Set(recipients.map(user => user.email).filter(Boolean))];
   
    if (recipientEmails.length > 0) {
      const subject = `New Leave Request: ${leaveRequest.employeeName} - ${leaveRequest.leaveType}`;
      
      const payloadBase = {
        employeeName: leaveRequest.employeeName || employee?.name || 'Employee',
        leaveType: leaveRequest.leaveType === 'PTO' ? 'Paid Time Off (PTO)' : leaveRequest.leaveType,
        startDate: moment.utc(leaveRequest.startDate).format('MMM DD, YYYY'),
        endDate: moment.utc(leaveRequest.endDate).format('MMM DD, YYYY'),
        days: calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate),
        submittedDate: moment(leaveRequest.appliedAt || leaveRequest.createdAt || new Date()).tz(TIMEZONE).format('MMM DD, YYYY'),
        reason: leaveRequest.reason || '',
        refId: (leaveRequest._id ? leaveRequest._id.toString() : '').slice(-6).toUpperCase()
      };
      
      const User = require("../models/userSchema");
      const users = await User.find({ email: { $in: recipientEmails }, company: leaveRequest.company });
      const userRoleMap = {};
      users.forEach(u => { userRoleMap[u.email] = u.role; });

      recipientEmails.forEach(email => {
        const role = userRoleMap[email] || 'employee';
        const actionUrl = generateActionUrl(role, 'leave', 'created');
        const htmlContent = emailTemplates.leaveSubmitted({ ...payloadBase, actionUrl });
        sendEmail({
          to: email,
          subject: subject,
          htmlContent: htmlContent,
          companyId: leaveRequest.company
        }).catch(err => console.error(`Failed to send leave notification to ${email}:`, err.message));
      });
    }
  }
   
  async sendLeaveResponseNotification(leaveRequest, responder, responseContent) {
    if (leaveRequest.email && leaveRequest.email !== responder.email) {
      const subject = `New Response on Your Leave Request: ${leaveRequest.leaveType}`;
      const User = require("../models/userSchema");
      const requester = await User.findOne({ email: leaveRequest.email, company: leaveRequest.company });
      const actionUrl = generateActionUrl(requester ? requester.role : 'employee', 'leave', 'response');

        
      const payload = {
        employeeName: leaveRequest.employeeName || 'Employee',
        leaveType: leaveRequest.leaveType,
        authorName: responder.name,
        content: responseContent,
        actionUrl: actionUrl,
        refId: (leaveRequest._id.toString()).slice(-6).toUpperCase()
      };
      const htmlContent = emailTemplates.leaveResponseAdded(payload);
     
      sendEmail({
        to: leaveRequest.email,
        subject: subject,
        htmlContent: htmlContent,
        companyId: leaveRequest.company
      }).catch(err => console.error(`Failed to send response notification to ${leaveRequest.email}:`, err.message));
    }
  }
   
}

module.exports = new LeaveService();
