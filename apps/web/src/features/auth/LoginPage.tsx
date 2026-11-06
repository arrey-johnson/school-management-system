import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend, type MeUser } from "../../lib/api";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-pale p-6">
      <form
        className="w-full max-w-md rounded-card border border-line bg-white p-8 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          void (async () => {
            try {
              const status = await apiGet<{ hasUsers: boolean }>("/api/v1/setup/status");
              if (!status.hasUsers) {
                navigate("/setup");
                return;
              }
              const result = await apiSend<{ user: MeUser; mustChangePassword: boolean }>(
                "/api/v1/auth/login",
                "POST",
                { username, password },
              );
              setUser(result.user);
              navigate(result.mustChangePassword ? "/change-password" : "/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign in failed");
            }
          })();
        }}
      >
        <p className="text-sm font-medium text-purple">Promptstack Technologies</p>
        <h1 className="mt-2 text-2xl font-semibold text-deep">{t("appName")}</h1>
        <label className="mt-6 block text-sm font-medium" htmlFor="username">
          {t("auth.username")}
        </label>
        <input
          id="username"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          {t("auth.password")}
        </label>
        <input
          id="password"
          type="password"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button
          className="mt-6 w-full rounded-lg bg-purple px-4 py-2.5 font-medium text-white hover:bg-mid"
          type="submit"
        >
          {t("auth.signIn")}
        </button>
        <p className="mt-4 text-center text-sm text-muted">
          New school?{" "}
          <Link className="text-purple underline" to="/setup">
            First-run setup
          </Link>
        </p>
      </form>
    </div>
  );
}
