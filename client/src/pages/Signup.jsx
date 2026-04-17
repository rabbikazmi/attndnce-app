import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

const batchOptions = ["IT2"];

export default function Signup() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    rollNo: "",
    batch: "IT2",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === "admin" ? "/" : "/my-attendance", { replace: true });
    }
  }, [navigate, user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "batch" && value !== "IT2") {
      setWarning("This app is only for IT2 students.");
    } else if (name === "batch") {
      setWarning("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setWarning("");

    if (form.batch !== "IT2") {
      setWarning("This app is only for IT2 students.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest("/api/auth/signup", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          rollNo: form.rollNo,
          batch: form.batch
        }
      });

      login(response.token, response.user);
      navigate(response.user.role === "admin" ? "/" : "/my-attendance", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark brand-mark--large">IT2</div>
          <h1>IT2 Attendance</h1>
          <p>IT2 students only</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Full name</span>
            <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your full name" required />
          </label>

          <label className="field">
            <span>Roll number</span>
            <input type="text" name="rollNo" value={form.rollNo} onChange={handleChange} placeholder="IT2-001" required />
          </label>

          <label className="field">
            <span>Batch</span>
            <select name="batch" value={form.batch} onChange={handleChange} required>
              {batchOptions.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="student@example.com" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="At least 6 characters" minLength={6} required />
          </label>

          <label className="field">
            <span>Confirm password</span>
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" required />
          </label>

          {warning ? <div className="form-warning">{warning}</div> : null}
          {error ? <div className="form-error">{error}</div> : null}

          <button type="submit" className="button button--primary" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="form-footnote">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
