const TimeTracker = require("../models/timeTrackerSchema");
const User = require("../models/userSchema");
const LeaveRequest = require("../models/leaveRequestSchema");
const { NotFoundError, BadRequestError, ForbiddenError } = require("../utils/ExpressError");
const { getSearchScope } = require("../utils/rbac"); 
const { getTeamIds } = require("../utils/hierarchy"); // Assuming this is extracted to hierarchy.js as previously seen
const { normalizeRole } = require("../utils/rbacUtils");
const { 
    getStartOfESTDay, 
    getCurrentESTTime, 
    isESTWeekend, 
    TIMEZONE 
} = require("../utils/dateUtils");
const moment = require("moment-timezone");

class TimeTrackerService {
  async getAllTimeLogs(user) {
    const { id, role } = user;
    const roleKey = normalizeRole(role);
    let query = {};

    if (roleKey === 'manager') {
      const myFullTeam = await getTeamIds(id);
      query.user = { $in: myFullTeam };
    } else {
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
      const start = moment(updates.checkInTime).tz(TIMEZONE);
      const end = moment(updates.checkOutTime).tz(TIMEZONE);
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
        updates.date = getStartOfESTDay(updates.checkInTime);
    } else if (updates.date) {
        updates.date = getStartOfESTDay(updates.date);
    }

    const log = await TimeTracker.findByIdAndUpdate(logId, updates, { 
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
    const roleKey = normalizeRole(role);

    if (targetUserId && ['superadmin', 'admin', 'manager', 'hr'].includes(roleKey)) {
       query.user = targetUserId;
    } else {
       if (roleKey === 'superadmin' || roleKey === 'hr') {
           if (user.company) {
               const companyUsers = await User.find({ company: user.company }).select('_id');
               query.user = { $in: companyUsers.map(u => u._id) };
           }
       } else if (roleKey === 'manager' || roleKey === 'admin') {
           const teamIds = await getTeamIds(id);
           query.user = { $in: teamIds };
       } else {
           query.user = id;
       }
    }

    return TimeTracker.find(query)
      .populate('user', 'name designation avatar department')
      .sort({ date: 1 });
  }

  async checkIn(userId) {
    const nowEST = getCurrentESTTime();
    const todayStartEST = getStartOfESTDay(nowEST.toDate());

    if (isESTWeekend(nowEST.toDate())) {
      throw new ForbiddenError("Check-in is not allowed on weekends (EST).");
    }

    const abandonedSession = await TimeTracker.findOne({ 
      user: userId, 
      checkOutTime: { $exists: false } 
    });

    let previousSessionMsg = "";

    if (abandonedSession) {
      const isSameDay = abandonedSession.date.getTime() === todayStartEST.getTime();

      if (isSameDay) {
        throw new BadRequestError("You already have an active session for today. Please check out instead.");
      } else {
        abandonedSession.checkOutTime = nowEST.toDate();
        abandonedSession.autoCheckedOut = true;
        abandonedSession.totalHours = 12; 
        abandonedSession.status = "Absent"; 
        abandonedSession.notes = (abandonedSession.notes || "") + " | Auto-closed (Forgot to checkout previous day)";
        
        await abandonedSession.save();
        previousSessionMsg = "Your previous open session was auto-closed as 'Absent'. ";
      }
    }

    const existingLogForToday = await TimeTracker.findOne({ user: userId, date: todayStartEST });
    if (existingLogForToday) {
      throw new BadRequestError("You have already completed your check-in for today (EST).");
    }

    const newLog = await TimeTracker.create({ 
      user: userId, 
      date: todayStartEST, 
      checkInTime: nowEST.toDate(), 
      status: 'Present' 
    });

    return { message: `${previousSessionMsg}Checked in successfully.`, log: newLog };
  }

  async checkOut(userId) {
    const nowEST = getCurrentESTTime();

    const currentLog = await TimeTracker.findOne({ 
      user: userId, 
      checkOutTime: { $exists: false } 
    }).sort({ checkInTime: -1 });

    if (!currentLog) throw new BadRequestError("No active check-in found.");

    const checkInMoment = moment(currentLog.checkInTime).tz(TIMEZONE);
    if (!checkInMoment.isValid()) {
      await TimeTracker.findByIdAndDelete(currentLog._id);
      throw new BadRequestError("Corrupted check-in data. Session cleared.");
    }

    currentLog.checkOutTime = nowEST.toDate();
    const duration = moment.duration(nowEST.diff(checkInMoment));
    let totalHours = parseFloat(duration.asHours().toFixed(2));

    if (isNaN(totalHours)) totalHours = 0;
    currentLog.totalHours = totalHours;

    if (totalHours >= 8) currentLog.status = "Present";
    else if (totalHours >= 4.5) currentLog.status = "Half Day";
    else currentLog.status = "Absent";

    await currentLog.save();
    return currentLog;
  }

  async getMyTimeLogs(userId) {
    return TimeTracker.find({ user: userId }).sort({ date: -1 });
  }

  async getDailyLog(currentUser, targetUserId) {
    const todayStart = getStartOfESTDay();
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
    
    return TimeTracker.findOne({ user: targetUserId, date: todayStart });
  }

  async deleteTimeLog(user, logId) {
    if (normalizeRole(user.role) !== 'superadmin') {
      throw new ForbiddenError("Access Denied. Only Super Admin can delete records.");
    }
    const log = await TimeTracker.findByIdAndDelete(logId);
    if (!log) throw new NotFoundError("Time log not found");
  }

  async createTimeLog(user, data) {
    const roleKey = normalizeRole(user.role);
    if (data.user && !['superadmin', 'admin'].includes(roleKey)) {
        data.user = user.id;
    } else if (!data.user) {
        data.user = user.id;
    }
    
    if (data.checkInTime) {
        data.date = getStartOfESTDay(data.checkInTime);
    } else if (data.date) {
        data.date = getStartOfESTDay(data.date);
    } else {
        data.date = getStartOfESTDay();
    }

    if (data.checkInTime && data.checkOutTime) {
        const start = moment(data.checkInTime).tz(TIMEZONE);
        const end = moment(data.checkOutTime).tz(TIMEZONE);
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

  async getAdminAttendanceSummary(user, dateStr) {
    const nowEST = getCurrentESTTime();
    const targetDateMoment = dateStr ? moment.tz(dateStr, TIMEZONE) : nowEST;
    
    if (targetDateMoment.isAfter(nowEST, 'day')) {
      return { present: [], halfDay: [], absent: [], onLeave: [], counts: { present: 0, halfDay: 0, absent: 0, onLeave: 0, total: 0 } };
    }

    const targetDateStart = targetDateMoment.clone().startOf('day').toDate();
    const targetDateFormatted = targetDateMoment.format('YYYY-MM-DD');
    
    const scope = await getSearchScope(user, 'attendance');
    
    let userQuery = {};
    if (scope.user) {
      userQuery._id = scope.user;
    } else if (scope._id === null) {
      return { present: [], halfDay: [], absent: [], onLeave: [], counts: { present: 0, halfDay: 0, absent: 0, onLeave: 0, total: 0 } };
    }

    const usersInScope = await User.find(userQuery).select('name email designation department avatar empID joiningDate');
    const userIds = usersInScope.map(u => u._id.toString());

    const timeLogs = await TimeTracker.find({
      user: { $in: userIds },
      date: targetDateStart
    }).populate('user', 'name email designation department avatar empID');

    const presentUserIds = timeLogs.map(log => log.user._id.toString());

    const approvedLeaves = await LeaveRequest.find({
      employee: { $in: userIds },
      status: 'Approved',
      startDate: { $lte: targetDateFormatted },
      endDate: { $gte: targetDateFormatted }
    }).populate('employee', 'name email designation department avatar empID');

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
        date: targetDateStart
      }));

    const onLeave = [...explicitLeaveLogs, ...virtualLeaves];

    const virtualAbsent = usersInScope.filter(u => {
        const uId = u._id.toString();
        const hasLog = presentUserIds.includes(uId);
        const isOnLeave = onLeaveUserIds.includes(uId);
        if (hasLog || isOnLeave) return false;

        if (u.joiningDate) {
            const joinDate = moment.tz(u.joiningDate, TIMEZONE);
            if (targetDateMoment.isBefore(joinDate, 'day')) return false;
        }
        return true;
    }).map(u => ({
        user: u,
        status: 'Absent',
        date: targetDateStart
    }));

    const absent = [...explicitAbsentLogs, ...virtualAbsent];

    return {
      present,
      halfDay,
      absent,
      onLeave,
      counts: {
        present: present.length,
        halfDay: halfDay.length,
        absent: absent.length,
        onLeave: onLeave.length,
        total: usersInScope.length
      }
    };
  }
}

module.exports = new TimeTrackerService();
