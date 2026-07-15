import type {
  AbTestId,
  ActiveExperiment,
  CompletedExperiment,
  CompletionLevel,
  DesignArm,
  DesignPrefs,
  DesignVariantMeta,
  ParentEffort,
} from './types.js';

export const AB_TEST_ORDER: AbTestId[] = [
  'goal_framing',
  'clutter',
  'format',
  'choice',
  'feedback_timing',
];

/** Sessions required on each arm before a decision is attempted. */
export const SESSIONS_PER_ARM = 2;

/** Minimum mean composite-score gap to adopt a winner. */
export const DECISION_MARGIN = 0.08;

export interface AbTestDefinition {
  id: AbTestId;
  /** Short parent-facing title (no A/B jargon). */
  parentTitle: string;
  /** One-line hypothesis for parents. */
  parentHypothesis: string;
  armA: {
    shortLabel: string;
    parentLabel: string;
    promptAppendix: string;
  };
  armB: {
    shortLabel: string;
    parentLabel: string;
    promptAppendix: string;
  };
}

export const AB_TESTS: Record<AbTestId, AbTestDefinition> = {
  clutter: {
    id: 'clutter',
    parentTitle: 'Calm pages vs extra decoration',
    parentHypothesis:
      'We’re checking whether a calmer page helps more than a busier, decorative one.',
    armA: {
      shortLabel: 'Extra decoration',
      parentLabel: 'A busier page with more decorative details',
      promptAppendix: `DESIGN VARIANT (mandatory — clutter test, arm A):
- Include tasteful decorative illustrations and a few extra callout boxes for delight.
- Keep the learning correct, but allow non-essential decorative elements around the edges.
- Do not cover instructions or answer spaces with decoration.`,
    },
    armB: {
      shortLabel: 'Calm & relevant',
      parentLabel: 'A calmer page with only task-relevant pictures',
      promptAppendix: `DESIGN VARIANT (mandatory — clutter test, arm B):
- Use ONLY goal-relevant illustrations that teach, cue, or support the task.
- Remove decorative sidebars, mascots that do not teach, and extra callouts.
- Maximise white space and calm hierarchy; every visual must do instructional work.`,
    },
  },
  goal_framing: {
    id: 'goal_framing',
    parentTitle: 'Clear goals at the top',
    parentHypothesis:
      'We’re checking whether spelling out the learning goal and “I can…” lines helps.',
    armA: {
      shortLabel: 'Title only',
      parentLabel: 'Just a title at the top',
      promptAppendix: `DESIGN VARIANT (mandatory — goal framing test, arm A):
- Header shows a clear title only.
- Do NOT include a separate learning intention or child-facing success criteria (“I can…”).
- Keep instructions on each task itself.`,
    },
    armB: {
      shortLabel: 'Goals & “I can”',
      parentLabel: 'Title plus learning goal and “I can…” lines',
      promptAppendix: `DESIGN VARIANT (mandatory — goal framing test, arm B):
- Header MUST include: title, child-friendly learning intention, and 2–3 short “I can…” success criteria.
- Make the goal obvious in one glance before the first task.
- Keep the success criteria concrete and age-appropriate.`,
    },
  },
  feedback_timing: {
    id: 'feedback_timing',
    parentTitle: 'When to check answers',
    parentHypothesis:
      'We’re checking whether quick check cues early on help more than a check at the end.',
    armA: {
      shortLabel: 'Quick early checks',
      parentLabel: 'Quick check cues on the first items',
      promptAppendix: `DESIGN VARIANT (mandatory — feedback timing test, arm A):
- Give immediate, light self-check cues on the first 1–2 novice items (e.g. a tiny answer hint box or “check: …” under the item).
- Fade detailed checking after those early items.
- Keep tone competence-building, not graded.`,
    },
    armB: {
      shortLabel: 'Check at the end',
      parentLabel: 'A checkpoint or check box near the end',
      promptAppendix: `DESIGN VARIANT (mandatory — feedback timing test, arm B):
- Do NOT put answer-check cues under early items.
- Provide a single delayed checkpoint or self-check section near the end of the core tasks.
- Include a brief reflection or “check yourself” box there.`,
    },
  },
  choice: {
    id: 'choice',
    parentTitle: 'A little choice at the end',
    parentHypothesis:
      'We’re checking whether offering a choice of final task keeps them more engaged.',
    armA: {
      shortLabel: 'Fixed ending',
      parentLabel: 'One fixed final task',
      promptAppendix: `DESIGN VARIANT (mandatory — choice test, arm A):
- End with one clear final task (no “pick one of these” choice).
- Keep the ending satisfying but fixed for everyone.`,
    },
    armB: {
      shortLabel: 'Choose one',
      parentLabel: 'Choose one of two equal final tasks',
      promptAppendix: `DESIGN VARIANT (mandatory — choice test, arm B):
- Offer TWO final-task options that are genuinely equivalent in difficulty and learning goal.
- Label them as a tiny choice (“Pick one to finish”).
- Do not make one option feel like the “harder prize”.`,
    },
  },
  format: {
    id: 'format',
    parentTitle: 'One busy page vs shorter chunks',
    parentHypothesis:
      'We’re checking whether shorter chunks across pages feel easier than one dense sheet.',
    armA: {
      shortLabel: 'One dense page',
      parentLabel: 'Mostly one denser page',
      promptAppendix: `DESIGN VARIANT (mandatory — format test, arm A):
- Prefer a single denser A4 page that holds the core tasks together.
- Keep hierarchy clear, but do not split into multiple short cards/pages unless content truly overflows.`,
    },
    armB: {
      shortLabel: 'Shorter chunks',
      parentLabel: 'Shorter chunks across pages or cards',
      promptAppendix: `DESIGN VARIANT (mandatory — format test, arm B):
- Split the same learning into shorter chunks across two pages or card-like sections.
- One clear micro-goal per chunk; generous spacing; avoid packing the first page.
- Preserve a calm reading order across pages.`,
    },
  },
};

export function getAbTest(testId: AbTestId): AbTestDefinition {
  return AB_TESTS[testId];
}

export function armMeta(testId: AbTestId, arm: DesignArm): DesignVariantMeta {
  const test = getAbTest(testId);
  const side = arm === 'A' ? test.armA : test.armB;
  return {
    testId,
    arm,
    label: side.shortLabel,
  };
}

export function parentArmLabel(testId: AbTestId, arm: DesignArm): string {
  const test = getAbTest(testId);
  return arm === 'A' ? test.armA.parentLabel : test.armB.parentLabel;
}

export function promptAppendixForVariant(
  testId: AbTestId,
  arm: DesignArm,
): string {
  const test = getAbTest(testId);
  return arm === 'A' ? test.armA.promptAppendix : test.armB.promptAppendix;
}

export function promptAppendixForPrefs(prefs: DesignPrefs, skipTestId?: AbTestId | null): string {
  const lines: string[] = [];
  for (const testId of AB_TEST_ORDER) {
    if (skipTestId && testId === skipTestId) continue;
    const arm = prefs[testId];
    if (arm !== 'A' && arm !== 'B') continue;
    const label = parentArmLabel(testId, arm);
    lines.push(`- ${getAbTest(testId).parentTitle}: prefer “${label}”.`);
  }
  if (lines.length === 0) return '';
  return `CHILD DESIGN DEFAULTS (apply these unless they conflict with DESIGN VARIANT above):
${lines.join('\n')}`;
}

export function buildDesignPromptSections(input: {
  active?: { testId: AbTestId; arm: DesignArm } | null;
  prefs?: DesignPrefs;
}): string {
  const parts: string[] = [];
  if (input.active) {
    parts.push(promptAppendixForVariant(input.active.testId, input.active.arm));
  }
  const defaults = promptAppendixForPrefs(input.prefs ?? {}, input.active?.testId);
  if (defaults) parts.push(defaults);
  return parts.join('\n\n');
}

export function emptyDesignPrefs(): DesignPrefs {
  return {
    clutter: null,
    goal_framing: null,
    feedback_timing: null,
    choice: null,
    format: null,
  };
}

export function startExperiment(
  testId: AbTestId,
  startedAt = new Date().toISOString(),
): ActiveExperiment {
  return {
    testId,
    nextArm: 'A',
    armACount: 0,
    armBCount: 0,
    startedAt,
  };
}

export function pickNextExperiment(
  prefs: DesignPrefs,
  completed: CompletedExperiment[],
  startedAt = new Date().toISOString(),
): ActiveExperiment | null {
  const done = new Set(completed.map((c) => c.testId));
  for (const testId of AB_TEST_ORDER) {
    if (done.has(testId)) continue;
    if (prefs[testId] === 'A' || prefs[testId] === 'B') continue;
    return startExperiment(testId, startedAt);
  }
  return null;
}

/** Assign the next arm and return the arm used for this session. */
export function assignArm(experiment: ActiveExperiment): {
  arm: DesignArm;
  experiment: ActiveExperiment;
} {
  const arm = experiment.nextArm;
  return {
    arm,
    experiment: {
      ...experiment,
      nextArm: arm === 'A' ? 'B' : 'A',
    },
  };
}

export function recordArmUse(
  experiment: ActiveExperiment,
  arm: DesignArm,
): ActiveExperiment {
  return {
    ...experiment,
    armACount: experiment.armACount + (arm === 'A' ? 1 : 0),
    armBCount: experiment.armBCount + (arm === 'B' ? 1 : 0),
  };
}

export interface SessionScoreInput {
  learningScore: number;
  completedCore: CompletionLevel;
  timeMinutes: number;
  age: number;
  helpCount: number;
  enjoyment: number;
  parentEffort: ParentEffort;
}

export function ageBandTargetMinutes(age: number): { min: number; max: number; ideal: number } {
  if (age <= 6) return { min: 5, max: 8, ideal: 7 };
  if (age <= 9) return { min: 10, max: 15, ideal: 12 };
  return { min: 15, max: 20, ideal: 18 };
}

export function suggestedDurationMinutes(age: number): number {
  return ageBandTargetMinutes(age).ideal;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function completionScore(level: CompletionLevel): number {
  if (level === 'yes') return 1;
  if (level === 'mostly') return 0.65;
  return 0.15;
}

function timeFitScore(timeMinutes: number, age: number): number {
  const { min, max } = ageBandTargetMinutes(age);
  if (timeMinutes <= 0) return 0.4;
  if (timeMinutes >= min && timeMinutes <= max) return 1;
  if (timeMinutes < min) {
    const early = min - timeMinutes;
    return clamp01(1 - early / min);
  }
  const over = timeMinutes - max;
  return clamp01(1 - over / max);
}

function parentEaseScore(effort: ParentEffort): number {
  if (effort === 'easy') return 1;
  if (effort === 'okay') return 0.6;
  return 0.2;
}

/**
 * Composite outcome score (0–1) aligned to research metrics:
 * learning, completion, time fit, low help, enjoyment, parent ease.
 */
export function computeCompositeScore(input: SessionScoreInput): number {
  const learning = clamp01(input.learningScore);
  const completion = completionScore(input.completedCore);
  const timeFit = timeFitScore(input.timeMinutes, input.age);
  const lowHelp = 1 - Math.min(Math.max(input.helpCount, 0), 3) / 3;
  const enjoyment = clamp01(input.enjoyment / 5);
  const parentEase = parentEaseScore(input.parentEffort);

  return clamp01(
    0.35 * learning +
      0.2 * completion +
      0.15 * timeFit +
      0.15 * lowHelp +
      0.1 * enjoyment +
      0.05 * parentEase,
  );
}

export function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

export type DecisionResult =
  | { ready: false }
  | {
      ready: true;
      winner: DesignArm | null;
      reason: string;
      meanScoreA: number;
      meanScoreB: number;
    };

export function decideExperiment(
  experiment: ActiveExperiment,
  scoresA: number[],
  scoresB: number[],
): DecisionResult {
  if (
    experiment.armACount < SESSIONS_PER_ARM ||
    experiment.armBCount < SESSIONS_PER_ARM ||
    scoresA.length < SESSIONS_PER_ARM ||
    scoresB.length < SESSIONS_PER_ARM
  ) {
    return { ready: false };
  }

  const meanScoreA = mean(scoresA);
  const meanScoreB = mean(scoresB);
  const gap = meanScoreB - meanScoreA;

  if (Math.abs(gap) < DECISION_MARGIN) {
    return {
      ready: true,
      winner: null,
      reason: 'Both styles felt similar — we’ll keep things flexible for now.',
      meanScoreA,
      meanScoreB,
    };
  }

  if (gap > 0) {
    return {
      ready: true,
      winner: 'B',
      reason: `“${parentArmLabel(experiment.testId, 'B')}” looked more helpful.`,
      meanScoreA,
      meanScoreB,
    };
  }

  return {
    ready: true,
    winner: 'A',
    reason: `“${parentArmLabel(experiment.testId, 'A')}” looked more helpful.`,
    meanScoreA,
    meanScoreB,
  };
}

export function experimentProgressLabel(experiment: ActiveExperiment): string {
  const test = getAbTest(experiment.testId);
  return `${test.parentTitle} — ${experiment.armACount} of ${SESSIONS_PER_ARM} / ${experiment.armBCount} of ${SESSIONS_PER_ARM}`;
}

export function experimentCardCopy(experiment: ActiveExperiment): {
  title: string;
  body: string;
  progressLabel: string;
} {
  const test = getAbTest(experiment.testId);
  return {
    title: `What we’re trying: ${test.parentTitle}`,
    body: test.parentHypothesis,
    progressLabel: experimentProgressLabel(experiment),
  };
}
