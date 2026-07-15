import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  Child,
  LearningPath,
  ProgressSummary,
  TutorDashboard,
  Worksheet,
} from '@shared/types';
import { api } from '../lib/api';
import { LearningProgressMap } from '../components/LearningProgressMap';

export function ChildPage() {
  const { id } = useParams<{ id: string }>();
  const [child, setChild] = useState<Child | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [tutor, setTutor] = useState<TutorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getChild(id),
      api.getProgress(id),
      api.getLearningPath(id),
      api.listWorksheets(id),
      api.getTutorDashboard(id),
    ])
      .then(([c, p, lp, w, t]) => {
        setChild(c);
        setProgress(p);
        setPath(lp);
        setWorksheets(w);
        setTutor(t);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!child || !progress || !path || !tutor) return <p className="muted">Loading…</p>;

  const needsBaseline = tutor.nextStep === 'baseline';
  const primaryTo = needsBaseline
    ? `/children/${child.id}/tutor/baseline`
    : `/children/${child.id}/tutor/lesson`;
  const primaryLabel = needsBaseline
    ? `Get to know ${child.name}`
    : 'Continue with the tutor';

  return (
    <div className="fade-in stack">
      <section className="hero" style={{ marginBottom: '1.5rem' }}>
        <p className="section-title">{child.name}</p>
        <h1 className="story">{progress.story}</h1>
        <p className="meta">
          Age {child.age}
          {progress.suggestedTheme ? ` · Try a “${progress.suggestedTheme}” theme` : ''}
        </p>
      </section>

      <section className="panel stack tutor-cta">
        <p className="section-title">Guided tutor</p>
        <p>
          {needsBaseline
            ? `Start with a short chat about ${child.name} — then we’ll suggest the right first worksheet.`
            : `We’ll propose today’s focus, create a worksheet, and learn which styles help ${child.name} most.`}
        </p>
        {tutor.experimentCard && !needsBaseline && (
          <p className="meta">
            {tutor.experimentCard.title}. {tutor.experimentCard.progressLabel}.
          </p>
        )}
        <div className="row">
          <Link className="btn" to={primaryTo}>
            {primaryLabel}
          </Link>
          {!needsBaseline && (
            <Link className="btn secondary" to={`/children/${child.id}/tutor/insights`}>
              What we’re learning
            </Link>
          )}
        </div>
      </section>

      <div className="row">
        <Link className="btn secondary" to={`/children/${child.id}/generate`}>
          Create worksheet (advanced)
        </Link>
        <Link className="btn secondary" to={`/children/${child.id}/progress`}>
          Explore learning path
        </Link>
      </div>

      <LearningProgressMap path={path} childId={child.id} />

      <section className="panel stack">
        <div>
          <p className="section-title">Recent worksheets</p>
          {worksheets.length === 0 && (
            <p className="muted">No worksheets yet — continue with the tutor to begin.</p>
          )}
          <div className="list">
            {worksheets.map((ws) => (
              <div key={ws.id} className="list-item">
                <div>
                  <strong>{ws.title}</strong>
                  <p className="meta">
                    {ws.theme} · {ws.durationMinutes} min · {ws.status}
                  </p>
                </div>
                <div className="row">
                  <a
                    className="btn secondary"
                    href={`/api/worksheets/${ws.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                  {(ws.status === 'ready' ||
                    ws.status === 'printed' ||
                    ws.status === 'submitted') && (
                    <Link className="btn" to={`/children/${child.id}/upload/${ws.id}`}>
                      Upload scan
                    </Link>
                  )}
                  {ws.status === 'assessed' && (
                    <Link
                      className="btn"
                      to={`/children/${child.id}/tutor/review/${ws.id}`}
                    >
                      How it went
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
