
import React, { useState } from "react";
import { LogIn, Mail, Lock, HeartPulse } from "lucide-react";
import { useAuth } from "./AuthContext";
import "./Auth.css";

const API_URL = "http://localhost:8000";

export default function Login({ onRegisterClick }) {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }

      login(data.access_token, data.user);
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
          <div className="auth-icon"><LogIn size={23} /></div>
          <h1>Welcome back</h1>
          <p>Sign in to access your personal health workspace.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Email address</label>
          <div className="auth-input-wrap">
            <Mail size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <button type="button" onClick={onRegisterClick}>
            Create account
          </button>
        </p>

        <p className="auth-privacy">
          Your health workspace is intended for your personal use.
        </p>
      </div>
    </div>
  );
}
