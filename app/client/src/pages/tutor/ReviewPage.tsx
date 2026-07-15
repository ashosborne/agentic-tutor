import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Assessment, Child, Worksheet } from '@shared/types';
import { recommendationHint, recommendationLabel } from '@shared/assessmentLabels';
import { api } from '../../lib/api';

const FACES = [
  { value: 1, label: '😞' },
  { value: 2, label: '😕' },
  { value: 3, label: '😐' },
  { value: 4, label: '🙂' },
  { value: 5, label: '😄' },
] as const;

export function ReviewPage() {
  const { id, worksheetId } = useParams<{ id: string; worksheetId: string }>();
  const [child, setChild] = useState<Child | null>(null);
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [completedCore, setCompletedCore] = useState<'yes' | 'mostly' | 'no'>('yes');
  const [timeMinutes, setTimeMinutes] = useState(12);
  const [helpCount, setHelpCount] = useState(0);
  const [enjoyment, setEnjoyment] = useState(4);
  const [parentEffort, setParentEffort] = useState<'easy' | 'okay' | 'hard'>('okay');
  const [errorNotes, setErrorNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    decisionNote: string | null;
    summary: string;
  } | null>(null);

  useEffect(() => {
    if (!id || !worksheetId) return;
    Promise.all([
      api.getChild(id),
      api.getWorksheet(worksheetId),
      api.listAssessments(id),
      api.getSessionReportStatus(worksheetId),
    ])
      .then(([c, ws, assessments, status]) => {
        setChild(c);
        setWorksheet(ws);
        setTimeMinutes(ws.durationMinutes || (c.age <= 6 ? 7 : 12));
        const match = assessments.find((a) => a.worksheetId === worksheetId) ?? null;
        setAssessment(match);
        if (status.report) {
          setDone({
            decisionNote: null,
            summary: 'You’ve already told us how this one went.',
          });
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id, worksheetId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !worksheetId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.submitSessionReport(id, worksheetId, {
        completedCore,
        timeMinutes,
        helpCount,
        enjoyment,
        parentEffort,
        errorNotes,
      });
      const insights = await api.getTutorInsights(id);
      setDone({
        decisionNote: result.decisionNote,
        summary: insights.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (error && !child) return <p className="error">{error}</p>;
  if (!child || !worksheet) return <p className="muted">Loading…</p>;

  if (done) {
    return (
      <div className="fade-in stack">
        <section className="hero" style={{ marginBottom: '1rem' }}>
          <p className="section-title">Thank you</p>
          <h1>Here’s what we’ll try next</h1>
        </section>
        {assessment && (
          <section className="panel stack">
            <p className="section-title">How the marking looked</p>
            <p className="story" style={{ maxWidth: '40ch' }}>
              {assessment.summary}
            </p>
          </section>
        )}
        <section className="panel stack">
          <p className="section-title">What we’re learning about {child.name}</p>
          <p>{done.summary}</p>
          {done.decisionNote && <p className="meta">{done.decisionNote}</p>}
          <div className="row">
            <Link className="btn" to={`/children/${child.id}/tutor/lesson`}>
              Plan another lesson
            </Link>
            <Link className="btn secondary" to={`/children/${child.id}/tutor/insights`}>
              See insights
            </Link>
            <Link className="btn ghost" to={`/children/${child.id}`}>
              Back to {child.name}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1rem' }}>
        <p className="section-title">How it went</p>
        <h1>{worksheet.title}</h1>
        <p>
          A few quick taps from you help us learn which worksheet styles help {child.name} —
          no tech knowledge needed.
        </p>
      </section>

      {assessment && (
        <section className="panel stack">
          <p className="section-title">Marked summary</p>
          <p className="story" style={{ maxWidth: '40ch' }}>
            {assessment.summary}
          </p>
          <div className="list">
            {assessment.results.map((r) => (
              <div key={r.topicId} className="list-item">
                <div>
                  <strong>{recommendationLabel(r.recommendation)}</strong>
                  <p className="meta">{recommendationHint(r.recommendation)}</p>
                  <p className="meta">{r.evidence.join(' · ')}</p>
                </div>
                <span className="status">{Math.round(r.score * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <form className="panel stack" onSubmit={onSubmit}>
        <div>
          <p className="section-title">Did they finish the main part?</p>
          <div className="chip-row">
            {(
              [
                ['yes', 'Yes'],
                ['mostly', 'Mostly'],
                ['no', 'No'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${completedCore === value ? 'active' : ''}`}
                onClick={() => setCompletedCore(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          About how many minutes did it take?
          <input
            type="number"
            min={1}
            max={60}
            value={timeMinutes}
            onChange={(e) => setTimeMinutes(Number(e.target.value))}
            required
          />
        </label>

        <div>
          <p className="section-title">How much adult help with understanding?</p>
          <div className="chip-row">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${helpCount === n ? 'active' : ''}`}
                onClick={() => setHelpCount(n)}
              >
                {n === 3 ? '3+' : String(n)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-title">How did they feel?</p>
          <div className="face-row" role="group" aria-label="Enjoyment">
            {FACES.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`face-btn ${enjoyment === f.value ? 'active' : ''}`}
                onClick={() => setEnjoyment(f.value)}
                aria-label={`Enjoyment ${f.value} of 5`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-title">How was it for you?</p>
          <div className="chip-row">
            {(
              [
                ['easy', 'Easy'],
                ['okay', 'Okay'],
                ['hard', 'Hard'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${parentEffort === value ? 'active' : ''}`}
                onClick={() => setParentEffort(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          Where did they get stuck? (optional)
          <textarea
            rows={3}
            value={errorNotes}
            onChange={(e) => setErrorNotes(e.target.value)}
            placeholder="e.g. reading the instructions, the second question…"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save how it went'}
          </button>
          <Link className="btn ghost" to={`/children/${child.id}`}>
            Skip for now
          </Link>
        </div>
      </form>
    </div>
  );
}
