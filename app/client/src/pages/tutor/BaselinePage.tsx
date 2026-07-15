import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  BaselineAnswers,
  Child,
  SubjectConfidence,
  Worksheet,
} from '@shared/types';
import { suggestedDurationMinutes } from '@shared/abTests';
import { defaultBaselineAnswers } from '@shared/tutorLogic';
import { api } from '../../lib/api';

const STEPS = ['Welcome', 'Subjects', 'Reading & focus', 'Confidence', 'Summary'] as const;

const CONFIDENCE: { value: SubjectConfidence; label: string }[] = [
  { value: 'strong', label: 'Strong' },
  { value: 'ok', label: 'Okay' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'tricky', label: 'Tricky' },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function BaselinePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<BaselineAnswers | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneSummary, setDoneSummary] = useState<string | null>(null);
  const [diagnosticWorksheet, setDiagnosticWorksheet] = useState<Worksheet | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getChild(id), api.getSubjects(), api.getTutorDashboard(id)])
      .then(([c, s, dash]) => {
        setChild(c);
        setSubjects(s);
        setAnswers(dash.profile.baselineAnswers ?? defaultBaselineAnswers(c.age));
        if (dash.profile.status === 'active' && !dash.profile.baselineAnswers) {
          // Seeded profiles already active — still allow re-run
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const focusDefault = useMemo(
    () => (child ? suggestedDurationMinutes(child.age) : 10),
    [child],
  );

  if (error) return <p className="error">{error}</p>;
  if (!child || !answers) return <p className="muted">Loading…</p>;

  if (doneSummary) {
    return (
      <div className="fade-in stack">
        <section className="hero" style={{ marginBottom: '1rem' }}>
          <p className="section-title">All set</p>
          <h1>Thanks — here’s what we heard</h1>
        </section>
        <section className="panel stack">
          <p className="story" style={{ maxWidth: '42ch' }}>
            {doneSummary}
          </p>
          {diagnosticWorksheet && (
            <div className="stack">
              <p className="section-title">Your short check-in worksheet</p>
              <p className="meta">
                {diagnosticWorksheet.title} · about {diagnosticWorksheet.durationMinutes}{' '}
                minutes. Print it when you’re ready — uploading the scan later will refine
                what we know about {child.name}.
              </p>
              <div className="row">
                <a
                  className="btn secondary"
                  href={`/api/worksheets/${diagnosticWorksheet.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View / print check-in
                </a>
                <Link
                  className="btn ghost"
                  to={`/children/${child.id}/upload/${diagnosticWorksheet.id}`}
                >
                  Upload scan when done
                </Link>
              </div>
            </div>
          )}
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => navigate(`/children/${child.id}/tutor/lesson`)}
            >
              See today’s lesson
            </button>
            <Link className="btn secondary" to={`/children/${child.id}`}>
              Back to {child.name}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  async function onSubmit() {
    if (!id || !answers) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.submitBaseline(id, answers);
      setDoneSummary(result.profile.baselineSummary);
      setDiagnosticWorksheet(result.diagnosticWorksheet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1rem' }}>
        <p className="section-title">Get to know {child.name}</p>
        <h1>{STEPS[step]}</h1>
        <p>About 2 minutes. There are no wrong answers — this just helps us start kindly.</p>
      </section>

      <ol className="stepper" aria-label="Baseline steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'active' : i < step ? 'done' : ''}>
            <span className="stepper-index">{i + 1}</span>
            <span className="stepper-label">{label}</span>
          </li>
        ))}
      </ol>

      <section className="panel stack">
        {step === 0 && (
          <>
            <p>
              We’ll ask a few simple questions about what {child.name} enjoys, where things
              feel tricky, and how long they can usually focus.
            </p>
            <p className="meta">
              Later, after each worksheet, a short “how it went” note helps us learn which
              worksheet styles suit them.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <p className="section-title">Subjects they enjoy</p>
              <div className="chip-row">
                {subjects.map((s) => (
                  <button
                    key={`enjoy-${s}`}
                    type="button"
                    className={`chip ${answers.enjoySubjects.includes(s) ? 'active' : ''}`}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        enjoySubjects: toggle(answers.enjoySubjects, s),
                      })
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="section-title">Subjects that feel trickier</p>
              <div className="chip-row">
                {subjects.map((s) => (
                  <button
                    key={`tricky-${s}`}
                    type="button"
                    className={`chip ${answers.trickySubjects.includes(s) ? 'active' : ''}`}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        trickySubjects: toggle(answers.trickySubjects, s),
                      })
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="section-title">Reading instructions</p>
              <div className="chip-row">
                {(
                  [
                    ['independent', 'Mostly independent'],
                    ['some_help', 'Needs a little help'],
                    ['read_aloud', 'We read aloud together'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${answers.readingSupport === value ? 'active' : ''}`}
                    onClick={() => setAnswers({ ...answers, readingSupport: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="section-title">Comfortable focus time</p>
              <div className="chip-row">
                {[focusDefault, 8, 12, 15, 20]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .sort((a, b) => a - b)
                  .map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`chip ${answers.focusMinutes === mins ? 'active' : ''}`}
                      onClick={() => setAnswers({ ...answers, focusMinutes: mins })}
                    >
                      About {mins} min
                    </button>
                  ))}
              </div>
              <p className="meta" style={{ marginTop: '0.5rem' }}>
                Suggested for age {child.age}: about {focusDefault} minutes.
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="section-title">Maths at the moment</p>
              <div className="chip-row">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`chip ${answers.mathsConfidence === c.value ? 'active' : ''}`}
                    onClick={() => setAnswers({ ...answers, mathsConfidence: c.value })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="section-title">English at the moment</p>
              <div className="chip-row">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`chip ${answers.englishConfidence === c.value ? 'active' : ''}`}
                    onClick={() => setAnswers({ ...answers, englishConfidence: c.value })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              Anything else we should know? (optional)
              <textarea
                rows={3}
                value={answers.otherNotes ?? ''}
                onChange={(e) => setAnswers({ ...answers, otherNotes: e.target.value })}
                placeholder="e.g. gets tired after school, loves stickers…"
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(answers.wantDiagnosticWorksheet)}
                onChange={(e) =>
                  setAnswers({ ...answers, wantDiagnosticWorksheet: e.target.checked })
                }
              />
              <span>After this, I’d like a short check-in worksheet to print</span>
            </label>
          </>
        )}

        {step === 4 && (
          <>
            <p className="section-title">Ready to save</p>
            <ul className="plain-list">
              <li>
                Enjoys:{' '}
                {answers.enjoySubjects.length
                  ? answers.enjoySubjects.join(', ')
                  : 'not specified'}
              </li>
              <li>
                Trickier:{' '}
                {answers.trickySubjects.length
                  ? answers.trickySubjects.join(', ')
                  : 'not specified'}
              </li>
              <li>Focus: about {answers.focusMinutes} minutes</li>
              <li>Maths: {answers.mathsConfidence} · English: {answers.englishConfidence}</li>
            </ul>
            <p className="meta">
              We’ll turn this into a gentle starting picture of {child.name}’s learning — you
              can always update things later by exploring the learning path.
            </p>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="row">
          {step > 0 && (
            <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => void onSubmit()}>
              {busy ? 'Saving…' : 'Save and continue'}
            </button>
          )}
          <Link className="btn ghost" to={`/children/${child.id}`}>
            Cancel
          </Link>
        </div>
      </section>
    </div>
  );
}
