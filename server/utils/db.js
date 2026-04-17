const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_FILE_PATH || path.join(__dirname, "..", "db.json");
const initialDb = { users: [], students: [], attendance: [], sessions: [] };

function ensureDbFile() {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2));
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw.trim()) {
    return { ...initialDb };
  }

  const parsed = JSON.parse(raw);
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    students: Array.isArray(parsed.students) ? parsed.students : [],
    attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
  };
}

function writeDb(db) {
  ensureDbFile();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function toDateKey(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthRange(monthValue) {
  const [yearPart, monthPart] = String(monthValue).split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!year || !month) {
    return null;
  }

  const start = `${yearPart}-${monthPart.padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);

  return { start, end };
}

function buildStudentLookup(db) {
  const lookup = new Map();

  db.students.forEach((student) => {
    lookup.set(student.id, student);
  });

  db.users.forEach((user) => {
    if (!lookup.has(user.id)) {
      lookup.set(user.id, {
        id: user.id,
        userId: user.id,
        name: user.name,
        rollNo: user.rollNo,
        batch: user.batch,
        createdAt: user.createdAt,
        email: user.email
      });
    }
  });

  return lookup;
}

function buildStudentRoster(db) {
  const lookup = buildStudentLookup(db);
  return Array.from(lookup.values()).sort((left, right) => {
    const leftRoll = String(left.rollNo || "");
    const rightRoll = String(right.rollNo || "");
    return leftRoll.localeCompare(rightRoll);
  });
}

function buildAttendanceSummary(db, allowedStudentIds) {
  const roster = buildStudentRoster(db).filter((student) => {
    if (!allowedStudentIds) {
      return true;
    }

    return allowedStudentIds.has(student.id);
  });

  const grouped = new Map();
  roster.forEach((student) => {
    grouped.set(student.id, {
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo,
      batch: student.batch,
      present: 0,
      absent: 0,
      leave: 0,
      total: 0,
      attendancePercent: 0
    });
  });

  db.attendance.forEach((record) => {
    if (allowedStudentIds && !allowedStudentIds.has(record.studentId)) {
      return;
    }

    if (!grouped.has(record.studentId)) {
      return;
    }

    const item = grouped.get(record.studentId);
    item.total += 1;
    if (record.status === "present") {
      item.present += 1;
    } else if (record.status === "absent") {
      item.absent += 1;
    } else if (record.status === "leave") {
      item.leave += 1;
    }
  });

  const summary = Array.from(grouped.values()).map((item) => ({
    ...item,
    attendancePercent: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0
  }));

  const totals = summary.reduce(
    (accumulator, item) => {
      accumulator.present += item.present;
      accumulator.absent += item.absent;
      accumulator.leave += item.leave;
      accumulator.recordCount += item.total;
      return accumulator;
    },
    { present: 0, absent: 0, leave: 0, recordCount: 0 }
  );

  totals.overallAttendancePercent = totals.recordCount > 0 ? Math.round((totals.present / totals.recordCount) * 100) : 0;
  totals.totalStudents = summary.length;

  return { summary, totals };
}

function buildAttendanceReport(db, { from, to, studentId, sessionId, allowedStudentIds }) {
  const roster = buildStudentLookup(db);
  const effectiveStudentIds = new Set();

  if (studentId) {
    effectiveStudentIds.add(studentId);
  } else if (allowedStudentIds) {
    allowedStudentIds.forEach((id) => effectiveStudentIds.add(id));
  } else {
    roster.forEach((student) => effectiveStudentIds.add(student.id));
  }

  const records = db.attendance
    .filter((record) => {
      if (!effectiveStudentIds.has(record.studentId)) {
        return false;
      }

      if (sessionId && String(record.sessionId || "") !== String(sessionId)) {
        return false;
      }

      if (from && record.date < from) {
        return false;
      }

      if (to && record.date > to) {
        return false;
      }

      return true;
    })
    .map((record) => {
      const student = roster.get(record.studentId);
      return {
        id: record.id,
        date: record.date,
        sessionId: record.sessionId || null,
        studentId: record.studentId,
        studentName: student ? student.name : record.studentName,
        rollNo: student ? student.rollNo : record.rollNo,
        status: record.status,
        markedBy: record.markedBy,
        createdAt: record.createdAt,
        proxyMeta: record.proxyMeta || { flags: [], dismissed: false }
      };
    })
    .sort((left, right) => {
      if (left.date === right.date) {
        return String(left.rollNo || "").localeCompare(String(right.rollNo || ""));
      }

      return left.date.localeCompare(right.date);
    });

  const present = records.filter((record) => record.status === "present").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const leave = records.filter((record) => record.status === "leave").length;
  const total = records.length;

  return {
    records,
    summary: {
      present,
      absent,
      leave,
      total,
      attendancePercent: total > 0 ? Math.round((present / total) * 100) : 0
    }
  };
}

module.exports = {
  buildAttendanceReport,
  buildAttendanceSummary,
  buildStudentLookup,
  buildStudentRoster,
  getMonthRange,
  getTodayKey,
  readDb,
  sanitizeUser,
  toDateKey,
  writeDb
};
