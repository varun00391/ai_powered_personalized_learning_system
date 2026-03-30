import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

function QuizQuestion({
  check,
  qIndex,
  selected,
  onSelect,
  locked,
  detail,
}) {
  const correct = check.correct_index;
  const choices = check.choices || [];
  const showOutcome = locked && detail;

  return (
    <div className="rounded-xl border border-white/10 bg-ink-950/80 p-4">
      <p className="text-sm font-medium text-white">
        <span className="text-indigo-400">Q{qIndex + 1}.</span> {check.question}
      </p>
      <ul className="mt-3 space-y-2">
        {choices.map((c, i) => {
          const isSel = selected === i;
          const isCorrect = i === correct;
          let ring = "border-white/10 hover:border-white/25 hover:bg-white/[0.04]";
          if (showOutcome) {
            if (isCorrect) ring = "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30";
            else if (isSel && !isCorrect) ring = "border-red-500/50 bg-red-500/10 ring-1 ring-red-500/30";
            else ring = "border-white/10 opacity-60";
          } else if (isSel) {
            ring =
              "border-indigo-400/80 bg-indigo-500/20 ring-2 ring-indigo-400/60 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]";
          }
          return (
            <li key={i}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onSelect(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-200 transition ${ring} disabled:cursor-default`}
              >
                <span className={isSel && !showOutcome ? "font-medium text-indigo-300" : "text-slate-500"}>
                  {String.fromCharCode(65 + i)}.
                </span>{" "}
                {c}
              </button>
            </li>
          );
        })}
      </ul>
      {showOutcome && (
        <p className="mt-3 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Why: </span>
          {check.explanation}
        </p>
      )}
    </div>
  );
}

export default function PhaseQuizPage() {
  const { phaseIndex } = useParams();
  const idx = Number(phaseIndex);
  const nav = useNavigate();
  const { token, user, logout } = useAuth();
  const [path, setPath] = useState(null);
  const [phase, setPhase] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [bundleErr, setBundleErr] = useState("");
  const [loadingPath, setLoadingPath] = useState(true);
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [picks, setPicks] = useState([]);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  const validIndex = useMemo(() => Number.isFinite(idx) && idx >= 1, [idx]);

  const checks = bundle?.knowledge_checks || [];
  const n = checks.length;

  const loadBundle = useCallback(async () => {
    if (!validIndex || !token) return;
    setLoadingBundle(true);
    setBundleErr("");
    try {
      const b = await apiFetch(`/api/v1/learning-paths/current/phase/${idx}/knowledge-checks`, { token });
      setBundle(b);
      setPicks(Array((b.knowledge_checks || []).length).fill(null));
      setSubmitLocked(false);
      setSubmitResult(null);
    } catch (e) {
      const msg = e.message || "";
      setBundle(null);
      if (msg.includes("study guide") || msg.includes("404")) {
        setBundleErr("no_snapshot");
      } else {
        setBundleErr(msg || "Could not load quiz.");
      }
    } finally {
      setLoadingBundle(false);
    }
  }, [validIndex, token, idx]);

  useEffect(() => {
    if (!validIndex) {
      setLoadingPath(false);
      setLoadErr("Invalid phase number.");
      return;
    }
    (async () => {
      try {
        const p = await apiFetch("/api/v1/learning-paths/current", { token });
        setPath(p);
        const ph = (p.phases || []).find((x) => x.phase_index === idx);
        if (!ph) {
          setLoadErr("Phase not found on your current path.");
          setPhase(null);
        } else {
          setPhase(ph);
        }
      } catch (e) {
        setLoadErr(e.message || "Could not load path.");
      } finally {
        setLoadingPath(false);
      }
    })();
  }, [token, idx, validIndex]);

  useEffect(() => {
    if (!phase || !validIndex) return;
    loadBundle();
  }, [phase, validIndex, loadBundle]);

  async function onSubmit() {
    if (!n || picks.some((p) => p === null)) {
      setSubmitErr("Answer every question before submitting.");
      return;
    }
    setSubmitErr("");
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/learning-paths/current/phase/${idx}/knowledge-checks/submit`, {
        method: "POST",
        token,
        body: { answers: picks },
      });
      setSubmitResult(res.result);
      setBundle(res.bundle);
      setSubmitLocked(true);
    } catch (e) {
      setSubmitErr(e.message || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function onRetry() {
    setPicks(Array(n).fill(null));
    setSubmitLocked(false);
    setSubmitResult(null);
    setSubmitErr("");
  }

  const detailsByQ = useMemo(() => {
    const d = submitResult?.details || [];
    const map = {};
    d.forEach((x) => {
      map[x.question_index] = x;
    });
    return map;
  }, [submitResult]);

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 bg-ink-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/dashboard" className="text-sm text-indigo-300 hover:text-indigo-200">
              ← Dashboard
            </Link>
            <Link
              to={`/dashboard/phase/${idx}`}
              className="text-sm text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-indigo-200"
            >
              Study guide
            </Link>
            <Link
              to="/onboarding"
              className="text-sm text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-indigo-200"
            >
              Change path
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/15 px-3 py-1 text-slate-300 hover:bg-white/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {loadingPath && <p className="text-slate-500">Loading…</p>}
        {loadErr && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {loadErr}{" "}
            <button type="button" onClick={() => nav("/dashboard")} className="text-indigo-300 underline">
              Return to dashboard
            </button>
          </div>
        )}

        {!loadErr && phase && path && (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{path.career_title}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
              Knowledge check — Phase {phase.phase_index}: {phase.title}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Separate from the study guide. Complete all lessons there first; scores are saved so you can compare
              attempts and retry anytime.
            </p>

            {loadingBundle && <p className="mt-8 text-slate-500">Loading questions…</p>}

            {bundleErr === "no_snapshot" && (
              <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100/95">
                <p className="font-medium text-amber-50">Study guide required</p>
                <p className="mt-2 text-amber-100/80">
                  Open the study guide for this phase and finish generating it. That saves the questions for this quiz.
                </p>
                <Link
                  to={`/dashboard/phase/${idx}`}
                  className="mt-4 inline-block rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-400/40 hover:bg-amber-500/30"
                >
                  Go to study guide
                </Link>
              </div>
            )}

            {bundleErr && bundleErr !== "no_snapshot" && (
              <p className="mt-8 text-sm text-red-300">{bundleErr}</p>
            )}

            {!loadingBundle && !bundleErr && bundle && (
              <div className="mt-8 space-y-8">
                {bundle.last_result && !submitResult && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-400">
                      Last saved attempt
                    </h2>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {bundle.last_result.score_percent}%{" "}
                      <span className="text-base font-normal text-slate-400">
                        ({bundle.last_result.correct} correct · {bundle.last_result.incorrect} incorrect ·{" "}
                        {bundle.last_result.total} total)
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Recorded {bundle.last_result.completed_at?.replace("T", " ").replace("Z", " UTC")}
                    </p>
                  </div>
                )}

                {bundle.attempts_history?.length > 0 && (
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
                    <h2 className="font-display text-sm font-semibold text-slate-300">Attempt history</h2>
                    <p className="mt-1 text-xs text-slate-500">Newest first (up to 50 stored per phase).</p>
                    <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm">
                      {[...bundle.attempts_history].reverse().map((a, i) => (
                        <li
                          key={`${a.completed_at}-${i}`}
                          className="flex justify-between gap-4 border-b border-white/5 pb-2 text-slate-300"
                        >
                          <span>
                            {a.score_percent}% — {a.correct}/{a.total} correct
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {a.completed_at?.replace("T", " ").slice(0, 19)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bundle.mcq_aligned_to_guide && (
                  <p className="text-xs text-slate-500">
                    Questions match your latest AI study guide. Regenerating the study guide replaces questions and
                    clears saved scores for this phase.
                  </p>
                )}

                {n === 0 && (
                  <p className="text-slate-400">No multiple-choice items for this phase yet.</p>
                )}

                {n > 0 && (
                  <>
                    {submitResult && (
                      <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-6">
                        <h2 className="font-display text-lg font-semibold text-white">This attempt</h2>
                        <p className="mt-2 text-3xl font-bold text-indigo-200">{submitResult.score_percent}%</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {submitResult.correct} correct · {submitResult.incorrect} incorrect · {submitResult.total}{" "}
                          questions
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Saved — you can retry below to improve.</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {checks.map((c, i) => (
                        <QuizQuestion
                          key={i}
                          check={c}
                          qIndex={i}
                          selected={picks[i]}
                          onSelect={(v) => {
                            if (submitLocked) return;
                            setPicks((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          locked={submitLocked}
                          detail={detailsByQ[i]}
                        />
                      ))}
                    </div>

                    {submitErr && (
                      <p className="text-sm text-red-300">{submitErr}</p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {!submitLocked ? (
                        <button
                          type="button"
                          disabled={submitting || picks.some((p) => p === null)}
                          onClick={onSubmit}
                          className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
                        >
                          {submitting ? "Submitting…" : "Submit answers"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Retry quiz
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
