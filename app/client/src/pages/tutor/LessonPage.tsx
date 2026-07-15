import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Child, LessonProposal, Worksheet } from '@shared/types';
import { TUTOR_DURATION_OPTIONS } from '@shared/types';
import { api } from '../../lib/api';

export function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [proposal, setProposal] = useState<LessonProposal | null>(null);
  const [theme, setTheme] = useState('');
  const [duration, setDuration] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Worksheet | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getChild(id), api.getTutorDashboard(id)])
      .then(([c, dash]) => {
        setChild(c);
        if (dash.nextStep === 'baseline') {
          navigate(`/children/${id}/tutor/baseline`, { replace: true });
          return;
        }
        if (dash.proposal) {
          setProposal(dash.proposal);
          setTheme(dash.proposal.theme);
          setDuration(dash.proposal.durationMinutes);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id, navigate]);

  async function refreshProposal(nextTheme: string, nextDuration: number) {
    if (!id) return;
    try {
      const p = await api.proposeLesson(id, {
        theme: nextTheme,
        durationMinutes: nextDuration,
      });
      setProposal(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update proposal');
    }
  }

  async function onCreate() {
    if (!id || !theme.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createTutorWorksheet(id, {
        theme: theme.trim(),
        durationMinutes: duration,
        preferTopicId: proposal?.topicId,
      });
      setCreated(result.worksheet);
      setProposal(result.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create worksheet');
    } finally {
      setBusy(false);
    }
  }

  if (error && !child) return <p className="error">{error}</p>;
  if (!child || !proposal) return <p className="muted">Loading…</p>;

  if (created) {
    return (
      <div className="fade-in stack">
        <p className="section-title">Ready to print</p>
        <h1>{created.title}</h1>
        <p className="meta">
          Theme: {created.theme} · about {created.durationMinutes} minutes
          {proposal.designVariant ? ` · style: ${proposal.designVariant.label}` : ''}
        </p>
        <p className="meta">
          After {child.name} finishes, photograph the sheet and tell us how it went — that
          helps us learn what suits them.
        </p>
        <div className="row">
          <a
            className="btn"
            href={`/api/worksheets/${created.id}/file`}
            target="_blank"
            rel="noreferrer"
          >
            View / print
          </a>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              void api.markPrinted(created.id);
              navigate(`/children/${child.id}/upload/${created.id}`);
            }}
          >
            Upload scan when done
          </button>
          <Link className="btn ghost" to={`/children/${child.id}/tutor`}>
            Tutor home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1rem' }}>
        <p className="section-title">Today’s lesson for {child.name}</p>
        <h1>{proposal.topicName ?? 'Next focus'}</h1>
        <p>{proposal.why}</p>
      </section>

      {proposal.experimentNote && (
        <section className="panel insight-card">
          <p className="section-title">A gentle experiment</p>
          <p className="meta">{proposal.experimentNote}</p>
          <p className="meta" style={{ marginTop: '0.5rem' }}>
            You don’t need to do anything special — just use the worksheet as usual.
          </p>
        </section>
      )}

      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate();
        }}
      >
        <p className="meta">
          {proposal.subject} · {proposal.domain}
        </p>

        <label className="field">
          Theme
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onBlur={() => void refreshProposal(theme, duration)}
            placeholder="e.g. unicorns, sea life, space…"
            required
          />
        </label>

        <div>
          <p className="section-title">How long?</p>
          <div className="chip-row">
            {TUTOR_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                className={`chip ${duration === opt.minutes ? 'active' : ''}`}
                onClick={() => {
                  setDuration(opt.minutes);
                  void refreshProposal(theme, opt.minutes);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create today’s worksheet'}
          </button>
          <Link className="btn ghost" to={`/children/${child.id}/tutor`}>
            Back
          </Link>
          <Link className="btn ghost" to={`/children/${child.id}/generate`}>
            Advanced options
          </Link>
        </div>
      </form>
    </div>
  );
}
