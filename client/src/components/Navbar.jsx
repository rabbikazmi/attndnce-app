import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <div className="brand-mark">IT2</div>
        <div>
          <div className="navbar__title">IT2 Attendance</div>
          <div className="navbar__subtitle">Local tracker for IT2 students</div>
        </div>
      </div>

      <nav className="navbar__links">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Dashboard
            </NavLink>
            <NavLink to="/mark" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Mark Attendance
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Reports
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Students
            </NavLink>
          </>
        ) : (
          <NavLink to="/my-attendance" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            My Attendance
          </NavLink>
        )}
      </nav>

      <div className="navbar__actions">
        <span className="navbar__user">{user?.name}</span>
        <button type="button" className="button button--secondary button--compact" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
