import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Child, LearningPath, Worksheet } from '@shared/types';
import { DURATION_OPTIONS } from '@shared/types';
import { api } from '../lib/api';

type GenerateLocationState = {
  subjectFocus?: string;
  domainFocus?: string;
  preferTopicId?: string;
  preferTopicName?: string;
};

export function GeneratePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as GenerateLocationState | null) ?? null;

  const [child, setChild] = useState<Child | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [theme, setTheme] = useState('');
  const [duration, setDuration] = useState(20);
  const [subjectFocus, setSubjectFocus] = useState<string>(navState?.subjectFocus ?? '');
  const [domainFocus, setDomainFocus] = useState<string>(navState?.domainFocus ?? '');
  const [preferTopicId, setPreferTopicId] = useState<string | undefined>(
    navState?.preferTopicId,
  );
  const [preferTopicName, setPreferTopicName] = useState<string | undefined>(
    navState?.preferTopicName,
  );
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Worksheet | null>(null);

  const conceptFocused = Boolean(preferTopicId);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getChild(id), api.getSubjects(), api.getLearningPath(id)])
      .then(([c, s, lp]) => {
        setChild(c);
        setSubjects(s);
        setPath(lp);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const domainOptions = useMemo(() => {
    if (!path || !subjectFocus) return [];
    const subject = path.subjects.find((s) => s.subject === subjectFocus);
    if (!subject) return [];
    return subject.domains.map((d) => d.domain).sort((a, b) => a.localeCompare(b));
  }, [path, subjectFocus]);

  useEffect(() => {
    if (domainFocus && domainOptions.length > 0 && !domainOptions.includes(domainFocus)) {
      setDomainFocus('');
    }
  }, [domainFocus, domainOptions]);

  function onSubjectChange(value: string) {
    setSubjectFocus(value);
    setDomainFocus('');
  }

  function clearConceptFocus() {
    setPreferTopicId(undefined);
    setPreferTopicName(undefined);
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !theme.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ws = await api.createWorksheet({
        childId: id,
        theme: theme.trim(),
        durationMinutes: duration,
        subjectFocus: subjectFocus || null,
        domainFocus: domainFocus || null,
        preferTopicId: preferTopicId || null,
      });
      setCreated(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setBusy(false);
    }
  }

  if (!child) return <p className="muted">Loading…</p>;

  if (created) {
    return (
      <div className="fade-in stack">
        <p className="section-title">Ready to print</p>
        <h1>{created.title}</h1>
        <p className="meta">
          Theme: {created.theme} · {created.durationMinutes} minutes
          {created.subjectFocus ? ` · ${created.subjectFocus}` : ''}
          {created.domainFocus ? ` · ${created.domainFocus}` : ''}
        </p>
        <div className="row">
          <a className="btn" href={`/api/worksheets/${created.id}/file`} target="_blank" rel="noreferrer">
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
          <Link className="btn ghost" to={`/children/${child.id}`}>
            Back to {child.name}
          </Link>
        </div>
      </div>
    );
  }

  const focusMeta = [subjectFocus, domainFocus].filter(Boolean).join(' · ');

  return (
    <div className="fade-in">
      <section className="hero">
        <p className="section-title">New worksheet for {child.name}</p>
        <h1>Pick a theme &amp; time</h1>
        <p>Sea life, unicorns, ponies — whatever sparks their imagination.</p>
      </section>

      <form className="panel stack" onSubmit={onGenerate}>
        {conceptFocused && (
          <div className="concept-focus" role="group" aria-label="Concept focus">
            <div className="concept-focus-body">
              <p className="section-title">Focus</p>
              <p className="concept-focus-name">{preferTopicName}</p>
              {focusMeta && <p className="meta">{focusMeta}</p>}
            </div>
            <button type="button" className="btn ghost" onClick={clearConceptFocus}>
              Clear
            </button>
          </div>
        )}

        <label className="field">
          Theme
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. sea life, unicorns, space…"
            required
            autoFocus
          />
        </label>

        <div>
          <p className="section-title">How long?</p>
          <div className="chip-row">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                className={`chip ${duration === opt.minutes ? 'active' : ''}`}
                onClick={() => setDuration(opt.minutes)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {!conceptFocused && (
          <>
            <label className="field">
              Subject (optional)
              <select value={subjectFocus} onChange={(e) => onSubjectChange(e.target.value)}>
                <option value="">Any subject</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Area (optional)
              <select
                value={domainFocus}
                onChange={(e) => setDomainFocus(e.target.value)}
                disabled={!subjectFocus || domainOptions.length === 0}
              >
                <option value="">Any area</option>
                {domainOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create worksheet'}
          </button>
          <Link className="btn ghost" to={`/children/${child.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
