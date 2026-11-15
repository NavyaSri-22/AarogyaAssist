
import React, { useState } from "react";
import { UserPlus, Mail, Lock, User, HeartPulse } from "lucide-react";
import { apiFetch } from "./api";
import "./Auth.css";

export default function Register({ onRegistered, onLoginClick }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      onRegistered(form.email.trim());
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo"><HeartPulse size={25} /></div>
          <span>Aarogya <strong>Assist</strong></span>
        </div>

        <div className="auth-heading">
          <div className="auth-icon"><UserPlus size={23} /></div>
          <h1>Create your account</h1>
          <p>Start your personal health information workspace.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Full name</label>
          <div className="auth-input-wrap">
            <User size={18} />
            <input
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Enter your full name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </div>

          <label>Email address</label>
          <div className="auth-input-wrap">
            <Mail size={18} />
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>

          <label>Password</label>
          <div className="auth-input-wrap">
            <Lock size={18} />
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>

          <label>Confirm password</label>
          <div className="auth-input-wrap">
            <Lock size={18} />
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              placeholder="Re-enter your password"
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" onClick={onLoginClick}>Sign in</button>
        </p>

        <p className="auth-privacy">
          Your account information is protected. Never share your password.
        </p>
      </div>
    </div>
  );
}
