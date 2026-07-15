import { describe, expect, it } from 'vitest';
import type { Child, Topic } from '../../shared/types.js';
import {
  buildBaselineSummary,
  buildInsightsSummary,
  defaultBaselineAnswers,
  mapBaselineToMasterySeeds,
  proposeLesson,
} from '../../shared/tutorLogic.js';
import { emptyDesignPrefs, startExperiment } from '../../shared/abTests.js';

const child: Child = {
  id: 'child_maya',
  name: 'Maya',
  dateOfBirth: '2021-03-15',
  age: 5,
  yearGroup: 'Reception',
  interests: ['unicorns', 'sea life'],
  avatarColor: '#2a6f7a',
  createdAt: '',
  updatedAt: '',
};

function topic(partial: Partial<Topic> & Pick<Topic, 'id' | 'subject' | 'name'>): Topic {
  return {
    type: 'CONCEPTUAL',
    domain: 'General',
    description: 'desc',
    ageRangeStart: 5,
    ageRangeEnd: 7,
    centrality: 0.2,
    evidence: [],
    assessmentPrompt: null,
    standards: ['uk-nc-2013:x'],
    ...partial,
  };
}

const topics: Topic[] = [
  topic({ id: 'm1', subject: 'Mathematics', name: 'Counting', centrality: 0.9, domain: 'Number' }),
  topic({ id: 'm2', subject: 'Mathematics', name: 'Adding', centrality: 0.8, domain: 'Number' }),
  topic({ id: 'm3', subject: 'Mathematics', name: 'Shapes', centrality: 0.5, domain: 'Geometry' }),
  topic({ id: 'm4', subject: 'Mathematics', name: 'Patterns', centrality: 0.4, domain: 'Number' }),
  topic({ id: 'e1', subject: 'English', name: 'Letters', centrality: 0.85, domain: 'Phonics' }),
  topic({ id: 'e2', subject: 'English', name: 'Sentences', centrality: 0.7, domain: 'Writing' }),
  topic({ id: 'e3', subject: 'English', name: 'Stories', centrality: 0.6, domain: 'Reading' }),
  topic({
    id: 's1',
    subject: 'Science',
    name: 'Plants',
    centrality: 0.5,
    domain: 'Living things',
  }),
];

describe('mapBaselineToMasterySeeds', () => {
  it('seeds maths and English from confidence answers', () => {
    const seeds = mapBaselineToMasterySeeds({
      child,
      answers: {
        ...defaultBaselineAnswers(5),
        mathsConfidence: 'tricky',
        englishConfidence: 'strong',
        enjoySubjects: ['Science'],
        trickySubjects: ['Science'],
      },
      topics,
    });

    expect(seeds.length).toBeGreaterThanOrEqual(6);
    const maths = seeds.filter((s) => topics.find((t) => t.id === s.topicId)?.subject === 'Mathematics');
    expect(maths.some((s) => s.status === 'needs_refresh')).toBe(true);
    const english = seeds.filter((s) => topics.find((t) => t.id === s.topicId)?.subject === 'English');
    expect(english.every((s) => s.status === 'practicing')).toBe(true);
    expect(seeds.some((s) => s.topicId === 's1')).toBe(true);
  });
});

describe('buildBaselineSummary', () => {
  it('writes plain English for parents', () => {
    const summary = buildBaselineSummary(child, {
      ...defaultBaselineAnswers(5),
      mathsConfidence: 'strong',
      englishConfidence: 'tricky',
      enjoySubjects: ['Science'],
      trickySubjects: ['English'],
      readingSupport: 'read_aloud',
      focusMinutes: 8,
    });
    expect(summary).toContain('Maya');
    expect(summary).toContain('maths');
    expect(summary).toContain('English');
    expect(summary.toLowerCase()).toContain('read instructions aloud');
    expect(summary).not.toMatch(/A\/B|LLM|variant/i);
  });
});

describe('proposeLesson', () => {
  it('uses frontier topic, interests theme, and assigns experiment arm', () => {
    const topicsById = new Map(topics.map((t) => [t.id, t]));
    const preview = proposeLesson({
      child,
      frontier: {
        subject: 'Mathematics',
        domain: 'Number',
        topicId: 'm2',
        topicName: 'Adding',
      },
      topicsById,
      prefs: emptyDesignPrefs(),
      activeExperiment: startExperiment('goal_framing'),
      commitArm: false,
    });

    expect(preview.proposal.topicId).toBe('m2');
    expect(preview.proposal.theme).toBe('unicorns');
    expect(preview.proposal.durationMinutes).toBe(7);
    expect(preview.proposal.why).toContain('Adding');
    expect(preview.assignedArm).toBe('A');
    expect(preview.proposal.designVariant?.arm).toBe('A');
    expect(preview.experimentAfterAssign?.nextArm).toBe('A');

    const committed = proposeLesson({
      child,
      frontier: {
        subject: 'Mathematics',
        domain: 'Number',
        topicId: 'm2',
        topicName: 'Adding',
      },
      topicsById,
      prefs: emptyDesignPrefs(),
      activeExperiment: startExperiment('goal_framing'),
      commitArm: true,
    });
    expect(committed.assignedArm).toBe('A');
    expect(committed.experimentAfterAssign?.nextArm).toBe('B');
  });
});

describe('buildInsightsSummary', () => {
  it('describes adopted styles without jargon', () => {
    const prefs = emptyDesignPrefs();
    prefs.goal_framing = 'B';
    const summary = buildInsightsSummary('Leo', prefs, 1);
    expect(summary).toContain('Leo');
    expect(summary.toLowerCase()).toContain('learning goal');
    expect(summary).not.toMatch(/A\/B|arm B|variant/i);
  });
});
