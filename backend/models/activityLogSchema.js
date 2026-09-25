const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: [
        "task",
        "ticket",
        "leave",
        "timetracker",
        "holiday",
        "project",
        "expense",
        "timesheet",
        "user",
      ],
      default: "task",
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    level: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ company: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);