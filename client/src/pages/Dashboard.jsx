import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { todayKey } from "../lib/date";

export default function Dashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState([]);
  const [totals, setTotals] = useState({ present: 0, absent: 0, leave: 0, overallAttendancePercent: 0 });
  const [todayCounts, setTodayCounts] = useState({ present: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("rollNo");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [studentsResponse, summaryResponse, todayResponse] = await Promise.all([
          apiRequest("/api/students", { method: "GET" }, token),
          apiRequest("/api/attendance/summary", { method: "GET" }, token),
          apiRequest(`/api/attendance?date=${todayKey()}`, { method: "GET" }, token)
        ]);

        setStudents(studentsResponse.students || []);
        setSummary(summaryResponse.summary || []);
        setTotals(summaryResponse.totals || { present: 0, absent: 0, leave: 0, overallAttendancePercent: 0 });

        const present = (todayResponse.records || []).filter((record) => record.status === "present").length;
        const absent = (todayResponse.records || []).filter((record) => record.status === "absent").length;
        setTodayCounts({ present, absent });
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [token]);

  const rows = useMemo(() => {
    const sorted = [...summary].sort((left, right) => {
      const leftValue = left[sortKey] ?? "";
      const rightValue = right[sortKey] ?? "";

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }

      return sortDirection === "asc"
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });

    return sorted;
  }, [sortDirection, sortKey, summary]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of IT2 attendance performance.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => navigate("/mark")}>Mark Attendance</button>
      </section>

      {loading ? <div className="page-state">Loading dashboard...</div> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Total Students</span>
          <strong>{students.length}</strong>
        </article>
        <article className="metric-card metric-card--success">
          <span>Today Present</span>
          <strong>{todayCounts.present}</strong>
        </article>
        <article className="metric-card metric-card--warning">
          <span>Today Absent</span>
          <strong>{todayCounts.absent}</strong>
        </article>
        <article className="metric-card metric-card--accent">
          <span>Overall Attendance %</span>
          <strong>{totals.overallAttendancePercent}%</strong>
        </article>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Student Summary</h2>
            <p>Sortable class attendance overview.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort("rollNo")}>Roll No</th>
                <th onClick={() => handleSort("name")}>Name</th>
                <th onClick={() => handleSort("present")}>Total Present</th>
                <th onClick={() => handleSort("absent")}>Total Absent</th>
                <th onClick={() => handleSort("attendancePercent")}>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr key={student.studentId}>
                  <td>{student.rollNo}</td>
                  <td>{student.name}</td>
                  <td>{student.present}</td>
                  <td>{student.absent}</td>
                  <td>
                    <span className={`percent-badge ${getPercentClass(student.attendancePercent)}`}>{student.attendancePercent}%</span>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan="5" className="empty-state">No students available yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function getPercentClass(value) {
  if (value >= 75) {
    return "percent-badge--success";
  }

  if (value >= 50) {
    return "percent-badge--warning";
  }

  return "percent-badge--danger";
}
