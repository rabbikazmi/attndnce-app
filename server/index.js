const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const sessionsRoutes = require("./routes/sessions");
const studentsRoutes = require("./routes/students");
const { readDb } = require("./utils/db");

const app = express();
const JWT_SECRET = "it2_attendance_secret_2024";
const PORT = 5000;

app.set("jwtSecret", JWT_SECRET);
app.set("trust proxy", true);

app.use(cors());
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
  const db = readDb();
  if (!db.users.length) {
    console.log(`IT2 Attendance API running on http://localhost:${PORT}`);
  } else {
    console.log(`IT2 Attendance API running on http://localhost:${PORT}`);
  }
});
