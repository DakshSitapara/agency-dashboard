import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@agency.test");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-aside">
        <span className="eyebrow">AGENCY / 2026</span>
        <p className="login-aside-title">
          Clear work.
          <br />
          <em>Better momentum.</em>
        </p>
        <p className="login-aside-copy">
          A focused workspace for projects, people, and the details that keep
          delivery moving.
        </p>
        <span className="login-aside-footer">
          Internal operations workspace
        </span>
      </div>
      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-card-header">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span className="eyebrow">Welcome back</span>
        </div>
        <h1>Sign in to Agency</h1>
        <p className="muted">Pick up where your team left off.</p>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted small">
          Seeded accounts (password: Password123!): admin@agency.test,
          pm1@agency.test, pm2@agency.test, dev1@agency.test … dev4@agency.test
        </p>
      </form>
    </div>
  );
}
