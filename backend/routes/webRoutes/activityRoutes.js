const express = require("express");
const router = express.Router();
const activityLogController = require("../../controllers/activityLogController");

// GET /activities - list recent team activities
router.get("/", activityLogController.getActivities);

// POST /activities - internal: manually record an activity entry
router.post("/", activityLogController.recordActivity);

module.exports = router;