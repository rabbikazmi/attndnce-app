require("dotenv").config();

const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const sessionsRoutes = require("./routes/sessions");
const studentsRoutes = require("./routes/students");
const { readDb } = require("./utils/db");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "it2_attendance_secret_2024";
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

app.set("jwtSecret", JWT_SECRET);
app.set("trust proxy", true);

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/sessions", sessionsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  readDb();
  console.log(`IT2 Attendance API running on port ${PORT}`);
});
