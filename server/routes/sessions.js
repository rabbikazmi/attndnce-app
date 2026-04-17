const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { adminOnly, auth } = require("../middleware/auth");
const { readDb, toDateKey, writeDb } = require("../utils/db");

const router = express.Router();

function expireSessionIfNeeded(session) {
  if (!session || !session.active) {
    return false;
  }

  const now = Date.now();
  const expires = new Date(session.expiresAt).getTime();
  if (Number.isFinite(expires) && now > expires) {
    session.active = false;
    return true;
  }

  return false;
}

function getActiveSession(db) {
  const session = db.sessions.find((item) => item.active);
  if (!session) {
    return null;
  }

  expireSessionIfNeeded(session);
  return session.active ? session : null;
}

router.post("/start", auth, adminOnly, (req, res) => {
  const { subject, durationMinutes, lat, lng, radiusMeters } = req.body || {};
  const parsedDuration = Number(durationMinutes);
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const parsedRadius = Number(radiusMeters);

  if (!subject || !Number.isFinite(parsedDuration) || parsedDuration <= 0 || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !Number.isFinite(parsedRadius) || parsedRadius <= 0) {
    return res.status(400).json({ error: "subject, durationMinutes, lat, lng and radiusMeters are required." });
  }

  const db = readDb();
  const activeSession = getActiveSession(db);
  if (activeSession) {
    return res.status(409).json({ error: "An attendance session is already active." });
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + parsedDuration * 60000);
  const session = {
    id: uuidv4(),
    date: toDateKey(startedAt.toISOString()),
    subject: String(subject).trim(),
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    location: {
      lat: parsedLat,
      lng: parsedLng,
      radiusMeters: parsedRadius
    },
    active: true,
    createdBy: req.user.id
  };

  db.sessions.push(session);
  writeDb(db);
  return res.status(201).json({ session });
});

router.post("/stop", auth, adminOnly, (req, res) => {
  const db = readDb();
  const activeSession = db.sessions.find((item) => item.active);

  if (!activeSession) {
    return res.status(404).json({ error: "No active session found." });
  }

  activeSession.active = false;
  writeDb(db);
  return res.json({ success: true, session: activeSession });
});

router.get("/active", auth, (req, res) => {
  const db = readDb();
  const activeSession = db.sessions.find((item) => item.active);

  if (!activeSession) {
    return res.json({ session: null });
  }

  if (expireSessionIfNeeded(activeSession)) {
    writeDb(db);
    return res.json({ session: null });
  }

  return res.json({ session: activeSession });
});

router.get("/", auth, adminOnly, (req, res) => {
  const db = readDb();

  db.sessions.forEach((session) => {
    expireSessionIfNeeded(session);
  });

  const sessions = db.sessions
    .slice()
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .map((session) => {
      const presentCount = db.attendance.filter((record) => record.sessionId === session.id && record.status === "present").length;
      const totalMarks = db.attendance.filter((record) => record.sessionId === session.id).length;
      return {
        ...session,
        presentCount,
        totalMarks
      };
    });

  writeDb(db);
  return res.json({ sessions });
});

module.exports = router;
