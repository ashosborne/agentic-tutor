import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AbTestId, Child, DesignArm, TutorInsightView } from '@shared/types';
import { AB_TESTS, parentArmLabel } from '@shared/abTests';
import { api } from '../../lib/api';

export function InsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [child, setChild] = useState<Child | null>(null);
  const [insights, setInsights] = useState<TutorInsightView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    const [c, i] = await Promise.all([api.getChild(id), api.getTutorInsights(id)]);
    setChild(c);
    setInsights(i);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, [id]);

  async function prefer(testId: AbTestId, arm: DesignArm) {
    if (!id) return;
    setError(null);
    try {
      await api.setTutorPref(id, testId, arm);
      await refresh();
      setMessage(`Saved — we’ll favour that style for ${child?.name ?? 'them'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save preference');
    }
  }

  if (error && !insights) return <p className="error">{error}</p>;
  if (!child || !insights) return <p className="muted">Loading…</p>;

  const openTestId = insights.inProgress?.testId;

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1rem' }}>
        <p className="section-title">Insights</p>
        <h1>What seems to help {child.name}</h1>
        <p>{insights.summary}</p>
      </section>

      {insights.inProgress && (
        <section className="panel insight-card stack">
          <p className="section-title">Still learning</p>
          <h2 style={{ fontSize: '1.35rem' }}>{insights.inProgress.title}</h2>
          <p className="meta">{insights.inProgress.body}</p>
          <p className="meta">{insights.inProgress.progressLabel}</p>
        </section>
      )}

      <section className="panel stack">
        <p className="section-title">Styles that seem to help</p>
        {insights.adopted.length === 0 ? (
          <p className="meta">
            After a few worksheets with “how it went” notes, you’ll see clear preferences
            here.
          </p>
        ) : (
          <div className="list">
            {insights.adopted.map((item) => (
              <div key={item.testId} className="list-item">
                <div>
                  <strong>{item.label}</strong>
                  <p className="meta">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {openTestId && (
        <section className="panel stack">
          <p className="section-title">Prefer a style yourself?</p>
          <p className="meta">
            If you already know what works, you can choose — we’ll follow your lead.
          </p>
          <div className="row">
            {(['A', 'B'] as const).map((arm) => (
              <button
                key={arm}
                type="button"
                className="btn secondary"
                onClick={() => void prefer(openTestId, arm)}
              >
                Prefer: {parentArmLabel(openTestId, arm)}
              </button>
            ))}
          </div>
        </section>
      )}

      {insights.completed.length > 0 && (
        <section className="panel stack">
          <p className="section-title">Earlier findings</p>
          <div className="list">
            {insights.completed.map((c) => (
              <div key={`${c.testId}-${c.completedAt}`} className="list-item">
                <div>
                  <strong>{AB_TESTS[c.testId].parentTitle}</strong>
                  <p className="meta">{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {message && <p className="muted">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="row">
        <Link className="btn" to={`/children/${child.id}/tutor/lesson`}>
          Continue with the tutor
        </Link>
        <Link className="btn ghost" to={`/children/${child.id}`}>
          Back to {child.name}
        </Link>
      </div>
    </div>
  );
}
