import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const pillars = [
  {
    title: "Adaptive paths",
    body: "Knowledge-graph style roadmaps that respect prerequisites, your pace, and weekly capacity.",
  },
  {
    title: "Behaviour-aware sequencing",
    body: "Cold-start quiz plus ongoing signals to tune difficulty, format, and review timing.",
  },
  {
    title: "AI tutor ready",
    body: "Contextual coaching aligned to your goal; plug in an API key for full LLM responses.",
  },
];

export default function Landing() {
  const { token, user } = useAuth();
  const ctaTo = token ? (user?.onboarding_complete ? "/dashboard" : "/onboarding") : "/register";

  return (
    <div className="relative overflow-hidden min-h-screen bg-ink-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[size:48px_48px] bg-grid-slate opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight text-white">
          LearnOS<span className="text-indigo-400"> AI</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#product" className="text-slate-400 hover:text-white transition">
            Product
          </a>
          {token ? (
            <Link
              to={ctaTo}
              className="rounded-full bg-white/10 px-4 py-2 font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              Continue
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-slate-300 hover:text-white">
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-indigo-500 px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-400"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Personalised learning OS
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
              Learn on <span className="gradient-text">your</span> timeline — with an AI that
              respects it.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-400">
              Short onboarding captures your goal, experience, preferred study windows, and weekly
              hours. We generate phased paths and a realistic course duration — the same flow your
              PRD describes, ready to extend with graph DBs, streaming analytics, and tutor agents.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to={ctaTo}
                className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 hover:bg-indigo-400"
              >
                Start personalising
              </Link>
              <a
                href="#product"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3 text-base font-medium text-white hover:bg-white/10"
              >
                Explore features
              </a>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-10 text-sm">
              <div>
                <dt className="text-slate-500">Path phases</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">6</dd>
              </div>
              <div>
                <dt className="text-slate-500">Time model</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">h/week</dd>
              </div>
              <div>
                <dt className="text-slate-500">Flex modes</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">3</dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <div className="glass relative overflow-hidden rounded-3xl p-8 shadow-2xl ring-1 ring-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-transparent to-cyan-500/10" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Live preview
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                    Adaptive
                  </span>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-900/80 p-5">
                  <p className="text-sm text-slate-400">Your roadmap</p>
                  <p className="font-display text-lg font-semibold text-white">Data Engineer track</p>
                  <div className="flex gap-2">
                    {["Foundation", "Core tools", "Cloud", "Capstone"].map((t, i) => (
                      <div
                        key={t}
                        className={`flex-1 rounded-lg py-3 text-center text-xs font-medium ${
                          i === 0
                            ? "bg-indigo-500/30 text-indigo-100 ring-1 ring-indigo-400/40"
                            : "bg-white/5 text-slate-500"
                        }`}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[18%] rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
                  </div>
                  <p className="text-xs text-slate-500">
                    Est. completion updates from your weekly hours & flexibility setting.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-slate-500">Next best</p>
                    <p className="mt-1 font-medium text-white">Python modules</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-slate-500">Tutor</p>
                    <p className="mt-1 font-medium text-white">Context-aware</p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="absolute -right-6 -top-6 hidden h-24 w-24 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/40 to-transparent md:block animate-float"
              aria-hidden
            />
          </div>
        </div>

        <section id="product" className="mt-28 scroll-mt-24">
          <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
            Built for serious learners, not one-size courses
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            This starter implements the onboarding → path → dashboard loop from your architecture
            docs. Swap the in-memory graph for Neo4j, add Kafka/Flink later — the API surface stays
            familiar.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <article
                key={p.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-indigo-500/30 transition"
              >
                <h3 className="font-display text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-10 text-center text-sm text-slate-500">
        LearnOS AI — reference implementation · FastAPI · React · Tailwind · Docker
      </footer>
    </div>
  );
}
