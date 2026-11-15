
import React, { createContext, useContext, useState } from "react";

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
      value={{ token, user, login, updateUser, logout }}
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
