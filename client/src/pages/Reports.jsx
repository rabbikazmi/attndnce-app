import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { formatDisplayDate } from "../lib/date";

export default function Reports() {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, leave: 0, total: 0, attendancePercent: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        const response = await apiRequest("/api/students", { method: "GET" }, token);
        setStudents(response.students || []);
      } catch (fetchError) {
        setError(fetchError.message);
      }
    }

    loadStudents();
  }, [token]);

  async function generateReport() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (studentId !== "all") {
        params.set("studentId", studentId);
      }
      if (from) {
        params.set("from", from);
      }
      if (to) {
        params.set("to", to);
      }

      const response = await apiRequest(`/api/attendance/report?${params.toString()}`, { method: "GET" }, token);
      setRecords(response.records || []);
      setSummary(response.summary || { present: 0, absent: 0, leave: 0, total: 0, attendancePercent: 0 });
    } catch (reportError) {
      setError(reportError.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAllStudentsReport() {
    setStudentId("all");
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (from) {
        params.set("from", from);
      }
      if (to) {
        params.set("to", to);
      }

      const response = await apiRequest(`/api/attendance/report?${params.toString()}`, { method: "GET" }, token);
      setRecords(response.records || []);
      setSummary(response.summary || { present: 0, absent: 0, leave: 0, total: 0, attendancePercent: 0 });
    } catch (reportError) {
      setError(reportError.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const lines = ["Date,Student,Roll No,Status"];
    records.forEach((record) => {
      lines.push(`${record.date},${escapeCsv(record.studentName)},${escapeCsv(record.rollNo)},${record.status}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "it2-attendance-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredStudents = useMemo(() => students.slice().sort((left, right) => String(left.rollNo || "").localeCompare(String(right.rollNo || ""))), [students]);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Filter attendance by student and date range.</p>
        </div>
      </section>

      {error ? <div className="toast toast--error">{error}</div> : null}

      <section className="card">
        <div className="filters-grid">
          <label className="field">
            <span>Student</span>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="all">All Students</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.rollNo} - {student.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>

          <label className="field">
            <span>To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <div className="field field--actions">
            <span>&nbsp;</span>
            <div className="row-actions">
              <button type="button" className="button button--primary" onClick={generateReport} disabled={loading}>
                {loading ? "Generating..." : "Generate"}
              </button>
              <button type="button" className="button button--secondary" onClick={generateAllStudentsReport} disabled={loading}>
                Generate All
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Attendance Report</h2>
            <p>{records.length ? `${records.length} record(s) found.` : "No records generated yet."}</p>
          </div>
          <button type="button" className="button button--secondary" onClick={exportCsv} disabled={!records.length}>
            Export CSV
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDisplayDate(record.date)}</td>
                  <td>{record.studentName}</td>
                  <td>
                    <span className={`status-pill status-pill--${record.status}`}>{record.status}</span>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan="3" className="empty-state">
                    Run a report to see attendance entries.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" className="summary-row">
                  Present {summary.present} · Absent {summary.absent} · Leave {summary.leave} · Attendance {summary.attendancePercent}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}

function escapeCsv(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}
