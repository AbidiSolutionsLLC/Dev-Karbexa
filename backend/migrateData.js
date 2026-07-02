require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const User = require('./models/userSchema');
    const Ticket = require('./models/ticketManagementSchema');
    const Timesheet = require('./models/timesheetSchema');
    const LeaveRequest = require('./models/leaveRequestSchema');
    const Expense = require('./models/Expense');

    // Find an active user with a company
    const adminUser = await User.findOne({ company: { $exists: true, $ne: null } });
    
    if (!adminUser) {
      console.log("No valid company found in users collection.");
      process.exit(1);
    }

    const companyId = adminUser.company;
    console.log(`Using company ID: ${companyId}`);

    // Update Tickets
    let res = await Ticket.updateMany(
      { company: { $exists: false } },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} tickets.`);

    res = await Ticket.updateMany(
      { company: null },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} tickets (null company).`);

    // Update Timesheets
    res = await Timesheet.updateMany(
      { company: { $exists: false } },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} timesheets.`);

    res = await Timesheet.updateMany(
      { company: null },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} timesheets (null company).`);

    // Update LeaveRequests
    res = await LeaveRequest.updateMany(
      { company: { $exists: false } },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} leave requests.`);

    res = await LeaveRequest.updateMany(
      { company: null },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} leave requests (null company).`);

    // Update Expenses
    res = await Expense.updateMany(
      { company: { $exists: false } },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} expenses.`);

    res = await Expense.updateMany(
      { company: null },
      { $set: { company: companyId } }
    );
    console.log(`Updated ${res.modifiedCount} expenses (null company).`);

    console.log("Migration complete.");
    mongoose.disconnect();
  } catch (error) {
    console.error("Error migrating:", error);
    process.exit(1);
  }
}

migrate();
