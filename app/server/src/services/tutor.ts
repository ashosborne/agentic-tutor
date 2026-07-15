import { nanoid } from 'nanoid';
import {
  AB_TESTS,
  emptyDesignPrefs,
  experimentCardCopy,
  computeCompositeScore,
  decideExperiment,
  parentArmLabel,
  pickNextExperiment,
  recordArmUse,
  startExperiment,
  suggestedDurationMinutes,
} from '../../../shared/abTests.js';
import {
  buildBaselineSummary,
  buildInsightsSummary,
  mapBaselineToMasterySeeds,
  masteryFromSeeds,
  proposeLesson,
} from '../../../shared/tutorLogic.js';
import type {
  AbTestId,
  BaselineAnswers,
  DesignArm,
  DesignPrefs,
  DesignVariantMeta,
  GeneratedWorksheetMeta,
  LessonProposal,
  SessionReport,
  TutorDashboard,
  TutorInsightView,
  TutorProfile,
  Worksheet,
} from '../../../shared/types.js';
import {
  getAssessmentForWorksheet,
  getChild,
  getSessionReportForWorksheet,
  getTutorProfile,
  getWorksheet,
  insertSessionReport,
  listSessionReportsForExperiment,
  upsertMastery,
  upsertTutorProfile,
} from '../db/repository.js';
import { buildLearningPathForChild } from './learningPath.js';
import { loadTaxonomy } from './taxonomy.js';
import { createWorksheet } from './worksheets.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function ensureTutorProfile(childId: string): TutorProfile {
  const existing = getTutorProfile(childId);
  if (existing) return existing;

  const child = getChild(childId);
  if (!child) throw new Error('Child not found');

  const profile: TutorProfile = {
    childId,
    status: 'needs_baseline',
    baselineSummary: null,
    insightsSummary: buildInsightsSummary(child.name, emptyDesignPrefs(), 0),
    designPrefs: emptyDesignPrefs(),
    activeExperiment: null,
    completedExperiments: [],
    baselineAnswers: null,
    updatedAt: nowIso(),
  };
  return upsertTutorProfile(profile);
}

export function getTutorDashboard(childId: string): TutorDashboard {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');

  const profile = ensureTutorProfile(childId);
  if (profile.status === 'needs_baseline') {
    return {
      profile,
      proposal: null,
      experimentCard: null,
      nextStep: 'baseline',
    };
  }
  if (profile.status === 'paused') {
    return {
      profile,
      proposal: null,
      experimentCard: profile.activeExperiment
        ? experimentCardCopy(profile.activeExperiment)
        : null,
      nextStep: 'paused',
    };
  }

  const proposal = buildProposal(childId, {}, false).proposal;
  return {
    profile,
    proposal,
    experimentCard: profile.activeExperiment
      ? experimentCardCopy(profile.activeExperiment)
      : null,
    nextStep: 'lesson',
  };
}

export async function submitBaseline(
  childId: string,
  answers: BaselineAnswers,
): Promise<{
  profile: TutorProfile;
  diagnosticSuggested: boolean;
  diagnosticWorksheet: Worksheet | null;
}> {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');

  const taxonomy = loadTaxonomy();
  const seeds = mapBaselineToMasterySeeds({
    child,
    answers,
    topics: taxonomy.topics,
  });
  const stamped = masteryFromSeeds(childId, seeds, nowIso());
  for (const row of stamped) {
    upsertMastery(row);
  }

  const prefs = emptyDesignPrefs();
  const experiment = startExperiment('goal_framing');
  const baselineSummary = buildBaselineSummary(child, answers);
  const profile: TutorProfile = {
    childId,
    status: 'active',
    baselineSummary,
    insightsSummary: buildInsightsSummary(child.name, prefs, 0),
    designPrefs: prefs,
    activeExperiment: experiment,
    completedExperiments: [],
    baselineAnswers: answers,
    updatedAt: nowIso(),
  };
  upsertTutorProfile(profile);

  let diagnosticWorksheet: Worksheet | null = null;
  if (answers.wantDiagnosticWorksheet) {
    // Check-in sheet for capability sampling — does not consume an A/B arm.
    const path = buildLearningPathForChild(child);
    const theme = child.interests[0] || 'everyday adventures';
    diagnosticWorksheet = await createWorksheet({
      childId,
      theme,
      durationMinutes: answers.focusMinutes || suggestedDurationMinutes(child.age),
      subjectFocus: path.frontier?.subject ?? null,
      domainFocus: path.frontier?.domain ?? null,
      preferTopicId: path.frontier?.topicId ?? null,
    });
  }

  return {
    profile,
    diagnosticSuggested: Boolean(answers.wantDiagnosticWorksheet),
    diagnosticWorksheet,
  };
}

function buildProposal(
  childId: string,
  overrides: {
    theme?: string | null;
    durationMinutes?: number | null;
    preferTopicId?: string | null;
  },
  commitArm: boolean,
): {
  proposal: LessonProposal;
  profile: TutorProfile;
  experimentAfterAssign: TutorProfile['activeExperiment'];
} {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  let profile = ensureTutorProfile(childId);
  if (profile.status === 'needs_baseline') {
    throw new Error('Please finish getting to know this child first.');
  }

  if (!profile.activeExperiment) {
    const next = pickNextExperiment(
      profile.designPrefs,
      profile.completedExperiments,
    );
    if (next) {
      profile = upsertTutorProfile({
        ...profile,
        activeExperiment: next,
        updatedAt: nowIso(),
      });
    }
  }

  const taxonomy = loadTaxonomy();
  const path = buildLearningPathForChild(child);
  const { proposal, experimentAfterAssign } = proposeLesson({
    child,
    frontier: path.frontier,
    topicsById: taxonomy.topicsById,
    prefs: profile.designPrefs,
    activeExperiment: profile.activeExperiment,
    themeOverride: overrides.theme,
    durationOverride: overrides.durationMinutes,
    preferTopicId: overrides.preferTopicId,
    commitArm,
  });

  return { proposal, profile, experimentAfterAssign };
}

export function proposeTutorLesson(
  childId: string,
  overrides: {
    theme?: string | null;
    durationMinutes?: number | null;
    preferTopicId?: string | null;
  } = {},
): LessonProposal {
  return buildProposal(childId, overrides, false).proposal;
}

export async function createTutorWorksheet(
  childId: string,
  overrides: {
    theme?: string | null;
    durationMinutes?: number | null;
    preferTopicId?: string | null;
  } = {},
): Promise<{ worksheet: Worksheet; proposal: LessonProposal }> {
  const { proposal, profile, experimentAfterAssign } = buildProposal(
    childId,
    overrides,
    true,
  );

  const worksheet = await createWorksheet({
    childId,
    theme: proposal.theme,
    durationMinutes: proposal.durationMinutes,
    subjectFocus: proposal.subject,
    domainFocus: proposal.domain,
    preferTopicId: proposal.topicId,
    designVariant: proposal.designVariant,
    designPrefs: profile.designPrefs,
  });

  // Persist the post-assign nextArm only after a successful generate so
  // failed generations do not burn an experiment slot. Arm counts still
  // increment only when a session report arrives.
  if (experimentAfterAssign) {
    upsertTutorProfile({
      ...profile,
      activeExperiment: experimentAfterAssign,
      updatedAt: nowIso(),
    });
  }

  return { worksheet, proposal };
}

export interface SubmitSessionReportInput {
  worksheetId: string;
  completedCore: SessionReport['completedCore'];
  timeMinutes: number;
  helpCount: number;
  enjoyment: number;
  parentEffort: SessionReport['parentEffort'];
  errorNotes?: string | null;
}

export function submitSessionReport(
  childId: string,
  input: SubmitSessionReportInput,
): {
  report: SessionReport;
  profile: TutorProfile;
  decisionNote: string | null;
} {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');

  const worksheet = getWorksheet(input.worksheetId);
  if (!worksheet || worksheet.childId !== childId) {
    throw new Error('Worksheet not found');
  }

  const existing = getSessionReportForWorksheet(worksheet.id);
  if (existing) {
    throw new Error('A how-it-went report already exists for this worksheet.');
  }

  const assessment = getAssessmentForWorksheet(worksheet.id);
  const learningScore =
    assessment && assessment.results.length > 0
      ? assessment.results.reduce((sum, r) => sum + r.score, 0) /
        assessment.results.length
      : 0.5;

  const meta = parseWorksheetMeta(worksheet.contentJson);
  const testId = meta.designVariant?.testId ?? null;
  const arm = meta.designVariant?.arm ?? null;

  const compositeScore = computeCompositeScore({
    learningScore,
    completedCore: input.completedCore,
    timeMinutes: input.timeMinutes,
    age: child.age,
    helpCount: input.helpCount,
    enjoyment: input.enjoyment,
    parentEffort: input.parentEffort,
  });

  const report: SessionReport = {
    id: nanoid(),
    childId,
    worksheetId: worksheet.id,
    assessmentId: assessment?.id ?? null,
    testId,
    arm,
    completedCore: input.completedCore,
    timeMinutes: input.timeMinutes,
    helpCount: input.helpCount,
    enjoyment: input.enjoyment,
    parentEffort: input.parentEffort,
    errorNotes: input.errorNotes?.trim() || null,
    learningScore,
    compositeScore,
    createdAt: nowIso(),
  };
  insertSessionReport(report);

  let profile = ensureTutorProfile(childId);
  let decisionNote: string | null = null;

  if (testId && arm && profile.activeExperiment?.testId === testId) {
    const updatedExperiment = recordArmUse(profile.activeExperiment, arm);
    const reports = listSessionReportsForExperiment(childId, testId);
    const scoresA = reports
      .filter((r) => r.arm === 'A')
      .map((r) => r.compositeScore);
    const scoresB = reports
      .filter((r) => r.arm === 'B')
      .map((r) => r.compositeScore);

    const decision = decideExperiment(updatedExperiment, scoresA, scoresB);
    if (decision.ready) {
      const prefs: DesignPrefs = {
        ...profile.designPrefs,
        [testId]: decision.winner,
      };
      const completed = [
        ...profile.completedExperiments,
        {
          testId,
          winner: decision.winner,
          reason: decision.reason,
          completedAt: nowIso(),
          meanScoreA: decision.meanScoreA,
          meanScoreB: decision.meanScoreB,
        },
      ];
      const next = pickNextExperiment(prefs, completed);
      decisionNote = decision.reason;
      profile = upsertTutorProfile({
        ...profile,
        designPrefs: prefs,
        completedExperiments: completed,
        activeExperiment: next,
        insightsSummary: buildInsightsSummary(
          child.name,
          prefs,
          completed.length,
        ),
        updatedAt: nowIso(),
      });
    } else {
      profile = upsertTutorProfile({
        ...profile,
        activeExperiment: updatedExperiment,
        updatedAt: nowIso(),
      });
    }
  }

  return { report, profile, decisionNote };
}

export function getTutorInsights(childId: string): TutorInsightView {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const profile = ensureTutorProfile(childId);

  const adopted = (
    Object.entries(profile.designPrefs) as Array<[AbTestId, DesignArm | null | undefined]>
  )
    .filter(([, arm]) => arm === 'A' || arm === 'B')
    .map(([testId, arm]) => {
      const test = AB_TESTS[testId];
      return {
        testId,
        arm: arm as DesignArm,
        label: test.parentTitle,
        detail: parentArmLabel(testId, arm as DesignArm),
      };
    });

  return {
    adopted,
    inProgress: profile.activeExperiment
      ? {
          testId: profile.activeExperiment.testId,
          ...experimentCardCopy(profile.activeExperiment),
        }
      : null,
    summary:
      profile.insightsSummary ??
      buildInsightsSummary(child.name, profile.designPrefs, profile.completedExperiments.length),
    completed: profile.completedExperiments,
  };
}

export function overrideDesignPref(
  childId: string,
  testId: AbTestId,
  arm: DesignArm,
): TutorProfile {
  const child = getChild(childId);
  if (!child) throw new Error('Child not found');
  const profile = ensureTutorProfile(childId);

  const prefs: DesignPrefs = { ...profile.designPrefs, [testId]: arm };
  let active = profile.activeExperiment;
  let completed = [...profile.completedExperiments];

  if (active?.testId === testId) {
    completed = [
      ...completed.filter((c) => c.testId !== testId),
      {
        testId,
        winner: arm,
        reason: `You chose “${parentArmLabel(testId, arm)}” for ${child.name}.`,
        completedAt: nowIso(),
        meanScoreA: 0,
        meanScoreB: 0,
      },
    ];
    active = pickNextExperiment(prefs, completed);
  } else if (!completed.some((c) => c.testId === testId)) {
    completed.push({
      testId,
      winner: arm,
      reason: `You chose “${parentArmLabel(testId, arm)}” for ${child.name}.`,
      completedAt: nowIso(),
      meanScoreA: 0,
      meanScoreB: 0,
    });
  } else {
    completed = completed.map((c) =>
      c.testId === testId
        ? {
            ...c,
            winner: arm,
            reason: `You chose “${parentArmLabel(testId, arm)}” for ${child.name}.`,
            completedAt: nowIso(),
          }
        : c,
    );
  }

  return upsertTutorProfile({
    ...profile,
    status: profile.status === 'needs_baseline' ? profile.status : 'active',
    designPrefs: prefs,
    activeExperiment: active,
    completedExperiments: completed,
    insightsSummary: buildInsightsSummary(child.name, prefs, completed.length),
    updatedAt: nowIso(),
  });
}

function parseWorksheetMeta(contentJson: string): GeneratedWorksheetMeta {
  try {
    return JSON.parse(contentJson) as GeneratedWorksheetMeta;
  } catch {
    return { title: '', theme: '' };
  }
}

export type { DesignVariantMeta };
