import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { formatDisplayDate, todayKey } from "../lib/date";

const statusOptions = ["present", "absent", "leave"];

export default function MarkAttendance() {
  const { token } = useAuth();
  const [date, setDate] = useState(todayKey());
  const [sessionForm, setSessionForm] = useState({
    subject: "",
    durationMinutes: 30,
    lat: "",
    lng: "",
    radiusMeters: 40
  });
  const [activeSession, setActiveSession] = useState(null);
  const [countdown, setCountdown] = useState("00:00");
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [presentList, setPresentList] = useState([]);
  const [proxyAlerts, setProxyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [stoppingSession, setStoppingSession] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let timer;
    let unmounted = false;

    async function pollSession() {
      try {
        const response = await apiRequest("/api/sessions/active", { method: "GET" }, token);
        if (unmounted) {
          return;
        }

        const session = response.session;
        setActiveSession(session);
        if (session) {
          setCountdown(formatCountdown(session.expiresAt));
          await loadLiveData(session.id);
        } else {
          setPresentList([]);
          setProxyAlerts([]);
        }
      } catch (fetchError) {
        if (!unmounted) {
          setActiveSession(null);
        }
      }
    }

    pollSession();
    timer = setInterval(pollSession, 30000);

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
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [studentsResponse, attendanceResponse] = await Promise.all([
          apiRequest("/api/students", { method: "GET" }, token),
          apiRequest(`/api/attendance?date=${date}`, { method: "GET" }, token)
        ]);

        setStudents(studentsResponse.students || []);

        const nextMap = {};
        (attendanceResponse.records || []).forEach((record) => {
          nextMap[record.studentId] = record.status;
        });

        setAttendanceMap(nextMap);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [date, token]);

  async function loadLiveData(sessionId) {
    const [reportResponse, alertsResponse] = await Promise.all([
      apiRequest(`/api/attendance/report?sessionId=${sessionId}`, { method: "GET" }, token),
      apiRequest(`/api/attendance/proxy-alerts?sessionId=${sessionId}`, { method: "GET" }, token)
    ]);

    const presentRecords = (reportResponse.records || []).filter((record) => record.status === "present");
    setPresentList(presentRecords);
    setProxyAlerts(alertsResponse.alerts || []);
  }

  const rows = useMemo(() => [...students].sort((left, right) => String(left.rollNo || "").localeCompare(String(right.rollNo || ""))), [students]);

  function updateStatus(studentId, status) {
    setAttendanceMap((current) => ({ ...current, [studentId]: status }));
  }

  function handleSessionInputChange(event) {
    const { name, value } = event.target;
    setSessionForm((current) => ({ ...current, [name]: value }));
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location access is required to mark attendance. Please enable GPS and try again.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSessionForm((current) => ({
          ...current,
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude)
        }));
      },
      () => {
        setError("Location access is required to mark attendance. Please enable GPS and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function startSession(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setStartingSession(true);

    try {
      const response = await apiRequest(
        "/api/sessions/start",
        {
          method: "POST",
          body: {
            subject: sessionForm.subject,
            durationMinutes: Number(sessionForm.durationMinutes),
            lat: Number(sessionForm.lat),
            lng: Number(sessionForm.lng),
            radiusMeters: Number(sessionForm.radiusMeters)
          }
        },
        token
      );

      setActiveSession(response.session);
      setCountdown(formatCountdown(response.session?.expiresAt));
      setMessage("Attendance session started.");
      await loadLiveData(response.session.id);
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setStartingSession(false);
    }
  }

  async function stopSession() {
    setError("");
    setMessage("");
    setStoppingSession(true);

    try {
      await apiRequest("/api/sessions/stop", { method: "POST" }, token);
      setActiveSession(null);
      setPresentList([]);
      setProxyAlerts([]);
      setMessage("Attendance session stopped.");
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setStoppingSession(false);
    }
  }

  async function dismissAlert(attendanceId) {
    try {
      await apiRequest(`/api/attendance/proxy-alerts/${attendanceId}/dismiss`, { method: "POST" }, token);
      setProxyAlerts((current) => current.map((item) => (item.id === attendanceId ? { ...item, dismissed: true } : item)));
    } catch (dismissError) {
      setError(dismissError.message);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/api/attendance",
        {
          method: "POST",
          body: {
            date,
            records: rows.map((student) => ({
              studentId: student.id,
              status: attendanceMap[student.id] || "absent"
            }))
          }
        },
        token
      );

      setMessage(`Attendance saved for ${formatDisplayDate(date)}.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <h1>Mark Attendance</h1>
          <p>Select a date and set each student's status.</p>
        </div>
        <label className="field field--inline">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </section>

      {loading ? <div className="page-state">Loading students...</div> : null}
      {message ? <div className="toast toast--success">{message}</div> : null}
      {error ? <div className="toast toast--error">{error}</div> : null}

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Attendance Session Control</h2>
            <p>{activeSession ? `${activeSession.subject} · Session closes in ${countdown}` : "No active session."}</p>
          </div>
          <button type="button" className="button button--secondary" onClick={stopSession} disabled={!activeSession || stoppingSession}>
            {stoppingSession ? "Stopping..." : "Stop Session"}
          </button>
        </div>

        <form className="session-form-grid" onSubmit={startSession}>
          <label className="field">
            <span>Subject</span>
            <input name="subject" value={sessionForm.subject} onChange={handleSessionInputChange} placeholder="OOP Lab" required />
          </label>
          <label className="field">
            <span>Duration (minutes)</span>
            <input type="number" min="1" name="durationMinutes" value={sessionForm.durationMinutes} onChange={handleSessionInputChange} required />
          </label>
          <label className="field">
            <span>Latitude</span>
            <input name="lat" value={sessionForm.lat} onChange={handleSessionInputChange} placeholder="23.8103" required />
          </label>
          <label className="field">
            <span>Longitude</span>
            <input name="lng" value={sessionForm.lng} onChange={handleSessionInputChange} placeholder="90.4125" required />
          </label>
          <label className="field">
            <span>Radius (meters)</span>
            <input type="number" min="1" name="radiusMeters" value={sessionForm.radiusMeters} onChange={handleSessionInputChange} required />
          </label>
          <div className="session-form-actions">
            <button type="button" className="button button--secondary" onClick={useMyLocation}>
              Use My Location
            </button>
            <button type="submit" className="button button--primary" disabled={Boolean(activeSession) || startingSession}>
              {startingSession ? "Starting..." : "Start Session"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Live Present Students</h2>
            <p>Auto-refreshes while session is active.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Marked At</th>
              </tr>
            </thead>
            <tbody>
              {presentList.map((item) => (
                <tr key={item.id}>
                  <td>{item.rollNo}</td>
                  <td>{item.studentName}</td>
                  <td>{new Date(item.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
              {!presentList.length ? (
                <tr>
                  <td colSpan="3" className="empty-state">No students marked present yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card alert-panel">
        <div className="card__header">
          <div>
            <h2>Proxy Alerts</h2>
            <p>Flagged attendance entries for review.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>IP</th>
                <th>Flags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {proxyAlerts.map((item) => (
                <tr key={item.id} className={item.dismissed ? "proxy-row proxy-row--dismissed" : "proxy-row"}>
                  <td>{item.rollNo}</td>
                  <td>{item.studentName}</td>
                  <td>{item.ip}</td>
                  <td>{(item.flags || []).join(", ")}</td>
                  <td>
                    <button type="button" className="button button--secondary button--compact" onClick={() => dismissAlert(item.id)} disabled={item.dismissed}>
                      {item.dismissed ? "Dismissed" : "Dismiss"}
                    </button>
                  </td>
                </tr>
              ))}
              {!proxyAlerts.length ? (
                <tr>
                  <td colSpan="5" className="empty-state">No proxy alerts detected.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>{formatDisplayDate(date)}</h2>
            <p>Pre-filled with existing entries for this date.</p>
          </div>
          <button type="button" className="button button--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table table--controls">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr key={student.id}>
                  <td>{student.rollNo}</td>
                  <td>{student.name}</td>
                  <td>
                    <div className="status-toggle-group">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={attendanceMap[student.id] === status ? `status-toggle status-toggle--active status-toggle--${status}` : "status-toggle"}
                          onClick={() => updateStatus(student.id, status)}
                        >
                          {capitalize(status)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan="3" className="empty-state">
                    No students found.
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
