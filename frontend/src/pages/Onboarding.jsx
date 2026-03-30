import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

const STEPS = ["goal", "skills", "time", "windows", "flex"];

export default function Onboarding() {
  const { token, user, loading: authLoading, refreshUser } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [careers, setCareers] = useState([]);
  const [loadingCareers, setLoadingCareers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const [careerGoalId, setCareerGoalId] = useState("");
  const [customGoalDescription, setCustomGoalDescription] = useState("");
  const [pythonLevel, setPythonLevel] = useState("beginner");
  const [sqlLevel, setSqlLevel] = useState("never");
  const learningStyle = "video";
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [windows, setWindows] = useState([]);
  const [flex, setFlex] = useState("somewhat_flexible");
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "" : ""
  );

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const data = await apiFetch("/api/v1/careers");
        setCareers(data);
        if (data[0] && !user?.onboarding_complete) {
          setCareerGoalId(data[0].id);
        }
      } catch {
        setErr("Could not load career options.");
      } finally {
        setLoadingCareers(false);
      }
    })();
  }, [authLoading, user?.onboarding_complete]);

  useEffect(() => {
    if (!user?.onboarding_complete || careers.length === 0) return;
    if (user.career_goal_id) setCareerGoalId(user.career_goal_id);
    if (user.custom_goal_text) setCustomGoalDescription(user.custom_goal_text);
    const snap = user.skill_snapshot;
    if (snap && typeof snap === "object") {
      if (snap.python_level) setPythonLevel(String(snap.python_level));
      if (snap.sql_level) setSqlLevel(String(snap.sql_level));
    }
    if (user.hours_per_week != null) setHoursPerWeek(user.hours_per_week);
    if (Array.isArray(user.preferred_study_windows)) {
      setWindows([...user.preferred_study_windows]);
    }
    if (user.schedule_flexibility) setFlex(user.schedule_flexibility);
    if (user.timezone) setTimezone(user.timezone);
  }, [user, careers.length]);

  function toggleWindow(w) {
    setWindows((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  async function finish() {
    setErr("");
    setSubmitting(true);
    try {
      await apiFetch("/api/v1/learner/onboarding", {
        method: "POST",
        token,
        body: {
          career_goal_id: careerGoalId,
          custom_goal_description:
            careerGoalId === "custom" ? customGoalDescription.trim() || null : null,
          python_level: pythonLevel,
          sql_level: sqlLevel,
          learning_style: learningStyle,
          hours_per_week: hoursPerWeek,
          preferred_study_windows: windows,
          schedule_flexibility: flex,
          timezone: timezone || null,
        },
      });
      await refreshUser();
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Could not save onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const isChangingPath = Boolean(user?.onboarding_complete);

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {isChangingPath ? (
            <Link
              to="/dashboard"
              className="text-sm text-indigo-300 hover:text-indigo-200"
            >
              ← Back to dashboard
            </Link>
          ) : (
            <span className="text-sm text-slate-600" aria-hidden="true" />
          )}
        </div>
        {isChangingPath && (
          <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
            You are choosing a <strong className="font-medium text-amber-50">new learning path</strong>. Submitting
            replaces your current path and phases — study progress in the app is not kept per path.
          </div>
        )}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-white">
            {isChangingPath ? "Change your learning path" : "Personalise your path"}
          </h1>
          <span className="text-xs text-slate-500">{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-10 glass rounded-3xl p-8">
          {err && (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">What do you want to achieve?</h2>
              <p className="text-sm text-slate-400">
                Pick a template or choose <strong className="text-slate-300">Something else</strong> and describe
                what you want in your own words.
              </p>
              {loadingCareers ? (
                <p className="text-slate-500">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {careers.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition ${
                        careerGoalId === c.id
                          ? "border-indigo-500/60 bg-indigo-500/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="career"
                          checked={careerGoalId === c.id}
                          onChange={() => setCareerGoalId(c.id)}
                          className="accent-indigo-500"
                        />
                        <div>
                          <p className="font-medium text-white">{c.title}</p>
                          <p className="text-xs text-slate-500">{c.domain}</p>
                        </div>
                      </div>
                      <p className="mt-2 pl-7 text-sm text-slate-400">{c.blurb}</p>
                    </label>
                  ))}
                  {careerGoalId === "custom" && (
                    <div className="pt-2">
                      <label className="text-xs font-medium text-slate-400">Your goal (be specific)</label>
                      <textarea
                        value={customGoalDescription}
                        onChange={(e) => setCustomGoalDescription(e.target.value)}
                        rows={5}
                        placeholder='e.g. "I want to pass the AWS Solutions Architect Associate and be able to design HA web apps on AWS"'
                        className="mt-2 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Minimum 8 characters. With <code className="text-indigo-300">GROQ_API_KEY</code> on the
                        server, we generate a tailored multi-phase path from this text.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-lg font-semibold text-white">Your starting point</h2>
              <div>
                <p className="text-sm text-slate-400">Python comfort</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["beginner", "Beginner"],
                    ["some", "Some experience"],
                    ["comfortable", "Comfortable"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPythonLevel(v)}
                      className={`rounded-full px-4 py-2 text-sm ${
                        pythonLevel === v
                          ? "bg-indigo-500 text-white"
                          : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400">SQL</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["never", "Never"],
                    ["basics", "Basics"],
                    ["proficient", "Proficient"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSqlLevel(v)}
                      className={`rounded-full px-4 py-2 text-sm ${
                        sqlLevel === v
                          ? "bg-indigo-500 text-white"
                          : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">Weekly time budget</h2>
              <p className="text-sm text-slate-400">
                We use this to estimate how many calendar weeks your path may take.
              </p>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <p className="text-center font-display text-3xl font-bold text-white">{hoursPerWeek}h</p>
              <p className="text-center text-xs text-slate-500">per week</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">Preferred study windows</h2>
              <p className="text-sm text-slate-400">Select all that usually work — we’ll respect this in nudges later.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ["morning", "Morning"],
                  ["afternoon", "Afternoon"],
                  ["evening", "Evening"],
                  ["night", "Night"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleWindow(v)}
                    className={`rounded-full px-4 py-2 text-sm ${
                      windows.includes(v)
                        ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40"
                        : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500">Timezone (optional)</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. Asia/Kolkata"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">Schedule flexibility</h2>
              <p className="text-sm text-slate-400">
                Rigid schedules need a little more calendar slack in the estimate; flexible learners can move
                slightly faster on paper.
              </p>
              <div className="space-y-2">
                {[
                  ["rigid", "Mostly fixed — I need predictable slots"],
                  ["somewhat_flexible", "Somew flexible — occasional changes"],
                  ["very_flexible", "Very flexible — I can move things around"],
                ].map(([v, label]) => (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
                      flex === v ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="flex"
                      checked={flex === v}
                      onChange={() => setFlex(v)}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-slate-200">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex justify-between gap-4">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || submitting}
              className="rounded-xl px-5 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              disabled={
                submitting ||
                loadingCareers ||
                !careerGoalId ||
                (careerGoalId === "custom" && customGoalDescription.trim().length < 8)
              }
              className="rounded-xl bg-indigo-500 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {step === STEPS.length - 1
                ? submitting
                  ? "Saving…"
                  : isChangingPath
                    ? "Replace path with this plan"
                    : "Build my path"
                : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
