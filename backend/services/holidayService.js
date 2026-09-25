const Holiday = require("../models/holidaySchema");
const User = require("../models/userSchema");
const TimeTracker = require("../models/timeTrackerSchema");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../utils/ExpressError");

class HolidayService {
  async createHoliday(user, data) {
    const { date, day, holidayName, holidayType, description, isRecurring } = data;

    const existingHoliday = await Holiday.findOne({ date });
    if (existingHoliday) throw new BadRequestError("Holiday for this date already exists");

    const newHoliday = new Holiday({
      date,
      day,
      holidayName,
      holidayType,
      description,
      isRecurring: isRecurring || false,
    });

    const savedHoliday = await newHoliday.save();

    const { moment } = require("../utils/dateUtils");
    const holidayDate = moment.utc(date, 'YYYY-MM-DD').toDate();

    const allUsers = await User.find({ empStatus: "Active" }).select("_id company");
    const userIds = allUsers.map(user => user._id);

    const existingEntries = await TimeTracker.find({
      date: holidayDate,
      user: { $in: userIds }
    });

    const existingUserIds = new Set(existingEntries.map(entry => entry.user.toString()));
    const entriesToUpdate = [];
    const entriesToCreate = [];

    for (const entry of existingEntries) {
      if (entry.status !== 'Leave') {
        entriesToUpdate.push(entry._id);
      }
    }

    for (const user of allUsers) {
      if (!existingUserIds.has(user._id.toString())) {
        entriesToCreate.push({
          user: user._id,
          company: user.company,
          date: holidayDate,
          status: 'Holiday',
          notes: `Holiday: ${holidayName}`
        });
      }
    }

    if (entriesToUpdate.length > 0) {
      await TimeTracker.updateMany(
        { _id: { $in: entriesToUpdate } },
        { $set: { status: 'Holiday', notes: `Holiday: ${holidayName}` } }
      );
    }

    if (entriesToCreate.length > 0) {
      await TimeTracker.insertMany(entriesToCreate);
    }

    require("./activityLogService").recordActivity({
      actorId: user.id || user._id,
      action: `added a holiday (${holidayName})`,
      entityType: "holiday",
      entityId: savedHoliday._id,
      companyId: user.company || null,
      level: "info",
    }).catch(() => {});

    return savedHoliday;
  }

  async getAllHolidays() {
    return Holiday.find().sort({ date: 1 });
  }

  async getHolidayById(id) {
    const holiday = await Holiday.findById(id);
    if (!holiday) throw new NotFoundError("Holiday");
    return holiday;
  }

  async updateHoliday(user, id, updates) {
    const { moment } = require("../utils/dateUtils");
    const holiday = await Holiday.findById(id);
    if (!holiday) throw new NotFoundError("Holiday");

    const oldDate = moment.utc(holiday.date, 'YYYY-MM-DD').toDate();

    const allowedFields = ["date", "day", "holidayName", "holidayType", "description", "isRecurring"];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) holiday[field] = updates[field];
    });

    const updatedHoliday = await holiday.save();

    if (updates.date) {
      const newDate = moment.utc(updates.date, 'YYYY-MM-DD').toDate();

      await TimeTracker.updateMany(
        { date: oldDate, status: { $ne: 'Leave' } },
        { $set: { status: 'Present', notes: '' } }
      );

      const allUsers = await User.find({ empStatus: "Active" }).select("_id company");
      const timeTrackerEntries = [];

      for (const u of allUsers) {
        const existingEntry = await TimeTracker.findOne({ user: u._id, date: newDate });
        if (existingEntry) {
          if (existingEntry.status !== 'Leave') {
            existingEntry.status = 'Holiday';
            existingEntry.notes = `Holiday: ${holiday.holidayName}`;
            await existingEntry.save();
          }
        } else {
          timeTrackerEntries.push({
            user: u._id,
            company: u.company,
            date: newDate,
            status: 'Holiday',
            notes: `Holiday: ${holiday.holidayName}`
          });
        }
      }

      if (timeTrackerEntries.length > 0) await TimeTracker.insertMany(timeTrackerEntries);
    } else if (updates.holidayName) {
      await TimeTracker.updateMany(
        { date: oldDate, status: 'Holiday' },
        { $set: { notes: `Holiday: ${holiday.holidayName}` } }
      );
    }

    return updatedHoliday;
  }

  async deleteHoliday(user, id) {
    const { moment } = require("../utils/dateUtils");
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) throw new NotFoundError("Holiday");

    const holidayDate = moment.utc(holiday.date, 'YYYY-MM-DD').toDate();

    await TimeTracker.updateMany(
      { date: holidayDate, status: 'Holiday' },
      { $set: { status: 'Present', notes: '' } }
    );
  }

  async getHolidaysByYear(year) {
    return Holiday.find({
      date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }
    }).sort({ date: 1 });
  }
}

module.exports = new HolidayService();
