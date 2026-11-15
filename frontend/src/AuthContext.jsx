
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("aarogya_token")
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("aarogya_user") || "null");
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(
    () => Boolean(localStorage.getItem("aarogya_token"))
  );

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let cancelled = false;

    apiFetch("/api/auth/me", {}, token)
      .then(async (response) => {
        if (response.status === 401) {
          localStorage.removeItem("aarogya_token");
          localStorage.removeItem("aarogya_user");
          if (!cancelled) {
            setToken(null);
            setUser(null);
          }
          return;
        }

        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled && data.user) {
          localStorage.setItem("aarogya_user", JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = (accessToken, userData) => {
    localStorage.setItem("aarogya_token", accessToken);
    localStorage.setItem("aarogya_user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const updateUser = (userData) => {
    localStorage.setItem("aarogya_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("aarogya_token");
    localStorage.removeItem("aarogya_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, authLoading, login, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
