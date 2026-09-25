const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middlewares/authMiddleware");

// --- STEP 1: Import Controllers for the "Bridge" Routes ---
const leaveController = require("../controllers/leaveRequest");
const timesheetController = require("../controllers/timesheetController");
const expenseController = require("../controllers/expenseController"); // NEW
const downloadController = require("../controllers/downloadController"); // NEW

// --- STEP 2: Import Existing Route Files ---
const authRoutes = require("./webRoutes/authRoutes");
const userRoutes = require("./webRoutes/userRoutes");
const leaveRoutes = require("./webRoutes/leaveRoutes");
const logRoutes = require("./webRoutes/logRoutes");
const companyRoutes = require("./webRoutes/companyRoutes");
const projectRoutes = require("./webRoutes/projectRoutes");
const taskRoutes = require("./webRoutes/taskRoutes");
const ticketRoutes = require("./webRoutes/ticketRoutes");
const timeTrackerRoutes = require("./webRoutes/timeTrackerRoutes");
const holidayRoutes = require("./webRoutes/holidayRoutes");
const timeLogRoutes = require("./webRoutes/timeLogRoutes");
const timesheetRoutes = require("./webRoutes/timesheetRoutes");
const departmentRoutes = require("./webRoutes/departmentRoutes");
const adminDashboardRoutes = require("./webRoutes/adminDashboardRoutes");
const notificationRoutes = require("./webRoutes/notificationRoutes");
const expenseRoutes = require("./webRoutes/expenseRoutes"); // NEW
const filesRoute = require("./webRoutes/filesRoute");
const folderRoutes = require("./webRoutes/folderRoutes");
const payrollRoutes = require("./webRoutes/payrollRoutes");
const projectGroupRoutes = require("./webRoutes/projectGroupRoutes");
const activityRoutes = require("./webRoutes/activityRoutes");

const companyScope = require('../middlewares/companyScope');

// Fix for Leave Management
router.get("/getAllLeaves", isLoggedIn, companyScope, leaveController.getLeaveRequests);

// Fix for Approve Timesheets
router.get("/getAllTimesheets", isLoggedIn, companyScope, timesheetController.getAllTimesheets);
router.get("/getWeeklyTimesheets", isLoggedIn, companyScope, timesheetController.getWeeklyTimesheets);

// NEW: Bridge routes for Expenses (if frontend calls root endpoints)
router.get("/getAllExpenses", isLoggedIn, companyScope, expenseController.getAllExpenses);
router.get("/getPendingExpenses", isLoggedIn, companyScope, expenseController.getPendingExpenses);
router.get("/getMyExpenses", isLoggedIn, companyScope, expenseController.getMyExpenses);

// Fix: Universal download for all Azure blobs
router.get("/download", isLoggedIn, downloadController.downloadFile);

// Apply companyScope globally for all below authenticated routes
const authenticatedAndScoped = [isLoggedIn, companyScope];

// --- STEP 4: Standard Route Mounting ---
router.use("/auth", authRoutes); // Auth routes manage their own company logic
router.use("/users", ...authenticatedAndScoped, userRoutes);
router.use("/leaves", ...authenticatedAndScoped, leaveRoutes);
router.use("/logs", ...authenticatedAndScoped, logRoutes);
router.use("/companies", ...authenticatedAndScoped, companyRoutes);
router.use("/projects", ...authenticatedAndScoped, projectRoutes);
router.use("/tasks", ...authenticatedAndScoped, taskRoutes);
router.use("/tickets", ...authenticatedAndScoped, ticketRoutes);
router.use("/timetrackers", ...authenticatedAndScoped, timeTrackerRoutes);
router.use("/holidays", ...authenticatedAndScoped, holidayRoutes);
router.use("/time-logs", ...authenticatedAndScoped, timeLogRoutes);
router.use("/timesheets", ...authenticatedAndScoped, timesheetRoutes);
router.use("/departments", ...authenticatedAndScoped, departmentRoutes);
router.use("/admin-dashboard", ...authenticatedAndScoped, adminDashboardRoutes);
router.use("/notifications", ...authenticatedAndScoped, notificationRoutes);
router.use("/expenses", ...authenticatedAndScoped, expenseRoutes); // NEW
router.use("/files", ...authenticatedAndScoped, filesRoute);
router.use("/folders", ...authenticatedAndScoped, folderRoutes);
router.use("/payroll", ...authenticatedAndScoped, payrollRoutes);
router.use("/project-groups", ...authenticatedAndScoped, projectGroupRoutes);
router.use("/activities", ...authenticatedAndScoped, activityRoutes);

router.use("/master", require("./masterRoutes"));

module.exports = router;