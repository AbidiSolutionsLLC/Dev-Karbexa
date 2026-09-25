const ActivityLog = require("../models/activityLogSchema");

class ActivityLogService {
  // Fire-and-forget recording helper. It never throws so callers can use it
  // inside try/catch blocks (or alone) without breaking the main request.
  async recordActivity({ actorId, action, entityType = "task", entityId = null, level = "info", companyId = null }) {
    try {
      if (!actorId) return null;
      const log = new ActivityLog({
        user: actorId,
        action,
        entityType,
        entityId,
        level,
        company: companyId,
      });
      const saved = await log.save();
      return saved;
    } catch (err) {
      console.error("[ActivityLog] Failed to record activity:", err.message);
      return null;
    }
  }

  async getActivityLogs({ companyId, page = 1, limit = 10, seenId = null }) {
    const skip = (page - 1) * limit;
    const filter = {};
    if (companyId) filter.company = companyId;

    const searchFilter = { ...filter };
    if (seenId) {
      searchFilter._id = { $lt: seenId };
    }

    const data = await ActivityLog.find(searchFilter)
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalLogs = await ActivityLog.countDocuments(filter);

    return {
      data,
      pagination: {
        total: totalLogs,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalLogs / Math.max(Number(limit), 1)),
      },
    };
  }
}

module.exports = new ActivityLogService();