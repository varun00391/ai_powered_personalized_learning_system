import { useState } from "react";

function CheckCard({ check, qIndex }) {
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const correct = check.correct_index;
  const choices = check.choices || [];

  return (
    <div className="rounded-xl border border-white/10 bg-ink-950/80 p-4">
      <p className="text-sm font-medium text-white">
        <span className="text-indigo-400">Q{qIndex + 1}.</span> {check.question}
      </p>
      <ul className="mt-3 space-y-2">
        {choices.map((c, i) => {
          const isSel = picked === i;
          const isCorrect = i === correct;
          let ring = "border-white/10 hover:border-white/20";
          if (revealed && isSel && isCorrect) ring = "border-emerald-500/60 bg-emerald-500/10";
          else if (revealed && isSel && !isCorrect) ring = "border-red-500/50 bg-red-500/10";
          else if (revealed && !isSel && isCorrect) ring = "border-emerald-500/40 bg-emerald-500/5";
          return (
            <li key={i}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => setPicked(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-200 transition ${ring}`}
              >
                <span className="text-slate-500">{String.fromCharCode(65 + i)}.</span> {c}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {!revealed && picked !== null && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
          >
            Check answer
          </button>
        )}
        {revealed && (
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">Why: </span>
            {check.explanation}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PhaseKnowledgeSection({ phase, variant = "full" }) {
  const showPrep = variant !== "mcqs_only";
  const objectives = phase.learning_objectives || [];
  const tips = phase.study_tips || [];
  const activities = phase.key_activities || [];
  const checks = phase.knowledge_checks || [];

  return (
    <div className={`space-y-6 ${showPrep ? "mt-5 border-t border-white/10 pt-5" : ""}`}>
      {showPrep && objectives.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Learning objectives</h4>
          <ul className="mt-2 list-inside list-decimal text-sm text-slate-300">
            {objectives.map((o, i) => (
              <li key={i} className="pl-1">
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPrep && tips.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Study tips</h4>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
            {tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {showPrep && activities.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Suggested activities</h4>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
            {activities.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {checks.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
            Knowledge checks ({checks.length})
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Self-check questions for this phase (not graded — for your own feedback until a full quiz service is
            connected).
          </p>
          <div className="mt-3 space-y-4">
            {checks.map((c, i) => (
              <CheckCard key={i} check={c} qIndex={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
