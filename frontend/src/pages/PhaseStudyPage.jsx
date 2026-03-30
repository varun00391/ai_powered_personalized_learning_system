import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

/** Split markdown on top-level ## headings into paginated lessons. */
function splitGuideIntoPages(content) {
  if (!content || !String(content).trim()) return [];
  const raw = String(content)
    .trim()
    .split(/\n(?=## )/)
    .map((c) => c.trim())
    .filter(Boolean);
  return raw.map((chunk) => {
    if (chunk.startsWith("## ")) {
      const rest = chunk.slice(3);
      const nl = rest.indexOf("\n");
      const title = nl === -1 ? rest.trim() : rest.slice(0, nl).trim();
      const body = nl === -1 ? "" : rest.slice(nl + 1).trim();
      return { title, body };
    }
    return { title: "Introduction", body: chunk };
  });
}

function LessonBody({ body }) {
  if (!body) return null;
  const segments = body.split(/\n(?=### )/).map((s) => s.trim()).filter(Boolean);
  return (
    <div className="space-y-5">
      {segments.map((seg, i) => {
        if (seg.startsWith("### ")) {
          const nl = seg.indexOf("\n");
          const head = nl === -1 ? seg.slice(4).trim() : seg.slice(4, nl).trim();
          const rest = nl === -1 ? "" : seg.slice(nl + 1).trim();
          return (
            <div key={i}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">{head}</h3>
              {rest ? (
                <div className="mt-2 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{rest}</div>
              ) : null}
            </div>
          );
        }
        return (
          <div key={i} className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
            {seg}
          </div>
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
  const [guidePageIndex, setGuidePageIndex] = useState(0);
  const lessonTopRef = useRef(null);

  const validIndex = useMemo(() => Number.isFinite(idx) && idx >= 1, [idx]);

  const guidePages = useMemo(() => splitGuideIntoPages(guide), [guide]);
  const guidePageCount = guidePages.length;
  const clampedGuidePage =
    guidePageCount > 0
      ? Math.min(Math.max(guidePageIndex, 0), guidePageCount - 1)
      : 0;
  const currentLesson = guidePages[clampedGuidePage] || null;
  const isLastGuidePage = guidePageCount > 0 && clampedGuidePage === guidePageCount - 1;

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
    setGuidePageIndex(0);
  }, [guide]);

  useEffect(() => {
    if (lessonTopRef.current && guide && !loadingGuide) {
      lessonTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [clampedGuidePage, guide, loadingGuide]);

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 bg-ink-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/dashboard" className="text-sm text-indigo-300 hover:text-indigo-200">
              ← Back to dashboard
            </Link>
            <Link
              to="/onboarding"
              className="text-sm text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-indigo-200"
            >
              Change learning path
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
                Work through each lesson below in order. When you are done, open the{" "}
                <strong className="text-slate-400">knowledge check</strong> on a separate page — questions are saved on
                the server when this guide is generated. With Groq (<code className="text-indigo-400">GROQ_API_KEY</code>
                ), content is a full tutorial per topic.
              </p>

              {loadingGuide && <p className="mt-6 text-slate-500">Generating your study material…</p>}
              {guideErr && (
                <p className="mt-6 text-sm text-red-300">{guideErr}</p>
              )}
              {!loadingGuide && !guideErr && guide && currentLesson && (
                <div ref={lessonTopRef} className="mt-6 scroll-mt-24 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-slate-400">
                      Lesson{" "}
                      <span className="text-indigo-300">
                        {clampedGuidePage + 1} of {guidePageCount}
                      </span>
                    </p>
                    <div
                      className="h-1.5 flex-1 max-w-full overflow-hidden rounded-full bg-white/10 sm:max-w-xs"
                      role="progressbar"
                      aria-valuenow={clampedGuidePage + 1}
                      aria-valuemin={1}
                      aria-valuemax={guidePageCount}
                    >
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                        style={{
                          width: `${((clampedGuidePage + 1) / guidePageCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-black/20 p-5 md:p-6">
                    <h3 className="font-display text-lg font-semibold text-indigo-200 md:text-xl">
                      {currentLesson.title}
                    </h3>
                    <div className="mt-4">
                      <LessonBody body={currentLesson.body} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={clampedGuidePage <= 0}
                      onClick={() =>
                        setGuidePageIndex((p) => {
                          const c = Math.min(Math.max(p, 0), guidePageCount - 1);
                          return Math.max(0, c - 1);
                        })
                      }
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Previous lesson
                    </button>
                    {!isLastGuidePage && (
                      <button
                        type="button"
                        onClick={() =>
                          setGuidePageIndex((p) => {
                            const c = Math.min(Math.max(p, 0), guidePageCount - 1);
                            return Math.min(guidePageCount - 1, c + 1);
                          })
                        }
                        className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        Next lesson →
                      </button>
                    )}
                  </div>

                  {!isLastGuidePage && (
                    <p className="text-xs text-slate-500">
                      Finish all lessons, then take the knowledge check on the next page. You are on lesson{" "}
                      {clampedGuidePage + 1} of {guidePageCount}.
                    </p>
                  )}
                </div>
              )}

              {!loadingGuide && guide && isLastGuidePage && (
                <button
                  type="button"
                  onClick={() => nav(`/dashboard/phase/${idx}/quiz`)}
                  className="mt-8 w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-400 md:w-auto md:px-10"
                >
                  Continue to knowledge check (separate page)
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
