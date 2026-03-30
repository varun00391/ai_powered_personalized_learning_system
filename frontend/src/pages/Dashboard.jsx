import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

const WELCOME_ASSISTANT =
  "Hi — I'm **LearnGuide**. Open a phase to start the **study guide**; the **knowledge check** (with saved scores) comes right after you finish the lessons. " +
  "Ask me anything about your plan here.";

export default function Dashboard() {
  const nav = useNavigate();
  const { token, user, logout } = useAuth();
  const [path, setPath] = useState(null);
  const [recs, setRecs] = useState([]);
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME_ASSISTANT }]);
  const [input, setInput] = useState("");
  const [activityOpen, setActivityOpen] = useState(null);
  const [loadingPath, setLoadingPath] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([
          apiFetch("/api/v1/learning-paths/current", { token }),
          apiFetch("/api/v1/recommendations", { token }),
        ]);
        setPath(p);
        setRecs(r);
      } catch {
        setPath(null);
      } finally {
        setLoadingPath(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatLoading]);

  async function sendChat(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || chatLoading) return;

    const userTurn = { role: "user", content: text };
    const historyForApi = [...messages, userTurn].map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, userTurn]);
    setInput("");
    setChatLoading(true);

    try {
      const res = await apiFetch("/api/v1/tutor/chat", {
        method: "POST",
        token,
        body: {
          messages: historyForApi,
          phase_context: null,
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (ex) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Something went wrong: ${ex.message || "request failed"}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function clearChat() {
    setMessages([{ role: "assistant", content: WELCOME_ASSISTANT }]);
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 bg-ink-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-lg font-semibold text-white">
            LearnOS<span className="text-indigo-400"> AI</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
            <Link
              to="/onboarding"
              className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1.5 text-indigo-200 hover:border-indigo-400/60 hover:bg-indigo-500/15"
            >
              Change learning path
            </Link>
            <span className="hidden text-slate-400 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/15 px-4 py-1.5 text-slate-300 hover:bg-white/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-white">Your dashboard</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Want a different goal or track? Use <strong className="font-medium text-slate-300">Change learning path</strong>{" "}
          in the header to run onboarding again — your new plan replaces the current one.
        </p>
        <p className="mt-3 max-w-3xl text-slate-400">
          <strong className="font-medium text-slate-300">Click a phase</strong> to start its study guide. When you
          finish all lessons, you&apos;ll move on to the knowledge check and see your score (attempts are saved).
          Streaming video is still a placeholder — see recommendations. Tutor:{" "}
          <code className="text-indigo-300">GROQ_API_KEY</code>.
        </p>

        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-stretch">
          {/* Left column: path + phases + recs */}
          <div className="min-w-0 flex-1 space-y-6">
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-semibold text-white">Learning path</h2>
              {loadingPath ? (
                <p className="mt-4 text-slate-500">Loading path…</p>
              ) : !path ? (
                <p className="mt-4 text-slate-500">No path found. Complete onboarding.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Goal</p>
                      <p className="font-display text-xl font-semibold text-white">{path.career_title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Est. course duration</p>
                      <p className="font-display text-2xl font-bold text-indigo-300">
                        ~{path.estimated_weeks_course} weeks
                      </p>
                      <p className="text-xs text-slate-500">{path.total_estimated_hours} total hours</p>
                    </div>
                  </div>
                  {path.personalization_notes && (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                      {path.personalization_notes}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    <span className="text-indigo-300">Tip:</span> click a phase to open the study guide. After you
                    finish all lessons, you&apos;ll continue to the knowledge check for a scored quiz.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {path.phases.map((ph) => (
                      <button
                        key={ph.phase_index}
                        type="button"
                        onClick={() => nav(`/dashboard/phase/${ph.phase_index}`)}
                        className={`rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-indigo-500/20 ${
                          ph.unlocked
                            ? "border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-400/50"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium text-white">
                            Phase {ph.phase_index} — {ph.title}
                          </h3>
                          {ph.unlocked && (
                            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                        <ul className="mt-2 max-h-24 list-inside list-disc overflow-y-auto text-left text-sm text-slate-400">
                          {ph.skills.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs font-medium text-indigo-300/90">Open study guide →</p>
                        <p className="mt-1 text-xs text-slate-500">
                          ~{ph.estimated_hours}h · ~{ph.estimated_weeks} wk
                          {ph.knowledge_checks?.length > 0 && (
                            <span className="ml-2 text-slate-500">· {ph.knowledge_checks.length} template checks</span>
                          )}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-semibold text-white">Recommended next</h2>
              <p className="mt-1 text-xs text-slate-500">
                Tap an item to see how video / quiz / lab would appear once content is connected.
              </p>
              <ul className="mt-4 space-y-3">
                {recs.map((r) => (
                  <li key={r.content_id}>
                    <button
                      type="button"
                      onClick={() => setActivityOpen(r)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-indigo-500/40 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white">{r.title}</p>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                          {r.format}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{r.match_reason}</p>
                      <p className="mt-2 text-xs text-indigo-300/90">Open · ~{r.duration_minutes} min</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Chat column */}
          <section className="flex w-full shrink-0 flex-col rounded-3xl border border-white/10 bg-ink-900/40 lg:w-[420px] xl:w-[440px] lg:min-h-[620px] lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">AI tutor</h2>
                <p className="text-xs text-slate-500">General coaching</p>
              </div>
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Clear chat
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
              style={{ minHeight: "320px", maxHeight: "min(56vh, 520px)" }}
            >
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "border border-white/10 bg-white/5 text-slate-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={sendChat} className="border-t border-white/10 p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                rows={3}
                placeholder="Message LearnGuide… (Shift+Enter for newline)"
                className="w-full resize-none rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={chatLoading || !input.trim()}
                  className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-600">
                Set <code className="text-indigo-400/90">GROQ_API_KEY</code> for full model replies.
              </p>
            </form>
          </section>
        </div>
      </main>

      {activityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl">
            <h2 id="activity-title" className="font-display text-xl font-semibold text-white">
              {activityOpen.title}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{activityOpen.format} activity</p>
            <p className="mt-4 text-sm text-slate-300">{activityOpen.match_reason}</p>

            <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              <p>
                <strong className="text-slate-200">Current build:</strong> each phase has its own page with a study guide
                and MCQs. This card is still a placeholder for a{" "}
                <strong className="text-slate-300">hosted lesson</strong> (video stream + tracked quiz submission).
              </p>
              <p>
                <strong className="text-slate-200">Next integration steps:</strong> attach a content service (URLs for
                HLS video), an assessments API for questions, and sandboxes or external lab links — as in your LearnOS
                architecture (Content service, Quiz engine, video pipeline).
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4 text-center text-sm text-slate-500">
              {activityOpen.format === "video" && (
                <p>Video player placeholder — adaptive stream would load here.</p>
              )}
              {activityOpen.format === "quiz" && (
                <p>Quiz placeholder — MCQs and scoring would load here.</p>
              )}
              {!["video", "quiz"].includes(activityOpen.format) && (
                <p>Mixed module placeholder — video + exercise tabs would load here.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActivityOpen(null)}
              className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
