import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { formatDisplayDate, monthOptions, monthRange } from "../lib/date";

export default function MyAttendance() {
  const { token, user } = useAuth();
  const [month, setMonth] = useState(monthOptions(1)[0]?.value || "");
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, attendancePercent: 0 });
  const [loading, setLoading] = useState(true);
  const options = useMemo(() => monthOptions(12), []);

  useEffect(() => {
    if (!month && options.length) {
      setMonth(options[0].value);
    }
  }, [month, options]);

  useEffect(() => {
    if (!month) {
      return;
    }

    async function loadAttendance() {
      setLoading(true);

      try {
        const { start, end } = monthRange(month);
        const response = await apiRequest(`/api/attendance/report?from=${start}&to=${end}`, { method: "GET" }, token);
        setRecords(response.records || []);
        setSummary(response.summary || { present: 0, absent: 0, attendancePercent: 0 });
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [month, token]);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <h1>My Attendance</h1>
          <p>My Attendance — {user?.name}</p>
        </div>
        <label className="field field--inline">
          <span>Month</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? <div className="page-state">Loading attendance...</div> : null}

      <section className="metric-grid metric-grid--three">
        <article className="metric-card metric-card--success">
          <span>Present</span>
          <strong>{summary.present}</strong>
        </article>
        <article className="metric-card metric-card--warning">
          <span>Absent</span>
          <strong>{summary.absent}</strong>
        </article>
        <article className="metric-card metric-card--accent">
          <span>Attendance %</span>
          <strong>{summary.attendancePercent}%</strong>
        </article>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Attendance Records</h2>
            <p>Read-only history for the selected month.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDisplayDate(record.date)}</td>
                  <td>
                    <span className={`status-pill status-pill--${record.status}`}>{record.status}</span>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan="2" className="empty-state">
                    No attendance records found for this month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
