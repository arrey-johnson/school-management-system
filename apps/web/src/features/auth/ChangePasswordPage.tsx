import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { apiSend } from "../../lib/api";

export function ChangePasswordPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-white p-8 shadow-card">
      <h1 className="text-xl font-semibold text-deep">Change your password</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          void apiSend("/api/v1/auth/change-password", "POST", { currentPassword, newPassword })
            .then(() => refresh())
            .then(() => navigate("/"))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <input
          className="w-full rounded-lg border border-line px-3 py-2"
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-line px-3 py-2"
          type="password"
          placeholder="New password (min 10 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={10}
          required
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="w-full rounded-lg bg-purple py-2.5 text-white" type="submit">
          Save password
        </button>
      </form>
    </div>
  );
}
