const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { adminOnly, auth } = require("../middleware/auth");
const { readDb, writeDb } = require("../utils/db");

const router = express.Router();

router.use(auth, adminOnly);

router.get("/", (req, res) => {
  const db = readDb();
  const students = db.students
    .slice()
    .sort((left, right) => String(left.rollNo || "").localeCompare(String(right.rollNo || "")));

  return res.json({ students });
});

router.post("/", (req, res) => {
  const { name, rollNo, batch } = req.body || {};

  if (!name || !rollNo) {
    return res.status(400).json({ error: "Name and roll number are required." });
  }

  if (batch && String(batch).toUpperCase() !== "IT2") {
    return res.status(403).json({ error: "This app is only for IT2 students." });
  }

  const db = readDb();
  const student = {
    id: uuidv4(),
    name: String(name).trim(),
    rollNo: String(rollNo).trim(),
    batch: "IT2",
    createdAt: new Date().toISOString()
  };

  db.students.push(student);
  writeDb(db);
  return res.status(201).json({ student });
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, rollNo, batch } = req.body || {};
  const db = readDb();
  const student = db.students.find((entry) => entry.id === id);

  if (!student) {
    return res.status(404).json({ error: "Student not found." });
  }

  if (batch && String(batch).toUpperCase() !== "IT2") {
    return res.status(403).json({ error: "This app is only for IT2 students." });
  }

  if (name) {
    student.name = String(name).trim();
  }

  if (rollNo) {
    student.rollNo = String(rollNo).trim();
  }

  student.batch = "IT2";

  const linkedUser = db.users.find((entry) => entry.id === student.userId || entry.id === student.id);
  if (linkedUser) {
    linkedUser.name = student.name;
    linkedUser.rollNo = student.rollNo;
    linkedUser.batch = student.batch;
  }

  writeDb(db);
  return res.json({ student });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const studentIndex = db.students.findIndex((entry) => entry.id === id);

  if (studentIndex === -1) {
    return res.status(404).json({ error: "Student not found." });
  }

  const [student] = db.students.splice(studentIndex, 1);
  db.users = db.users.filter((entry) => entry.id !== student.id && entry.id !== student.userId);
  db.attendance = db.attendance.filter((entry) => entry.studentId !== student.id);
  writeDb(db);

  return res.json({ success: true });
});

module.exports = router;
