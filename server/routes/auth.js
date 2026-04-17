const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { auth } = require("../middleware/auth");
const { readDb, sanitizeUser, writeDb } = require("../utils/db");

const router = express.Router();

function buildToken(req, user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      batch: user.batch,
      rollNo: user.rollNo,
      role: user.role
    },
    req.app.get("jwtSecret"),
    { expiresIn: "7d" }
  );
}

router.post("/signup", async (req, res) => {
  const { name, email, password, rollNo, batch } = req.body || {};

  if (!name || !email || !password || !rollNo || !batch) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (String(batch).toUpperCase() !== "IT2") {
    return res.status(403).json({ error: "This app is only for IT2 students." });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const db = readDb();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (db.users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ error: "Email already registered." });
  }

  const user = {
    id: uuidv4(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    batch: "IT2",
    rollNo: String(rollNo).trim(),
    role: db.users.length === 0 ? "admin" : "student",
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  db.students.push({
    id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    rollNo: user.rollNo,
    batch: user.batch,
    createdAt: user.createdAt
  });
  writeDb(db);

  const token = buildToken(req, user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const db = readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.find((entry) => entry.email === normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isValid = await bcrypt.compare(String(password), user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = buildToken(req, user);
  return res.json({ token, user: sanitizeUser(user) });
});

router.get("/me", auth, (req, res) => {
  const db = readDb();
  const user = db.users.find((entry) => entry.id === req.user.id);

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({ user: sanitizeUser(user) });
});

module.exports = router;
