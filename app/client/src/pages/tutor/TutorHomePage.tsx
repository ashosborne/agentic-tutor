import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Child, TutorDashboard } from '@shared/types';
import { api } from '../../lib/api';

export function TutorHomePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [dash, setDash] = useState<TutorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getChild(id), api.getTutorDashboard(id)])
      .then(([c, d]) => {
        setChild(c);
        setDash(d);
        if (d.nextStep === 'baseline') {
          navigate(`/children/${id}/tutor/baseline`, { replace: true });
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id, navigate]);

  if (error) return <p className="error">{error}</p>;
  if (!child || !dash) return <p className="muted">Loading…</p>;

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1rem' }}>
        <p className="section-title">Tutor</p>
        <h1>Learning with {child.name}</h1>
        <p>
          We’ll suggest a short worksheet, mark how it went, and quietly learn which
          styles help {child.name} most.
        </p>
      </section>

      {dash.profile.baselineSummary && (
        <section className="panel stack">
          <p className="section-title">What we know so far</p>
          <p className="story" style={{ maxWidth: '42ch' }}>
            {dash.profile.baselineSummary}
          </p>
        </section>
      )}

      {dash.experimentCard && (
        <section className="panel insight-card stack" aria-label="What we’re trying">
          <p className="section-title">What we’re trying</p>
          <h2 style={{ fontSize: '1.4rem' }}>{dash.experimentCard.title}</h2>
          <p className="meta">{dash.experimentCard.body}</p>
          <p className="meta">{dash.experimentCard.progressLabel}</p>
        </section>
      )}

      {dash.proposal && (
        <section className="panel stack">
          <p className="section-title">Suggested next lesson</p>
          <h2 style={{ fontSize: '1.5rem' }}>
            {dash.proposal.topicName ?? 'Next topic'}
          </h2>
          <p className="meta">
            {dash.proposal.subject} · {dash.proposal.domain} · about{' '}
            {dash.proposal.durationMinutes} minutes · theme “{dash.proposal.theme}”
          </p>
          <p>{dash.proposal.why}</p>
          <div className="row">
            <Link className="btn" to={`/children/${child.id}/tutor/lesson`}>
              Review today’s lesson
            </Link>
            <Link className="btn secondary" to={`/children/${child.id}/tutor/insights`}>
              What we’re learning
            </Link>
          </div>
        </section>
      )}

      <div className="row">
        <Link className="btn ghost" to={`/children/${child.id}`}>
          Back to {child.name}
        </Link>
        <Link className="btn ghost" to={`/children/${child.id}/generate`}>
          Advanced: create worksheet yourself
        </Link>
      </div>
    </div>
  );
}
