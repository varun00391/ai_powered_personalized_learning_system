import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PhaseKnowledgeSection from "../components/PhaseKnowledgeSection.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

function StudyGuideBody({ content }) {
  if (!content) return null;
  const chunks = content.split(/\n(?=## )/);
  return (
    <div className="space-y-6">
      {chunks.map((chunk, i) => {
        const trimmed = chunk.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          const rest = trimmed.slice(3);
          const nl = rest.indexOf("\n");
          const heading = nl === -1 ? rest : rest.slice(0, nl);
          const body = nl === -1 ? "" : rest.slice(nl + 1).trim();
          return (
            <section key={i}>
              <h2 className="font-display text-lg font-semibold text-indigo-200">{heading}</h2>
              {body && (
                <div className="mt-2 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{body}</div>
              )}
            </section>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default function PhaseStudyPage() {
  const { phaseIndex } = useParams();
  const idx = Number(phaseIndex);
  const nav = useNavigate();
  const { token, user, logout } = useAuth();
  const [path, setPath] = useState(null);
  const [phase, setPhase] = useState(null);
  const [guide, setGuide] = useState(null);
  const [guideSource, setGuideSource] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [guideErr, setGuideErr] = useState("");
  const [loadingPath, setLoadingPath] = useState(true);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [showMcq, setShowMcq] = useState(false);
  const mcqRef = useRef(null);

  const validIndex = useMemo(() => Number.isFinite(idx) && idx >= 1, [idx]);

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
    setLoadingGuide(true);
    setGuideErr("");
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/learning-paths/current/phase/${idx}/study-guide`, {
          method: "POST",
          token,
        });
        setGuide(res.content);
        setGuideSource(res.source);
      } catch (e) {
        setGuideErr(e.message || "Could not generate study guide.");
      } finally {
        setLoadingGuide(false);
      }
    })();
  }, [phase, token, idx, validIndex]);

  useEffect(() => {
    if (showMcq && mcqRef.current) {
      mcqRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showMcq]);

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 bg-ink-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-sm text-indigo-300 hover:text-indigo-200">
            ← Back to dashboard
          </Link>
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {path.career_title}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
              Phase {phase.phase_index}: {phase.title}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              ~{phase.estimated_hours}h · ~{phase.estimated_weeks} weeks ·{" "}
              {(phase.skills || []).length} skills
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(phase.skills || []).map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  {s}
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-3xl border border-white/10 bg-ink-900/50 p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-white">Study guide</h2>
                {guideSource && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {guideSource === "groq" ? "AI-generated" : "Structured guide"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Read this first. It is tailored to this phase and your goal (with Groq when{" "}
                <code className="text-indigo-400">GROQ_API_KEY</code> is set).
              </p>

              {loadingGuide && <p className="mt-6 text-slate-500">Generating your guide…</p>}
              {guideErr && (
                <p className="mt-6 text-sm text-red-300">{guideErr}</p>
              )}
              {!loadingGuide && !guideErr && guide && (
                <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-5">
                  <StudyGuideBody content={guide} />
                </div>
              )}

              {!showMcq && !loadingGuide && guide && (
                <button
                  type="button"
                  onClick={() => setShowMcq(true)}
                  className="mt-8 w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-400 md:w-auto md:px-10"
                >
                  I’ve finished reading — go to knowledge checks
                </button>
              )}
            </div>

            {showMcq && (
              <div ref={mcqRef} className="mt-10 scroll-mt-8 rounded-3xl border border-indigo-500/25 bg-indigo-500/5 p-6 md:p-8">
                <h2 className="font-display text-lg font-semibold text-white">Knowledge checks</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Short MCQs based on this phase’s topics. They are for self-check only (not graded or stored).
                </p>
                <PhaseKnowledgeSection phase={phase} variant="mcqs_only" />
                <Link
                  to="/dashboard"
                  className="mt-8 inline-block text-sm text-indigo-300 hover:text-indigo-200"
                >
                  ← Back to full dashboard
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
