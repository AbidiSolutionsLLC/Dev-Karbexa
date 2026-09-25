const timeTrackerService = require("../services/timeTrackerService");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");

exports.getAllTimeLogs = catchAsync(async (req, res) => {
  const logs = await timeTrackerService.getAllTimeLogs(req.user);
  res.status(200).json(ApiResponse.success(logs));
});

exports.updateTimeLog = catchAsync(async (req, res) => {
  const log = await timeTrackerService.updateTimeLog(req.user, req.params.id, req.body);
  res.status(200).json(ApiResponse.success(log));
});

exports.getMonthlyAttendance = catchAsync(async (req, res) => {
  const { month, year } = req.params;
  const attendance = await timeTrackerService.getMonthlyAttendance(req.user, month, year, req.query.userId);
  res.status(200).json(ApiResponse.success(attendance));
});

exports.checkIn = catchAsync(async (req, res) => {
  const timezone = req.headers['x-timezone'] || req.user.timeZone || 'America/New_York';
  const result = await timeTrackerService.checkIn(req.user.id, timezone);
  // Send back result.log inside ApiResponse, but keep result.message. The original response had { message, log }
  res.status(200).json(ApiResponse.success({ log: result.log }, result.message));
});

exports.checkOut = catchAsync(async (req, res) => {
  const timezone = req.headers['x-timezone'] || req.user.timeZone || 'America/New_York';
  const log = await timeTrackerService.checkOut(req.user.id, timezone);
  res.status(200).json(ApiResponse.success({ log }, "Checked out successfully"));
});

exports.getMyTimeLogs = catchAsync(async (req, res) => {
  const logs = await timeTrackerService.getMyTimeLogs(req.user.id);
  res.status(200).json(ApiResponse.success(logs));
});

exports.getDailyLog = catchAsync(async (req, res) => {
  const log = await timeTrackerService.getDailyLog(req.user, req.params.userId);
  if (!log) return res.status(200).json(ApiResponse.success({ log: null }, "No log found for today"));
  res.status(200).json(ApiResponse.success({ log }));
});

exports.deleteTimeLog = catchAsync(async (req, res) => {
  await timeTrackerService.deleteTimeLog(req.user, req.params.id);
  res.status(200).json(ApiResponse.success(null, "Deleted successfully"));
});

exports.createTimeLog = catchAsync(async (req, res) => {
  const newLog = await timeTrackerService.createTimeLog(req.user, req.body);
  res.status(201).json(ApiResponse.success(newLog));
});

exports.getTimeLogById = catchAsync(async (req, res) => {
  const log = await timeTrackerService.getTimeLogById(req.params.id);
  res.status(200).json(ApiResponse.success(log));
});

exports.getAdminAttendanceSummary = catchAsync(async (req, res) => {
  const summary = await timeTrackerService.getAdminAttendanceSummary(req.user, req.query.date, req.query.startDate, req.query.endDate);
  res.status(200).json(ApiResponse.success(summary));
});

exports.getAllTimeTrackers = exports.getAllTimeLogs;
exports.createTimeTracker = exports.createTimeLog;
exports.updateTimeTracker = exports.updateTimeLog;
exports.checkin = exports.checkIn;
exports.checkout = exports.checkOut;