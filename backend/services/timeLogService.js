const TimeLog = require("../models/timeLogsSchema");
const { BadRequestError, NotFoundError } = require("../utils/ExpressError");
const { moment, TIMEZONE } = require("../utils/dateUtils");
const { normalizeRole } = require("../utils/rbacUtils");

class TimeLogService {
  async createTimeLog(user, companyId, data, files) {
    const { job, date, description, hours, employeeId } = data;
    const role = normalizeRole(user.role);
    const employee = (employeeId && ['superadmin', 'admin'].includes(role)) ? employeeId : user.id || user._id;

    const estDate = moment.tz(date, TIMEZONE).startOf('day').toDate();

    const attachments = files?.map(file => ({
      blobName: file.blobName,
      url: file.url || file.path,
      originalname: file.originalname,
      format: file.mimetype,
      size: file.size
    })) || [];

    const timeLog = new TimeLog({
      employee,
      company: companyId,
      job,
      date: estDate, 
      description,
      hours,
      attachments
    });

    return timeLog.save();
  }

  async getEmployeeTimeLogs(user, companyId, query) {
    const { date, userId } = query; 
    const roleKey = normalizeRole(user.role);
    const employee = (userId && ['superadmin', 'admin', 'manager'].includes(roleKey)) ? userId : user.id || user._id;

    const dbQuery = { employee, company: companyId };
    if (date) {
      const startDate = moment.tz(date, TIMEZONE).startOf('day').toDate();
      const endDate = moment.tz(date, TIMEZONE).endOf('day').toDate();

      dbQuery.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    return TimeLog.find(dbQuery).sort({ date: 1 });
  }

  async updateTimeLog(timeLogId, data, files) {
    const { job, date, description, hours } = data;

    const timeLog = await TimeLog.findById(timeLogId);
    if (!timeLog) throw new NotFoundError("TimeLog");

    if (timeLog.isAddedToTimesheet) {
      throw new BadRequestError("Cannot update time log already added to a timesheet");
    }

    if (files && files.length > 0) {
      timeLog.attachments = files.map(file => ({
        blobName: file.blobName,
        url: file.url || file.path,
        originalname: file.originalname,
        format: file.mimetype,
        size: file.size
      }));
    }

    timeLog.job = job;
    timeLog.date = moment.tz(date, TIMEZONE).startOf('day').toDate();
    timeLog.description = description;
    timeLog.hours = hours;

    return timeLog.save();
  }

  async deleteTimeLog(timeLogId) {
    const timeLog = await TimeLog.findById(timeLogId);
    if (!timeLog) throw new NotFoundError("TimeLog");
    if (timeLog.isAddedToTimesheet) throw new BadRequestError("Cannot delete log already in timesheet");
    await timeLog.deleteOne();
  }

  async downloadTimeLogAttachment(timeLogId, attachmentId) {
    const timeLog = await TimeLog.findById(timeLogId);
    if (!timeLog) throw new NotFoundError("TimeLog");
    const attachment = timeLog.attachments.id(attachmentId);
    if (!attachment) throw new NotFoundError("Attachment");

    try {
      if (attachment.blobName) {
        const blockBlobClient = require("../config/azureConfig").containerClient.getBlockBlobClient(attachment.blobName);
        const sasUrl = await blockBlobClient.generateSasUrl({
          permissions: "r",
          expiresOn: new Date(new Date().valueOf() + 300 * 1000),
          contentDisposition: `attachment; filename="${attachment.originalname}"`
        });
        return sasUrl;
      } else if (attachment.url) {
        return attachment.url;
      } else {
        throw new BadRequestError("No valid attachment URL found");
      }
    } catch (error) {
      console.error("Download error:", error);
      throw new BadRequestError("Failed to generate download link");
    }
  }
}

module.exports = new TimeLogService();
