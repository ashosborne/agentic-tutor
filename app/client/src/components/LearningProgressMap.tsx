import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  LearningPath,
  LearningPathDomain,
  LearningPathSubject,
  LearningPathTopic,
  RagCounts,
} from '@shared/types';
import { isPrerequisiteSatisfied, ragLabel } from '@shared/mastery';
import { RagLegend } from './RagLegend';

type PathwayBand = 'built' | 'growing' | 'ready' | 'locked';

function getFocusSubject(
  path: LearningPath,
  selectedSubject: string | null,
): LearningPathSubject | null {
  const subjectName =
    selectedSubject ??
    path.frontier?.subject ??
    path.subjects.find((s) => s.ragCounts.green + s.ragCounts.amber > 0)?.subject ??
    path.subjects[0]?.subject;

  if (!subjectName) return null;
  return path.subjects.find((s) => s.subject === subjectName) ?? null;
}

function defaultDomainName(
  subject: LearningPathSubject,
  frontier: LearningPath['frontier'],
): string {
  if (frontier?.subject === subject.subject) {
    const match = subject.domains.find((d) => d.domain === frontier.domain);
    if (match) return match.domain;
  }
  return (
    subject.domains.find((d) => d.topics.some((t) => t.rag !== 'green'))?.domain ??
    subject.domains[0]?.domain ??
    ''
  );
}

function getFocusDomain(
  subject: LearningPathSubject | null,
  selectedDomain: string | null,
  frontier: LearningPath['frontier'],
): LearningPathDomain | null {
  if (!subject || subject.domains.length === 0) return null;
  const domainName = selectedDomain ?? defaultDomainName(subject, frontier);
  return (
    subject.domains.find((d) => d.domain === domainName) ?? subject.domains[0] ?? null
  );
}

function domainTopicCount(domain: LearningPathDomain): number {
  return domain.topics.length;
}

function prereqsSatisfied(
  topicId: string,
  domain: LearningPathDomain,
): boolean {
  const byId = new Map(domain.topics.map((t) => [t.id, t]));
  const prereqs = domain.edges
    .filter((e) => e.to === topicId)
    .map((e) => byId.get(e.from));
  if (prereqs.length === 0) return true;
  return prereqs.every((t) => t && isPrerequisiteSatisfied(t.status));
}

function pathwayBand(
  topic: LearningPathTopic,
  domain: LearningPathDomain,
): PathwayBand {
  if (topic.rag === 'green') return 'built';
  if (topic.rag === 'amber') return 'growing';
  return prereqsSatisfied(topic.id, domain) ? 'ready' : 'locked';
}

function bandLabel(band: PathwayBand): string {
  switch (band) {
    case 'built':
      return 'Built';
    case 'growing':
      return 'Growing';
    case 'ready':
      return 'Ready next';
    case 'locked':
      return 'Locked';
  }
}

function adjacentTopics(
  domain: LearningPathDomain,
  topicId: string,
): { buildsOn: LearningPathTopic[]; unlocksNext: LearningPathTopic[] } {
  const byId = new Map(domain.topics.map((t) => [t.id, t]));
  const buildsOn = domain.edges
    .filter((e) => e.to === topicId)
    .map((e) => byId.get(e.from))
    .filter((t): t is LearningPathTopic => Boolean(t));
  const unlocksNext = domain.edges
    .filter((e) => e.from === topicId)
    .map((e) => byId.get(e.to))
    .filter((t): t is LearningPathTopic => Boolean(t));
  return { buildsOn, unlocksNext };
}

function ragTotal(counts: RagCounts): number {
  return counts.red + counts.amber + counts.green;
}

export function LearningProgressMap({
  path,
  childId,
}: {
  path: LearningPath;
  childId: string;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(
    path.frontier?.subject ?? null,
  );
  const [selectedDomain, setSelectedDomain] = useState<string | null>(
    path.frontier?.domain ?? null,
  );

  const subject = useMemo(
    () => getFocusSubject(path, selectedSubject),
    [path, selectedSubject],
  );
  const domain = useMemo(
    () => getFocusDomain(subject, selectedDomain, path.frontier),
    [subject, selectedDomain, path.frontier],
  );

  const defaultTopicId =
    (domain &&
      path.frontier?.domain === domain.domain &&
      path.frontier.subject === subject?.subject &&
      path.frontier.topicId) ||
    domain?.topics.find((t) => pathwayBand(t, domain) === 'ready')?.id ||
    domain?.topics.find((t) => t.rag === 'amber')?.id ||
    domain?.topics[0]?.id ||
    null;

  const [selectedId, setSelectedId] = useState<string | null>(defaultTopicId);

  const activeSelectedId =
    domain && selectedId && domain.topics.some((t) => t.id === selectedId)
      ? selectedId
      : defaultTopicId;

  const selectedTopic =
    domain?.topics.find((t) => t.id === activeSelectedId) ?? null;
  const adjacent = selectedTopic && domain
    ? adjacentTopics(domain, selectedTopic.id)
    : { buildsOn: [], unlocksNext: [] };

  const spineTopics = useMemo(() => {
    if (!domain) return [];
    return domain.topics.map((topic) => ({
      ...topic,
      band: pathwayBand(topic, domain),
    }));
  }, [domain]);

  const subjectTotal = subject ? ragTotal(subject.ragCounts) : 0;

  function selectSubject(nextSubject: string) {
    setSelectedSubject(nextSubject);
    setSelectedDomain(null);
    setSelectedId(null);
  }

  function selectDomain(nextDomain: string) {
    setSelectedDomain(nextDomain);
    setSelectedId(null);
  }

  function selectTopic(topicId: string) {
    setSelectedId(topicId);
  }

  return (
    <section className="progress-map" aria-label="Learning progress">
      <div className="progress-map-header">
        <p className="section-title">Learning progress</p>
        {domain?.summary && (
          <p className="meta progress-map-summary">{domain.summary}</p>
        )}
        <RagLegend counts={path.ragCounts} />
      </div>

      <div className="progress-map-subjects" role="group" aria-label="Progress by subject">
        {path.subjects.map((s) => {
          const total = ragTotal(s.ragCounts) || 1;
          const active = subject?.subject === s.subject;
          return (
            <button
              key={s.subject}
              type="button"
              className={`progress-map-subject${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => selectSubject(s.subject)}
            >
              <span className="progress-map-subject-label">
                <span className="progress-map-subject-name">{s.subject}</span>
                <span className="progress-map-subject-count meta">
                  {total} concepts · {s.ragCounts.red} to learn · {s.domains.length}{' '}
                  areas
                </span>
              </span>
              <span
                className="progress-map-bar"
                aria-label={`${s.ragCounts.green} excellent, ${s.ragCounts.amber} growing, ${s.ragCounts.red} needs learning, ${total} concepts across ${s.domains.length} areas`}
              >
                {s.ragCounts.green > 0 && (
                  <span
                    className="seg green"
                    style={{ flexGrow: s.ragCounts.green }}
                  />
                )}
                {s.ragCounts.amber > 0 && (
                  <span
                    className="seg amber"
                    style={{ flexGrow: s.ragCounts.amber }}
                  />
                )}
                {s.ragCounts.red > 0 && (
                  <span
                    className="seg red"
                    style={{ flexGrow: s.ragCounts.red }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {subject && domain && (
        <div className="progress-map-focus">
          <div className="progress-map-focus-label">
            <p className="section-title">{subject.subject}</p>
            <p className="meta">
              {subjectTotal} concepts across {subject.domains.length} areas — pick an
              area, then a concept
            </p>
          </div>

          <div
            className="progress-map-domains"
            role="group"
            aria-label={`${subject.subject} areas`}
          >
            {subject.domains.map((d) => {
              const count = domainTopicCount(d);
              const toLearn = d.topics.filter((t) => t.rag === 'red').length;
              const active = d.domain === domain.domain;
              return (
                <button
                  key={d.domain}
                  type="button"
                  className={`progress-map-domain${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => selectDomain(d.domain)}
                >
                  <span className="progress-map-domain-name">{d.domain}</span>
                  <span className="meta">
                    {count} concepts · {toLearn} to learn
                  </span>
                </button>
              );
            })}
          </div>

          <div className="progress-map-focus-label">
            <p className="section-title">{domain.domain}</p>
            <p className="meta">
              {domain.topics.length} of {subjectTotal} {subject.subject} concepts · in
              the order they build
            </p>
          </div>

          <ol
            className="progress-map-spine"
            aria-label={`${domain.domain} learning pathway`}
          >
            {spineTopics.map((topic, index) => {
              const isFrontier = path.frontier?.topicId === topic.id;
              const isSelected = activeSelectedId === topic.id;
              return (
                <li key={topic.id} className="progress-map-spine-item">
                  {index < spineTopics.length - 1 && (
                    <span className="progress-map-spine-thread" aria-hidden />
                  )}
                  <button
                    type="button"
                    className={`progress-map-node rag-${topic.rag} band-${topic.band}${isFrontier ? ' frontier' : ''}${isSelected ? ' selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={`${topic.name ?? 'Concept'}, ${bandLabel(topic.band)}, ${ragLabel(topic.rag)}`}
                    onClick={() => selectTopic(topic.id)}
                  >
                    <span className="progress-map-dot-wrap" aria-hidden>
                      {isFrontier && <span className="progress-map-frontier-ring" />}
                      <span className="progress-map-dot" />
                    </span>
                    <span className="progress-map-node-body">
                      <strong className="progress-map-node-name">
                        {topic.name ?? 'Concept'}
                      </strong>
                      <span className="progress-map-node-meta">
                        {bandLabel(topic.band)}
                        <span aria-hidden> · </span>
                        {ragLabel(topic.rag)}
                        {isFrontier ? ' · Next focus' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {path.frontier &&
            domain.topics.some((t) => t.id === path.frontier?.topicId) && (
              <p className="constellation-caption">
                Next focus: {path.frontier.topicName ?? 'a new concept'}
                <span className="meta">
                  {' '}
                  · {path.frontier.subject} · {path.frontier.domain}
                </span>
              </p>
            )}
        </div>
      )}

      <div className="progress-map-detail">
        {selectedTopic && domain ? (
          <>
            <div className="progress-map-detail-head">
              <p className="section-title">Selected concept</p>
              <h2 className="progress-map-detail-title">
                {selectedTopic.name ?? 'Concept'}
              </h2>
              <p className="meta">
                <span className={`rag-${selectedTopic.rag}`}>
                  {ragLabel(selectedTopic.rag)}
                </span>
                {' · '}
                {selectedTopic.subject} · {selectedTopic.domain}
                {' · '}
                {bandLabel(pathwayBand(selectedTopic, domain))}
              </p>
            </div>
            {selectedTopic.description && (
              <p className="progress-map-detail-desc">{selectedTopic.description}</p>
            )}
            <div className="progress-map-adjacent">
              <AdjacentList
                title="Builds on"
                empty="No prerequisites in this path"
                topics={adjacent.buildsOn}
                domain={domain}
                onSelect={selectTopic}
              />
              <AdjacentList
                title="Unlocks next"
                empty="Nothing unlocked from here yet"
                topics={adjacent.unlocksNext}
                domain={domain}
                onSelect={selectTopic}
              />
            </div>
            <div className="row progress-map-actions">
              <Link className="btn secondary" to={`/children/${childId}/progress`}>
                Explore learning path
              </Link>
              <Link
                className="btn"
                to={`/children/${childId}/generate`}
                state={{
                  subjectFocus: selectedTopic.subject,
                  domainFocus: selectedTopic.domain,
                  preferTopicId: selectedTopic.id,
                  preferTopicName: selectedTopic.name ?? undefined,
                }}
              >
                Create worksheet
              </Link>
            </div>
          </>
        ) : (
          <p className="muted">
            Start with any Ready concept — pick a subject above to see the path.
          </p>
        )}
      </div>
    </section>
  );
}

function AdjacentList({
  title,
  empty,
  topics,
  domain,
  onSelect,
}: {
  title: string;
  empty: string;
  topics: LearningPathTopic[];
  domain: LearningPathDomain;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="progress-map-adjacent-col">
      <p className="section-title">{title}</p>
      {topics.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="progress-map-adjacent-list">
          {topics.map((topic) => {
            const band = pathwayBand(topic, domain);
            return (
              <li key={topic.id}>
                <button
                  type="button"
                  className={`progress-map-adjacent-item rag-${topic.rag}`}
                  onClick={() => onSelect(topic.id)}
                >
                  <span className="progress-map-adjacent-dot" aria-hidden />
                  <span>
                    <strong>{topic.name ?? 'Concept'}</strong>
                    <span className="meta">
                      {bandLabel(band)} · {ragLabel(topic.rag)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** @deprecated Use LearningProgressMap */
export { LearningProgressMap as ConceptConstellation };
