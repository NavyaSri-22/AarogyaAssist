
import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { apiFetch } from "./api";
import { UserRound, Lock, Save, ShieldCheck } from "lucide-react";
import "./ProfileSettings.css";

export default function ProfileSettings() {
  const { token, user, updateUser, logout } = useAuth();

  const [name, setName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const headers = {
    "Content-Type": "application/json"
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/profile", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim()
        })
      }, token);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not update profile.");
      }

      updateUser(data.user);
      setMessage("Your profile has been updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch(
        "/api/auth/change-password",
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
          })
        },
        token
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-settings-page">
      <div className="profile-settings-header">
        <div>
          <span>ACCOUNT MANAGEMENT</span>
          <h1>Profile Settings</h1>
          <p>Manage your personal account information and security.</p>
        </div>
        <div className="profile-avatar">
          {(user?.full_name || "U").charAt(0).toUpperCase()}
        </div>
      </div>

      {message && <div className="profile-success">{message}</div>}
      {error && <div className="profile-error">{error}</div>}

      <section className="profile-settings-card">
        <div className="profile-card-heading">
          <UserRound size={21} />
          <div>
            <h2>Personal information</h2>
            <p>Update the details associated with your account.</p>
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <label>Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
          />

          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button className="profile-save-button" disabled={loading}>
            <Save size={17} />
            Save Profile
          </button>
        </form>
      </section>

      <section className="profile-settings-card">
        <div className="profile-card-heading">
          <Lock size={21} />
          <div>
            <h2>Change password</h2>
            <p>Use a strong password that you do not reuse elsewhere.</p>
          </div>
        </div>

        <form onSubmit={changePassword}>
          <label>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />

          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button className="profile-save-button" disabled={loading}>
            <ShieldCheck size={17} />
            Update Password
          </button>
        </form>
      </section>

      <section className="profile-logout-card">
        <div>
          <h2>Sign out</h2>
          <p>Sign out of your Aarogya Assist account on this browser.</p>
        </div>
        <button onClick={logout} className="profile-logout-button">
          Sign Out
        </button>
      </section>
    </div>
  );
}
