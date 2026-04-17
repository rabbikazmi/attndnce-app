import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export default function Students() {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [createForm, setCreateForm] = useState({ name: "", rollNo: "", batch: "IT2" });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", rollNo: "", batch: "IT2" });

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/students", { method: "GET" }, token);
      setStudents(response.students || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, [token]);

  const sortedStudents = useMemo(
    () => [...students].sort((left, right) => String(left.rollNo || "").localeCompare(String(right.rollNo || ""))),
    [students]
  );

  function handleCreateChange(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        "/api/students",
        {
          method: "POST",
          body: {
            name: createForm.name,
            rollNo: createForm.rollNo,
            batch: "IT2"
          }
        },
        token
      );

      setStudents((current) => [...current, response.student]);
      setCreateForm({ name: "", rollNo: "", batch: "IT2" });
      setMessage("Student added successfully.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function startEdit(student) {
    setEditingId(student.id);
    setEditForm({
      name: student.name || "",
      rollNo: student.rollNo || "",
      batch: student.batch || "IT2"
    });
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm({ name: "", rollNo: "", batch: "IT2" });
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function saveEdit(studentId) {
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/api/students/${studentId}`,
        {
          method: "PUT",
          body: {
            name: editForm.name,
            rollNo: editForm.rollNo,
            batch: "IT2"
          }
        },
        token
      );

      setStudents((current) => current.map((student) => (student.id === studentId ? response.student : student)));
      setMessage("Student updated successfully.");
      cancelEdit();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function deleteStudent(student) {
    const confirmed = window.confirm(`Remove ${student.name} (${student.rollNo}) from the app?`);
    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/students/${student.id}`, { method: "DELETE" }, token);
      setStudents((current) => current.filter((entry) => entry.id !== student.id));
      setMessage("Student removed successfully.");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <h1>Students</h1>
          <p>Add, edit, or remove students directly from the app.</p>
        </div>
      </section>

      {message ? <div className="toast toast--success">{message}</div> : null}
      {error ? <div className="toast toast--error">{error}</div> : null}

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Add Student</h2>
          </div>
        </div>

        <form className="students-form-grid" onSubmit={handleCreate}>
          <label className="field">
            <span>Name</span>
            <input name="name" value={createForm.name} onChange={handleCreateChange} placeholder="Student name" required />
          </label>
          <label className="field">
            <span>Roll No</span>
            <input name="rollNo" value={createForm.rollNo} onChange={handleCreateChange} placeholder="IT2-001" required />
          </label>
          <label className="field">
            <span>Batch</span>
            <input name="batch" value="IT2" disabled readOnly />
          </label>
          <div className="field field--actions">
            <span>&nbsp;</span>
            <button type="submit" className="button button--primary">Add Student</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Manage Students</h2>
            <p>{sortedStudents.length} student(s) found.</p>
          </div>
          <button type="button" className="button button--secondary" onClick={loadStudents}>
            Refresh
          </button>
        </div>

        {loading ? <div className="page-state">Loading students...</div> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Batch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    {editingId === student.id ? (
                      <input className="inline-input" name="rollNo" value={editForm.rollNo} onChange={handleEditChange} />
                    ) : (
                      student.rollNo
                    )}
                  </td>
                  <td>
                    {editingId === student.id ? (
                      <input className="inline-input" name="name" value={editForm.name} onChange={handleEditChange} />
                    ) : (
                      student.name
                    )}
                  </td>
                  <td>IT2</td>
                  <td>
                    <div className="row-actions">
                      {editingId === student.id ? (
                        <>
                          <button type="button" className="button button--primary button--compact" onClick={() => saveEdit(student.id)}>
                            Save
                          </button>
                          <button type="button" className="button button--secondary button--compact" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="button button--secondary button--compact" onClick={() => startEdit(student)}>
                            Edit
                          </button>
                          <button type="button" className="button button--secondary button--compact" onClick={() => deleteStudent(student)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedStudents.length ? (
                <tr>
                  <td colSpan="4" className="empty-state">
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
