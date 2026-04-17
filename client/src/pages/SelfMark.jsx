import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { formatDisplayDate, monthOptions, monthRange } from "../lib/date";

function formatCountdown(targetIso) {
  if (!targetIso) {
    return "00:00";
  }

  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SelfMark() {
  const { token, user } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [locationState, setLocationState] = useState("idle");
  const [markMessage, setMarkMessage] = useState("");
  const [markError, setMarkError] = useState("");
  const [countdown, setCountdown] = useState("00:00");

  const [month, setMonth] = useState(monthOptions(1)[0]?.value || "");
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, attendancePercent: 0 });
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const options = useMemo(() => monthOptions(12), []);

  const browserSupportsGeo = typeof navigator !== "undefined" && "geolocation" in navigator;

  useEffect(() => {
    let timer;
    let unmounted = false;

    async function loadSession() {
      try {
        const response = await apiRequest("/api/sessions/active", { method: "GET" }, token);
        if (unmounted) {
          return;
        }
        setActiveSession(response.session);
        setCountdown(formatCountdown(response.session?.expiresAt));
      } catch (error) {
        if (!unmounted) {
          setActiveSession(null);
          setCountdown("00:00");
        }
      }
    }

    loadSession();
    timer = setInterval(loadSession, 30000);

    return () => {
      unmounted = true;
      clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(formatCountdown(activeSession?.expiresAt));
    }, 1000);

    return () => clearInterval(tick);
  }, [activeSession]);

  useEffect(() => {
    if (!month) {
      return;
    }

    async function loadAttendance() {
      setLoadingAttendance(true);

      try {
        const { start, end } = monthRange(month);
        const response = await apiRequest(`/api/attendance/report?from=${start}&to=${end}`, { method: "GET" }, token);
        setRecords(response.records || []);
        setSummary(response.summary || { present: 0, absent: 0, attendancePercent: 0 });
      } finally {
        setLoadingAttendance(false);
      }
    }

    loadAttendance();
  }, [month, token]);

  function markAttendance() {
    setMarkError("");
    setMarkMessage("");

    if (!browserSupportsGeo) {
      setMarkError("Location access is required to mark attendance. Please enable GPS and try again.");
      return;
    }

    if (!activeSession) {
      setMarkError("No active attendance session right now.");
      return;
    }

    setLocationState("fetching");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await apiRequest(
            "/api/attendance/self-mark",
            {
              method: "POST",
              body: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            },
            token
          );

          setLocationState("verified");
          setMarkMessage("Attendance marked successfully.");

          if (response?.record) {
            setRecords((current) => {
              const next = current.filter((entry) => entry.id !== response.record.id);
              next.push(response.record);
              return next.sort((left, right) => left.date.localeCompare(right.date));
            });
          }
        } catch (error) {
          setLocationState("idle");
          setMarkError(error.message);
        }
      },
      () => {
        setLocationState("idle");
        setMarkError("Location access is required to mark attendance. Please enable GPS and try again.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

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

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Active Attendance Session</h2>
            <p>{activeSession ? `${activeSession.subject} · Session closes in ${countdown}` : "No active session right now."}</p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={markAttendance}
            disabled={!activeSession || !browserSupportsGeo || locationState === "fetching"}
          >
            {locationState === "fetching" ? "Fetching Location..." : "Mark Attendance"}
          </button>
        </div>

        <div className="status-inline-row">
          <span className={locationState === "verified" ? "status-chip status-chip--ok" : "status-chip status-chip--muted"}>
            {locationState === "verified" ? "Location Verified" : "Fetching Location..."}
          </span>
          {!browserSupportsGeo ? <span className="status-chip status-chip--danger">This browser cannot provide coordinates.</span> : null}
        </div>

        {markMessage ? <div className="toast toast--success">{markMessage}</div> : null}
        {markError ? <div className="toast toast--error">{markError}</div> : null}
      </section>

      {loadingAttendance ? <div className="page-state">Loading attendance...</div> : null}

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
