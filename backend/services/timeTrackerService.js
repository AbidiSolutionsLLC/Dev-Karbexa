const TimeTracker = require("../models/timeTrackerSchema");
const User = require("../models/userSchema");
const LeaveRequest = require("../models/leaveRequestSchema");
const Holiday = require("../models/holidaySchema");
const { NotFoundError, BadRequestError, ForbiddenError } = require("../utils/ExpressError");
const { getSearchScope } = require("../utils/rbac"); 
const { getTeamIds } = require("../utils/hierarchy"); // Assuming this is extracted to hierarchy.js as previously seen
const { normalizeRole } = require("../utils/rbacUtils");
const { 
    getStartOfDay, 
    getCurrentTime, 
    isWeekend,
    TIMEZONE
} = require("../utils/dateUtils");
const moment = require("moment-timezone");

class TimeTrackerService {
  async getAllTimeLogs(user) {
    let query = {};
    const scope = await getSearchScope(user, 'attendance');
    Object.assign(query, scope);
    
    // Enforce company isolation
    if (user.company) {
       const companyUsers = await User.find({ company: user.company }).select('_id');
       const companyUserIds = companyUsers.map(u => u._id);
       if (query.user) {
           // Intersect
           query.user = { $in: [].concat(query.user.$in || query.user).filter(id => companyUserIds.some(cId => cId.equals(id))) };
       } else {
           query.user = { $in: companyUserIds };
       }
    }

    return TimeTracker.find(query)
      .populate('user', 'name email designation department avatar empID')
      .sort({ date: -1 });
  }

  async updateTimeLog(user, logId, data) {
    const { role } = user;
    const roleKey = normalizeRole(role);

    if (roleKey !== 'superadmin') {
      throw new ForbiddenError("Access Denied. Only Super Admins can edit attendance records.");
    }

    let updates = { ...data };

    if (updates.checkInTime && updates.checkOutTime) {
      const start = moment(updates.checkInTime).tz('UTC');
      const end = moment(updates.checkOutTime).tz('UTC');
      const duration = moment.duration(end.diff(start));
      
      if (updates.totalHours === undefined) {
          updates.totalHours = parseFloat(duration.asHours().toFixed(2));
      }

      if (!updates.status) {
        if (updates.totalHours >= 8) updates.status = "Present";
        else if (updates.totalHours >= 4.5) updates.status = "Half Day";
        else updates.status = "Absent";
      }
    }

    if (updates.checkInTime) {
        updates.date = getStartOfDay(updates.checkInTime);
    } else if (updates.date) {
        updates.date = getStartOfDay(updates.date);
    }

    // Enforce company isolation, allowing legacy records without a company
    const filter = { _id: logId };
    if (user.company) {
      filter.$or = [
        { company: user.company },
        { company: { $exists: false } },
        { company: null }
      ];
    }

    const log = await TimeTracker.findOneAndUpdate(filter, updates, { 
      new: true,
      runValidators: true 
    }).populate('user', 'name email');

    if (!log) throw new NotFoundError("Attendance record not found");
    return log;
  }

  async getMonthlyAttendance(user, month, year, targetUserId) {
    const { id, role } = user;

    const startDate = moment.tz([year, month - 1], TIMEZONE).startOf('month').toDate();
    const endDate = moment.tz([year, month - 1], TIMEZONE).endOf('month').toDate();

    let query = { date: { $gte: startDate, $lte: endDate } };
    const scope = await getSearchScope(user, 'attendance');
    Object.assign(query, scope);

    if (targetUserId) {
        if (scope.user && scope.user.$in) {
            if (!scope.user.$in.map(String).includes(String(targetUserId))) {
                query._id = null;
            } else {
                query.user = targetUserId;
            }
        } else if (scope.user && String(scope.user) !== String(targetUserId)) {
            query._id = null;
        } else {
            query.user = targetUserId;
        }
    } else {
        // Fallback if no target passed, default to themselves regardless of scope
        query.user = user.id || user._id;
    }

    return TimeTracker.find(query)
      .populate('user', 'name designation avatar department')
      .sort({ date: 1 });
  }

  async checkIn(userId, timezone = 'UTC') {
    const { getCurrentTime, getStartOfDay, isWeekend } = require("../utils/dateUtils");
    const nowMoment = getCurrentTime(timezone);
    const todayStart = getStartOfDay(nowMoment.toDate(), timezone);

    if (isWeekend(nowMoment.toDate(), timezone)) {
      throw new ForbiddenError(`Check-in is not allowed on weekends (${timezone}).`);
    }

    const abandonedSession = await TimeTracker.findOne({ 
      user: userId, 
      checkInTime: { $exists: true },
      checkOutTime: { $exists: false } 
    });

    let previousSessionMsg = "";

    if (abandonedSession) {
      const isSameDay = abandonedSession.date.getTime() === todayStart.getTime();

      if (isSameDay) {
        throw new BadRequestError("You already have an active session for today. Please check out instead.");
      } else {
        // Abandoned session spans across days. We auto-checkout at the end of that day.
        const endOfAbandonedDay = moment.tz(abandonedSession.date, timezone).endOf('day').toDate();
        abandonedSession.checkOutTime = endOfAbandonedDay;
        abandonedSession.autoCheckedOut = true;
        
        const start = moment(abandonedSession.checkInTime).tz(timezone);
        const end = moment(endOfAbandonedDay).tz(timezone);
        const duration = moment.duration(end.diff(start));
        abandonedSession.totalHours = parseFloat(duration.asHours().toFixed(2));
        
        if (abandonedSession.totalHours >= 8) abandonedSession.status = "Present";
        else if (abandonedSession.totalHours >= 4.5) abandonedSession.status = "Half Day";
        else abandonedSession.status = "Absent";
        
        abandonedSession.notes = (abandonedSession.notes || "") + " | Auto-closed (Forgot to checkout)";
        
        await abandonedSession.save();
        previousSessionMsg = "Your previous open session was auto-closed. ";
      }
    }

    const currentUser = await User.findById(userId).select('company');
    const companyId = currentUser ? currentUser.company : null;

    const newLog = await TimeTracker.findOneAndUpdate(
      { user: userId, date: todayStart },
      {
        $setOnInsert: {
          checkInTime: nowMoment.toDate(),
          status: 'Present',
          company: companyId
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // If checkInTime is older than what we just tried to insert (meaning it already existed)
    // we should let them know they already checked in.
    if (newLog.checkInTime.getTime() !== nowMoment.toDate().getTime()) {
      throw new BadRequestError(`You have already completed your check-in for today (${timezone}).`);
    }

    require("./activityLogService").recordActivity({
      actorId: userId,
      action: "checked in",
      entityType: "timetracker",
      entityId: newLog._id,
      companyId,
    }).catch(() => {});

    return { message: `${previousSessionMsg}Checked in successfully.`, log: newLog };
  }

  async checkOut(userId, timezone = 'UTC') {
    const { getCurrentTime } = require("../utils/dateUtils");
    const nowMoment = getCurrentTime(timezone);

    const currentLogs = await TimeTracker.find({ 
      user: userId, 
      checkOutTime: { $exists: false } 
    });

    if (currentLogs.length === 0) throw new BadRequestError("No active check-in found.");

    // In case of duplicates, close all of them to prevent cronjob from auto-closing them later
    let returnLog = null;
    for (let currentLog of currentLogs) {
      const checkInMoment = moment(currentLog.checkInTime).tz(timezone);
      if (!checkInMoment.isValid()) {
        await TimeTracker.findByIdAndDelete(currentLog._id);
        continue;
      }

      currentLog.checkOutTime = nowMoment.toDate();
      const duration = moment.duration(nowMoment.diff(checkInMoment));
      let totalHours = parseFloat(duration.asHours().toFixed(2));

      if (isNaN(totalHours)) totalHours = 0;
      currentLog.totalHours = totalHours;

      if (totalHours >= 8) currentLog.status = "Present";
      else if (totalHours >= 4.5) currentLog.status = "Half Day";
      else currentLog.status = "Absent";

      await currentLog.save();
      returnLog = currentLog;
    }
    
    if (!returnLog) throw new BadRequestError("Corrupted check-in data. Session cleared.");

    try {
      const userDoc = await User.findById(userId).select('company');
      require("./activityLogService").recordActivity({
        actorId: userId,
        action: "checked out",
        entityType: "timetracker",
        entityId: returnLog._id,
        companyId: userDoc ? userDoc.company : null,
        level: "success",
      }).catch(() => {});
    } catch (activityErr) {
      console.error("[ActivityLog] check-out record failed:", activityErr.message);
    }

    return returnLog;
  }

  async getMyTimeLogs(userId) {
    return TimeTracker.find({ user: userId }).sort({ date: -1 });
  }

  async getDailyLog(currentUser, targetUserId) {
    const todayStart = getStartOfDay();
    const roleKey = normalizeRole(currentUser.role);
    
    // Security check: only self, or admin/HR, or manager of team
    if (currentUser.id !== targetUserId && roleKey !== 'superadmin' && roleKey !== 'hr') {
       if (roleKey === 'manager' || roleKey === 'admin') {
          const teamIds = await getTeamIds(currentUser.id);
          if (!teamIds.some(id => id.toString() === targetUserId.toString())) {
             throw new ForbiddenError("Not authorized to view this log");
          }
       } else {
          throw new ForbiddenError("Not authorized to view this log");
       }
    }
    
    // If duplicates exist, return the one that is most complete (e.g. checked out)
    const logs = await TimeTracker.find({ user: targetUserId, date: todayStart }).sort({ checkOutTime: -1, checkInTime: -1 });
    return logs.length > 0 ? logs[0] : null;
  }

  async deleteTimeLog(user, logId) {
    if (normalizeRole(user.role) !== 'superadmin') {
      throw new ForbiddenError("Access Denied. Only Super Admin can delete records.");
    }
    
    const filter = { _id: logId };
    if (user.company) {
      filter.$or = [
        { company: user.company },
        { company: { $exists: false } },
        { company: null }
      ];
    }

    const log = await TimeTracker.findOneAndDelete(filter);
    if (!log) throw new NotFoundError("Time log not found");
  }

  async createTimeLog(user, data) {
    const roleKey = normalizeRole(user.role);
    if (data.user && !['superadmin', 'admin'].includes(roleKey)) {
        data.user = user.id;
    } else if (!data.user) {
        data.user = user.id;
    }
    
    if (user.company) {
      data.company = user.company;
      
      // Validate employee belongs to same company
      if (data.user.toString() !== user.id.toString()) {
          const emp = await User.findById(data.user).select('company');
          if (!emp || !emp.company || emp.company.toString() !== user.company.toString()) {
              throw new ForbiddenError("Cannot add time log for an employee from a different company.");
          }
      }
    }
    
    if (data.checkInTime) {
        data.date = getStartOfDay(data.checkInTime);
    } else if (data.date) {
        data.date = getStartOfDay(data.date);
    } else {
        data.date = getStartOfDay();
    }

    if (data.checkInTime && data.checkOutTime) {
        const start = moment(data.checkInTime).tz('UTC');
        const end = moment(data.checkOutTime).tz('UTC');
        const duration = moment.duration(end.diff(start));
        if (data.totalHours === undefined) {
            data.totalHours = parseFloat(duration.asHours().toFixed(2));
        }
        if (!data.status) {
            if (data.totalHours >= 8) data.status = "Present";
            else if (data.totalHours >= 4.5) data.status = "Half Day";
            else data.status = "Absent";
        }
    }

    return TimeTracker.create(data);
  }

  async getTimeLogById(logId) {
    const log = await TimeTracker.findById(logId).populate('user');
    if (!log) throw new NotFoundError("Time log not found");
    return log;
  }

  async getAdminAttendanceSummary(user, dateStr, startDateStr, endDateStr) {
    const nowEST = getCurrentTime();
    
    let startMoment, endMoment;
    if (startDateStr && endDateStr) {
      startMoment = moment.tz(startDateStr, 'UTC').startOf('day');
      endMoment = moment.tz(endDateStr, 'UTC').startOf('day');
    } else if (dateStr) {
      startMoment = moment.tz(dateStr, 'UTC').startOf('day');
      endMoment = startMoment.clone();
    } else {
      startMoment = nowEST.clone().startOf('day');
      endMoment = startMoment.clone();
    }

    if (endMoment.isAfter(nowEST, 'day')) {
      endMoment = nowEST.clone().startOf('day');
    }

    if (startMoment.isAfter(nowEST, 'day')) {
      return { present: [], halfDay: [], absent: [], onLeave: [], counts: { present: 0, halfDay: 0, absent: 0, onLeave: 0, total: 0 } };
    }

    const scope = await getSearchScope(user, 'attendance');
    
    let userQuery = {};
    if (scope.user) {
      userQuery._id = scope.user;
    } else if (scope._id === null) {
      return { present: [], halfDay: [], absent: [], onLeave: [], counts: { present: 0, halfDay: 0, absent: 0, onLeave: 0, total: 0 } };
    }

    if (user.company) {
      userQuery.company = user.company;
    }

    const usersInScope = await User.find(userQuery)
      .select('name email designation department avatar empID joiningDate')
      .populate('department', 'name');
    const userIds = usersInScope.map(u => u._id.toString());

    const targetStartDate = startMoment.toDate();
    const targetEndDate = endMoment.clone().endOf('day').toDate();
    const targetStartFormatted = startMoment.format('YYYY-MM-DD');
    const targetEndFormatted = endMoment.format('YYYY-MM-DD');

    const timeLogsAll = await TimeTracker.find({
      user: { $in: userIds },
      date: { $gte: targetStartDate, $lte: targetEndDate }
    }).populate({
      path: 'user',
      select: 'name email designation department avatar empID',
      populate: { path: 'department', select: 'name' }
    });

    const approvedLeavesAll = await LeaveRequest.find({
      employee: { $in: userIds },
      status: 'Approved',
      startDate: { $lte: targetEndDate },
      endDate: { $gte: targetStartDate }
    }).populate({
      path: 'employee',
      select: 'name email designation department avatar empID',
      populate: { path: 'department', select: 'name' }
    });

    const holidaysAll = await Holiday.find({
      date: { $gte: targetStartDate, $lte: targetEndDate }
    });

    let allPresent = [];
    let allHalfDay = [];
    let allAbsent = [];
    let allOnLeave = [];

    let curr = startMoment.clone();
    let daysInRange = 0;
    while (curr.isSameOrBefore(endMoment, 'day')) {
      daysInRange++;
      const currentStart = curr.clone().startOf('day').toDate();
      const currentFormatted = curr.format('YYYY-MM-DD');

      const timeLogs = timeLogsAll.filter(log => moment.utc(log.date).isSame(currentStart, 'day'));
      const presentUserIds = timeLogs.map(log => log.user._id.toString());

      const approvedLeaves = approvedLeavesAll.filter(leave => 
         moment.utc(leave.startDate, 'YYYY-MM-DD').format('YYYY-MM-DD') <= currentFormatted && 
         moment.utc(leave.endDate, 'YYYY-MM-DD').format('YYYY-MM-DD') >= currentFormatted
      );
      const onLeaveUserIds = approvedLeaves.map(leave => leave.employee._id.toString());

      const present = timeLogs.filter(log => log.status === 'Present');
      const halfDay = timeLogs.filter(log => log.status === 'Half Day');
      const explicitAbsentLogs = timeLogs.filter(log => log.status === 'Absent');
      const explicitLeaveLogs = timeLogs.filter(log => log.status === 'Leave' || log.status === 'On Leave');

      const virtualLeaves = approvedLeaves
        .filter(leave => !presentUserIds.includes(leave.employee._id.toString()))
        .map(leave => ({
          user: leave.employee,
          status: 'On Leave',
          leaveType: leave.leaveType,
          date: currentStart
        }));

      const onLeave = [...explicitLeaveLogs, ...virtualLeaves];
      const holiday = holidaysAll.find(h => moment.utc(h.date, 'YYYY-MM-DD').isSame(currentStart, 'day'));

      const virtualAbsent = usersInScope.filter(u => {
          const uId = u._id.toString();
          const hasLog = presentUserIds.includes(uId);
          const isOnLeave = onLeaveUserIds.includes(uId);
          if (hasLog || isOnLeave) return false;

          if (u.joiningDate) {
              const joinDate = moment.tz(u.joiningDate, 'UTC');
              if (curr.isBefore(joinDate, 'day')) return false;
          }
          return true;
      }).map(u => ({
          user: u,
          status: holiday ? 'Holiday' : 'Absent',
          holidayName: holiday ? holiday.holidayName : undefined,
          date: currentStart
      }));

      const absent = [...explicitAbsentLogs, ...virtualAbsent];

      allPresent.push(...present);
      allHalfDay.push(...halfDay);
      allAbsent.push(...absent);
      allOnLeave.push(...onLeave);

      curr.add(1, 'day');
    }

    return {
      present: allPresent,
      halfDay: allHalfDay,
      absent: allAbsent,
      onLeave: allOnLeave,
      counts: {
        present: allPresent.length,
        halfDay: allHalfDay.length,
        absent: allAbsent.length,
        onLeave: allOnLeave.length,
        total: usersInScope.length * daysInRange
      }
    };
  }
}

module.exports = new TimeTrackerService();
