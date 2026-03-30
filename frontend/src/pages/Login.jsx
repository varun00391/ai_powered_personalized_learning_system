import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink-950">
      <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl">
        <Link to="/" className="font-display text-lg font-semibold text-white">
          ← LearnOS AI
        </Link>
        <h1 className="mt-6 font-display text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to continue your path.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {err && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white hover:bg-indigo-400"
          >
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          No account?{" "}
          <Link to="/register" className="text-indigo-300 hover:text-indigo-200">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
