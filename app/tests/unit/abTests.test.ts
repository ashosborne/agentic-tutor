import { describe, expect, it } from 'vitest';
import {
  AB_TEST_ORDER,
  SESSIONS_PER_ARM,
  assignArm,
  buildDesignPromptSections,
  computeCompositeScore,
  decideExperiment,
  emptyDesignPrefs,
  pickNextExperiment,
  promptAppendixForVariant,
  recordArmUse,
  startExperiment,
  suggestedDurationMinutes,
} from '../../shared/abTests.js';

describe('abTests catalog', () => {
  it('defines five print-relevant tests in a stable order', () => {
    expect(AB_TEST_ORDER).toEqual([
      'goal_framing',
      'clutter',
      'format',
      'choice',
      'feedback_timing',
    ]);
  });

  it('builds a mandatory DESIGN VARIANT appendix per arm', () => {
    const a = promptAppendixForVariant('clutter', 'A');
    const b = promptAppendixForVariant('clutter', 'B');
    expect(a).toContain('DESIGN VARIANT');
    expect(a).toContain('arm A');
    expect(b).toContain('arm B');
    expect(b.toLowerCase()).toContain('goal-relevant');
  });

  it('includes child design defaults while skipping the active test', () => {
    const prefs = emptyDesignPrefs();
    prefs.clutter = 'B';
    prefs.choice = 'A';
    const sections = buildDesignPromptSections({
      active: { testId: 'goal_framing', arm: 'B' },
      prefs,
    });
    expect(sections).toContain('goal framing test, arm B');
    expect(sections).toContain('CHILD DESIGN DEFAULTS');
    expect(sections).toContain('Calm pages vs extra decoration');
    expect(sections).not.toMatch(/goal framing test.*CHILD DESIGN DEFAULTS[\s\S]*Clear goals/i);
  });
});

describe('experiment assignment', () => {
  it('alternates arms starting with A', () => {
    let exp = startExperiment('goal_framing', '2026-01-01T00:00:00.000Z');
    const first = assignArm(exp);
    expect(first.arm).toBe('A');
    exp = recordArmUse(first.experiment, first.arm);
    const second = assignArm(exp);
    expect(second.arm).toBe('B');
    exp = recordArmUse(second.experiment, second.arm);
    expect(exp.armACount).toBe(1);
    expect(exp.armBCount).toBe(1);
  });

  it('picks the first undecided test in order', () => {
    const prefs = emptyDesignPrefs();
    prefs.goal_framing = 'B';
    const next = pickNextExperiment(prefs, []);
    expect(next?.testId).toBe('clutter');
  });

  it('skips completed tests even without a stored pref', () => {
    const next = pickNextExperiment(emptyDesignPrefs(), [
      {
        testId: 'goal_framing',
        winner: null,
        reason: 'similar',
        completedAt: '2026-01-01T00:00:00.000Z',
        meanScoreA: 0.5,
        meanScoreB: 0.5,
      },
    ]);
    expect(next?.testId).toBe('clutter');
  });
});

describe('composite score', () => {
  it('scores a strong session highly', () => {
    const score = computeCompositeScore({
      learningScore: 0.95,
      completedCore: 'yes',
      timeMinutes: 7,
      age: 5,
      helpCount: 0,
      enjoyment: 5,
      parentEffort: 'easy',
    });
    expect(score).toBeGreaterThan(0.9);
  });

  it('penalises abandonment, high help, and hard parent effort', () => {
    const score = computeCompositeScore({
      learningScore: 0.4,
      completedCore: 'no',
      timeMinutes: 25,
      age: 5,
      helpCount: 3,
      enjoyment: 1,
      parentEffort: 'hard',
    });
    expect(score).toBeLessThan(0.35);
  });

  it('treats mostly-complete as mid completion', () => {
    const yes = computeCompositeScore({
      learningScore: 0.7,
      completedCore: 'yes',
      timeMinutes: 12,
      age: 8,
      helpCount: 1,
      enjoyment: 4,
      parentEffort: 'okay',
    });
    const mostly = computeCompositeScore({
      learningScore: 0.7,
      completedCore: 'mostly',
      timeMinutes: 12,
      age: 8,
      helpCount: 1,
      enjoyment: 4,
      parentEffort: 'okay',
    });
    expect(yes).toBeGreaterThan(mostly);
  });
});

describe('decideExperiment', () => {
  it('waits until each arm has enough sessions', () => {
    const exp = {
      ...startExperiment('format'),
      armACount: 1,
      armBCount: 2,
    };
    expect(decideExperiment(exp, [0.8], [0.5, 0.6])).toEqual({ ready: false });
  });

  it('adopts the higher-scoring arm when margin is met', () => {
    const exp = {
      ...startExperiment('format'),
      armACount: SESSIONS_PER_ARM,
      armBCount: SESSIONS_PER_ARM,
    };
    const decision = decideExperiment(exp, [0.4, 0.45], [0.8, 0.85]);
    expect(decision.ready).toBe(true);
    if (decision.ready) {
      expect(decision.winner).toBe('B');
      expect(decision.reason.toLowerCase()).toContain('shorter chunks');
    }
  });

  it('returns inconclusive when scores are close', () => {
    const exp = {
      ...startExperiment('choice'),
      armACount: SESSIONS_PER_ARM,
      armBCount: SESSIONS_PER_ARM,
    };
    const decision = decideExperiment(exp, [0.7, 0.72], [0.71, 0.73]);
    expect(decision.ready).toBe(true);
    if (decision.ready) {
      expect(decision.winner).toBeNull();
      expect(decision.reason.toLowerCase()).toContain('similar');
    }
  });
});

describe('suggestedDurationMinutes', () => {
  it('follows research age bands', () => {
    expect(suggestedDurationMinutes(5)).toBe(7);
    expect(suggestedDurationMinutes(8)).toBe(12);
    expect(suggestedDurationMinutes(11)).toBe(18);
  });
});
