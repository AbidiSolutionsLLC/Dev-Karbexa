const activityLogService = require("../services/activityLogService");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");

exports.getActivities = catchAsync(async (req, res) => {
  const { page, limit, seenId } = req.query;
  const result = await activityLogService.getActivityLogs({
    companyId: req.companyId || req.user?.company,
    page,
    limit: limit || 10,
    seenId,
  });
  res.status(200).json(ApiResponse.success(result.data, "Activities retrieved successfully", result.pagination));
});

exports.recordActivity = catchAsync(async (req, res) => {
  const { action, entityType, entityId, level } = req.body;
  const user = req.user || {};
  const log = await activityLogService.recordActivity({
    actorId: user.id || user._id,
    action,
    entityType,
    entityId,
    level,
    companyId: req.companyId || user.company,
  });
  res.status(201).json(ApiResponse.success(log, "Activity recorded successfully"));
});