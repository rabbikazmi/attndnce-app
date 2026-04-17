import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminRoute from "./components/AdminRoute";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import MarkAttendance from "./pages/MarkAttendance";
import Reports from "./pages/Reports";
import SelfMark from "./pages/SelfMark";
import Signup from "./pages/Signup";
import Students from "./pages/Students";

export default function App() {
  const location = useLocation();
  const { user } = useAuth();
  const showNavbar = Boolean(user) && !["/login", "/signup"].includes(location.pathname);

  return (
    <div className="app-shell">
      {showNavbar ? <Navbar /> : null}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/mark"
          element={
            <AdminRoute>
              <MarkAttendance />
            </AdminRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <AdminRoute>
              <Reports />
            </AdminRoute>
          }
        />
        <Route
          path="/students"
          element={
            <AdminRoute>
              <Students />
            </AdminRoute>
          }
        />
        <Route
          path="/my-attendance"
          element={
            <ProtectedRoute>
              <SelfMark />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
