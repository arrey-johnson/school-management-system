import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuditPage } from "../features/audit/AuditPage";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { LoginPage } from "../features/auth/LoginPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SetupPage } from "../features/setup/SetupPage";
import { UsersPage } from "../features/users/UsersPage";
import { AppShell } from "./AppShell";
import { AuthProvider, useAuth } from "./AuthProvider";

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/"
        element={
          <Private>
            <AppShell />
          </Private>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
