const express = require("express");
const { haversineDistanceMeters } = require("../utils/haversine");
const { adminOnly, auth } = require("../middleware/auth");
const {
  buildAttendanceReport,
  buildAttendanceSummary,
  buildStudentLookup,
  getTodayKey,
  readDb,
  toDateKey,
  writeDb
} = require("../utils/db");

const router = express.Router();

router.use(auth);

function normalizeIp(ipValue) {
  const raw = String(ipValue || "").trim();
  const first = raw.split(",")[0].trim();
  if (!first) {
    return "unknown";
  }

  if (first === "::1" || first === "127.0.0.1" || first.endsWith("127.0.0.1")) {
    return "loopback";
  }

  return first;
}

function ensureProxyMeta(record) {
  if (!record.proxyMeta) {
    record.proxyMeta = { flags: [], dismissed: false };
  }

  if (!Array.isArray(record.proxyMeta.flags)) {
    record.proxyMeta.flags = [];
  }

  if (typeof record.proxyMeta.dismissed !== "boolean") {
    record.proxyMeta.dismissed = false;
  }
}

function addFlag(record, code) {
  ensureProxyMeta(record);
  if (!record.proxyMeta.flags.includes(code)) {
    record.proxyMeta.flags.push(code);
  }
  record.proxyMeta.dismissed = false;
}

router.get("/", (req, res) => {
  const db = readDb();
  const date = toDateKey(req.query.date || getTodayKey());
  const allowedStudentIds = req.user.role === "admin" ? null : new Set([req.user.id]);

  const records = db.attendance
    .filter((record) => record.date === date)
    .filter((record) => {
      if (!allowedStudentIds) {
        return true;
      }

      return allowedStudentIds.has(record.studentId);
    })
    .map((record) => {
      const student = db.students.find((entry) => entry.id === record.studentId) || db.users.find((entry) => entry.id === record.studentId);
      return {
        id: record.id,
        date: record.date,
        studentId: record.studentId,
        studentName: student ? student.name : record.studentName,
        rollNo: student ? student.rollNo : record.rollNo,
        batch: student ? student.batch : record.batch,
        status: record.status,
        markedBy: record.markedBy,
        createdAt: record.createdAt
      };
    });

  return res.json({ date, records });
});

router.post("/", adminOnly, (req, res) => {
  const { date, records } = req.body || {};

  if (!date || !Array.isArray(records)) {
    return res.status(400).json({ error: "Date and records are required." });
  }

  const normalizedDate = toDateKey(date);
  const db = readDb();
  const students = buildStudentLookup(db);
  const validStatuses = new Set(["present", "absent", "leave"]);
  const incomingIds = new Set();

  const sanitizedRecords = records.reduce((result, record) => {
    if (!record || !record.studentId || !validStatuses.has(record.status)) {
      return result;
    }

    const student = students.get(record.studentId);
    if (!student) {
      return result;
    }

    incomingIds.add(record.studentId);
    result.push({
      id: `${normalizedDate}-${record.studentId}`,
      date: normalizedDate,
      sessionId: record.sessionId || null,
      studentId: record.studentId,
      studentName: student.name,
      rollNo: student.rollNo,
      batch: student.batch,
      status: record.status,
      markedBy: req.user.id,
      createdAt: new Date().toISOString(),
      proxyMeta: { flags: [], dismissed: false }
    });

    return result;
  }, []);

  db.attendance = db.attendance.filter((entry) => !(entry.date === normalizedDate && incomingIds.has(entry.studentId)));
  db.attendance.push(...sanitizedRecords);
  writeDb(db);

  return res.json({ success: true, records: sanitizedRecords });
});

router.post("/self-mark", (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only students can self mark attendance." });
  }

  const { lat, lng } = req.body || {};
  const studentLat = Number(lat);
  const studentLng = Number(lng);

  if (!Number.isFinite(studentLat) || !Number.isFinite(studentLng)) {
    return res.status(400).json({ error: "Valid coordinates are required." });
  }

  const db = readDb();
  const activeSession = db.sessions.find((session) => session.active);

  if (!activeSession) {
    return res.status(403).json({ error: "No active attendance session right now." });
  }

  const nowTime = Date.now();
  const expiresAt = new Date(activeSession.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && nowTime > expiresAt) {
    activeSession.active = false;
    writeDb(db);
    return res.status(403).json({ error: "Attendance session has expired." });
  }

  const alreadyMarked = db.attendance.find(
    (record) => record.sessionId === activeSession.id && record.studentId === req.user.id
  );
  if (alreadyMarked) {
    return res.status(409).json({ error: "Attendance already marked for this session." });
  }

  const distanceMeters = haversineDistanceMeters(
    { lat: studentLat, lng: studentLng },
    { lat: activeSession.location?.lat, lng: activeSession.location?.lng }
  );

  if (!Number.isFinite(distanceMeters) || distanceMeters > Number(activeSession.location?.radiusMeters || 0)) {
    return res.status(403).json({ error: "You are outside the classroom. Attendance not marked." });
  }

  const students = buildStudentLookup(db);
  const student = students.get(req.user.id);
  if (!student) {
    return res.status(404).json({ error: "Student not found." });
  }

  const ip = normalizeIp(req.ip || req.headers["x-forwarded-for"]);
  const nowIso = new Date().toISOString();
  const record = {
    id: `${activeSession.id}-${req.user.id}`,
    date: activeSession.date,
    sessionId: activeSession.id,
    studentId: req.user.id,
    studentName: student.name,
    rollNo: student.rollNo,
    batch: student.batch,
    status: "present",
    markedBy: req.user.id,
    createdAt: nowIso,
    ip,
    location: {
      lat: studentLat,
      lng: studentLng,
      distanceMeters: Math.round(distanceMeters)
    },
    proxyMeta: {
      flags: [],
      dismissed: false
    }
  };

  const sessionRecords = db.attendance.filter((item) => item.sessionId === activeSession.id);

  sessionRecords
    .filter((item) => normalizeIp(item.ip) === ip)
    .forEach((item) => {
      addFlag(item, "duplicate_ip");
      addFlag(record, "duplicate_ip");
    });

  const latestSameIp = sessionRecords
    .filter((item) => normalizeIp(item.ip) === ip)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  if (latestSameIp) {
    const seconds = Math.abs(new Date(nowIso).getTime() - new Date(latestSameIp.createdAt).getTime()) / 1000;
    if (seconds <= 10) {
      addFlag(latestSameIp, "rapid_repeat");
      addFlag(record, "rapid_repeat");
    }
  }

  sessionRecords
    .filter((item) => item.location && Number.isFinite(Number(item.location.lat)) && Number.isFinite(Number(item.location.lng)))
    .forEach((item) => {
      const peerDistance = haversineDistanceMeters(
        { lat: item.location.lat, lng: item.location.lng },
        { lat: studentLat, lng: studentLng }
      );
      if (peerDistance <= 5) {
        addFlag(item, "close_proximity");
        addFlag(record, "close_proximity");
      }
    });

  db.attendance.push(record);
  writeDb(db);
  return res.status(201).json({ success: true, record });
});

router.get("/report", (req, res) => {
  const db = readDb();
  const allowedStudentIds = req.user.role === "admin" ? null : new Set([req.user.id]);
  const studentId = req.user.role === "admin" ? String(req.query.studentId || "").trim() || null : req.user.id;
  const sessionId = String(req.query.sessionId || "").trim() || null;
  const from = req.query.from ? toDateKey(req.query.from) : null;
  const to = req.query.to ? toDateKey(req.query.to) : null;

  const report = buildAttendanceReport(db, {
    from,
    to,
    studentId,
    sessionId,
    allowedStudentIds
  });

  return res.json(report);
});

router.get("/summary", (req, res) => {
  const db = readDb();
  const allowedStudentIds = req.user.role === "admin" ? null : new Set([req.user.id]);
  const { summary, totals } = buildAttendanceSummary(db, allowedStudentIds);

  return res.json({ summary, totals });
});

router.get("/proxy-alerts", adminOnly, (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const db = readDb();
  const alerts = db.attendance
    .filter((record) => record.sessionId === sessionId)
    .filter((record) => Array.isArray(record.proxyMeta?.flags) && record.proxyMeta.flags.length > 0)
    .map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: record.studentName,
      rollNo: record.rollNo,
      ip: record.ip || "unknown",
      flags: record.proxyMeta.flags,
      dismissed: Boolean(record.proxyMeta.dismissed),
      createdAt: record.createdAt
    }));

  return res.json({ alerts });
});

router.post("/proxy-alerts/:attendanceId/dismiss", adminOnly, (req, res) => {
  const { attendanceId } = req.params;
  const db = readDb();
  const record = db.attendance.find((item) => item.id === attendanceId);

  if (!record) {
    return res.status(404).json({ error: "Alert record not found." });
  }

  ensureProxyMeta(record);
  record.proxyMeta.dismissed = true;
  record.proxyMeta.dismissedAt = new Date().toISOString();
  record.proxyMeta.dismissedBy = req.user.id;
  writeDb(db);

  return res.json({ success: true, record });
});

module.exports = router;
