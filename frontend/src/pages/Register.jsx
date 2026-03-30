import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await register(email, password, fullName);
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Registration failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink-950">
      <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl">
        <Link to="/" className="font-display text-lg font-semibold text-white">
          ← LearnOS AI
        </Link>
        <h1 className="mt-6 font-display text-2xl font-bold text-white">Create account</h1>
        <p className="mt-2 text-sm text-slate-400">Then we’ll personalise your learning path.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {err && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
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
            <label className="block text-xs font-medium text-slate-400">Password (min 8)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white hover:bg-indigo-400"
          >
            Continue to onboarding
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
