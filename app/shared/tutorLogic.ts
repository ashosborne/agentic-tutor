import type {
  AbTestId,
  BaselineAnswers,
  Child,
  DesignArm,
  DesignPrefs,
  LessonProposal,
  MasteryStatus,
  SubjectConfidence,
  Topic,
  TopicMastery,
} from './types.js';
import {
  AB_TESTS,
  armMeta,
  assignArm,
  emptyDesignPrefs,
  experimentCardCopy,
  pickNextExperiment,
  startExperiment,
  suggestedDurationMinutes,
} from './abTests.js';
import type { LearningPathFrontier } from './types.js';

export interface BaselineSeed {
  topicId: string;
  status: MasteryStatus;
  confidence: number;
  notes: string;
}

function confidenceToStatus(level: SubjectConfidence): {
  status: MasteryStatus;
  confidence: number;
} {
  switch (level) {
    case 'strong':
      return { status: 'practicing', confidence: 0.8 };
    case 'ok':
      return { status: 'introduced', confidence: 0.55 };
    case 'unsure':
      return { status: 'introduced', confidence: 0.4 };
    case 'tricky':
      return { status: 'needs_refresh', confidence: 0.35 };
  }
}

function ageFits(topic: Topic, age: number): boolean {
  const start = topic.ageRangeStart ?? age;
  const end = topic.ageRangeEnd ?? age;
  return age >= start - 1 && age <= end + 1;
}

function rankTopic(topic: Topic): number {
  let score = (topic.centrality ?? 0) * 100;
  if (topic.standards.some((s) => s.startsWith('uk-nc-2013:'))) score += 15;
  return score;
}

function pickSubjectsTopics(
  topics: Topic[],
  subject: string,
  age: number,
  limit: number,
): Topic[] {
  return topics
    .filter((t) => t.name && t.subject === subject && ageFits(t, age))
    .sort((a, b) => rankTopic(b) - rankTopic(a))
    .slice(0, limit);
}

/**
 * Deterministically map parent baseline answers to a small set of mastery seeds.
 * Conservative: prefer practicing/introduced over mastered.
 */
export function mapBaselineToMasterySeeds(input: {
  child: Child;
  answers: BaselineAnswers;
  topics: Topic[];
}): BaselineSeed[] {
  const { child, answers, topics } = input;
  const seeds: BaselineSeed[] = [];
  const used = new Set<string>();

  const addMany = (
    subject: string,
    level: SubjectConfidence,
    limit: number,
    note: string,
  ) => {
    const { status, confidence } = confidenceToStatus(level);
    for (const topic of pickSubjectsTopics(topics, subject, child.age, limit)) {
      if (used.has(topic.id)) continue;
      used.add(topic.id);
      seeds.push({
        topicId: topic.id,
        status,
        confidence,
        notes: note,
      });
    }
  };

  addMany(
    'Mathematics',
    answers.mathsConfidence,
    answers.mathsConfidence === 'tricky' || answers.mathsConfidence === 'unsure' ? 4 : 3,
    `Baseline: maths felt ${answers.mathsConfidence}`,
  );
  addMany(
    'English',
    answers.englishConfidence,
    answers.englishConfidence === 'tricky' || answers.englishConfidence === 'unsure' ? 4 : 3,
    `Baseline: English felt ${answers.englishConfidence}`,
  );

  for (const subject of answers.trickySubjects) {
    if (subject === 'Mathematics' || subject === 'English') continue;
    addMany(subject, 'tricky', 2, `Baseline: parent marked ${subject} as tricky`);
  }

  for (const subject of answers.enjoySubjects) {
    const extras = pickSubjectsTopics(topics, subject, child.age, 2);
    for (const topic of extras) {
      if (used.has(topic.id)) continue;
      used.add(topic.id);
      seeds.push({
        topicId: topic.id,
        status: 'introduced',
        confidence: 0.5,
        notes: `Baseline: enjoys ${subject}`,
      });
    }
  }

  return seeds;
}

export function buildBaselineSummary(child: Child, answers: BaselineAnswers): string {
  const maths = phraseConfidence('maths', answers.mathsConfidence);
  const english = phraseConfidence('English', answers.englishConfidence);
  const enjoy =
    answers.enjoySubjects.length > 0
      ? ` They enjoy ${joinList(answers.enjoySubjects)}.`
      : '';
  const tricky =
    answers.trickySubjects.length > 0
      ? ` We’ll tread gently with ${joinList(answers.trickySubjects)}.`
      : '';
  const reading =
    answers.readingSupport === 'independent'
      ? ' They’re fairly independent with reading instructions.'
      : answers.readingSupport === 'some_help'
        ? ' They may need a little help with reading instructions.'
        : ' Plan to read instructions aloud together.';

  return `${child.name} ${maths} ${english}${enjoy}${tricky}${reading} Aim for about ${answers.focusMinutes} minutes at a time.`;
}

function phraseConfidence(subject: string, level: SubjectConfidence): string {
  switch (level) {
    case 'strong':
      return `seems confident with ${subject}.`;
    case 'ok':
      return `is doing okay with ${subject}.`;
    case 'unsure':
      return `is still finding their feet with ${subject}.`;
    case 'tricky':
      return `may need gentle support with ${subject}.`;
  }
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function defaultBaselineAnswers(age: number): BaselineAnswers {
  return {
    enjoySubjects: [],
    trickySubjects: [],
    readingSupport: age <= 6 ? 'read_aloud' : 'some_help',
    focusMinutes: suggestedDurationMinutes(age),
    mathsConfidence: 'ok',
    englishConfidence: 'ok',
    otherNotes: '',
    wantDiagnosticWorksheet: false,
  };
}

export function buildInsightsSummary(
  childName: string,
  prefs: DesignPrefs,
  completedCount: number,
): string {
  const adopted = (Object.entries(prefs) as Array<[AbTestId, DesignArm | null | undefined]>)
    .filter(([, arm]) => arm === 'A' || arm === 'B')
    .map(([testId, arm]) => {
      const test = AB_TESTS[testId];
      const label = arm === 'A' ? test.armA.parentLabel : test.armB.parentLabel;
      return label;
    });

  if (adopted.length === 0) {
    return completedCount > 0
      ? `We’ve tried a few worksheet styles with ${childName}. Nothing stood out strongly yet — we’ll keep noticing what helps.`
      : `We’re just getting started learning what helps ${childName}. After a few worksheets, you’ll see notes here.`;
  }

  if (adopted.length === 1) {
    return `So far, ${childName} seems to do better with ${adopted[0]}.`;
  }

  return `What seems to help ${childName}: ${joinList(adopted)}.`;
}

export function proposeLesson(input: {
  child: Child;
  frontier: LearningPathFrontier | null;
  topicsById: Map<string, Topic>;
  prefs: DesignPrefs;
  activeExperiment: ReturnType<typeof startExperiment> | null;
  themeOverride?: string | null;
  durationOverride?: number | null;
  preferTopicId?: string | null;
  /** When true, consume/advance the experiment arm. Preview passes false. */
  commitArm?: boolean;
}): {
  proposal: LessonProposal;
  experimentAfterAssign: ReturnType<typeof startExperiment> | null;
  assignedArm: DesignArm | null;
} {
  const { child, frontier, topicsById, prefs } = input;
  const experiment = input.activeExperiment;
  const commitArm = input.commitArm ?? false;

  let topic: Topic | null = null;
  if (input.preferTopicId) {
    topic = topicsById.get(input.preferTopicId) ?? null;
  }
  if (!topic && frontier) {
    topic = topicsById.get(frontier.topicId) ?? null;
  }
  if (!topic) {
    // Fallback: any age-fit named topic
    for (const t of topicsById.values()) {
      if (t.name && ageFits(t, child.age)) {
        topic = t;
        break;
      }
    }
  }
  if (!topic) {
    throw new Error('No suitable topic found to propose a lesson.');
  }

  let assignedArm: DesignArm | null = null;
  let designVariant = null;
  let experimentNote: string | null = null;
  let experimentAfterAssign = experiment;

  if (experiment) {
    if (commitArm) {
      const assigned = assignArm(experiment);
      assignedArm = assigned.arm;
      experimentAfterAssign = assigned.experiment;
    } else {
      assignedArm = experiment.nextArm;
      experimentAfterAssign = experiment;
    }
    designVariant = armMeta(experiment.testId, assignedArm);
    const card = experimentCardCopy(experiment);
    experimentNote = card.body;
  }

  const theme =
    input.themeOverride?.trim() ||
    child.interests[0] ||
    'everyday adventures';

  const durationMinutes =
    input.durationOverride && input.durationOverride > 0
      ? input.durationOverride
      : suggestedDurationMinutes(child.age);

  const why = frontier
    ? `${child.name}’s next helpful step looks like “${topic.name}” in ${topic.subject}${
        topic.domain ? ` · ${topic.domain}` : ''
      }. We’ll practise it in a short, themed worksheet.`
    : `We’ll practise “${topic.name}” with ${child.name} in a short, themed worksheet.`;

  // Prefs are applied at prompt-build time; kept on the input for call-site clarity.
  void prefs;

  return {
    proposal: {
      childId: child.id,
      topicId: topic.id,
      topicName: topic.name,
      subject: topic.subject,
      domain: topic.domain ?? 'General',
      theme,
      durationMinutes,
      why,
      experimentNote,
      designVariant,
    },
    experimentAfterAssign,
    assignedArm,
  };
}

export function ensureActiveExperiment(
  prefs: DesignPrefs,
  completed: { testId: AbTestId }[],
  existing: ReturnType<typeof startExperiment> | null,
): ReturnType<typeof startExperiment> | null {
  if (existing) return existing;
  return pickNextExperiment(prefs, completed as never);
}

export function masteryFromSeeds(
  childId: string,
  seeds: BaselineSeed[],
  now: string,
): TopicMastery[] {
  return seeds.map((s) => ({
    childId,
    topicId: s.topicId,
    status: s.status,
    confidence: s.confidence,
    lastAssessedAt: now,
    notes: s.notes,
  }));
}

export { emptyDesignPrefs, startExperiment, pickNextExperiment };
