export type TopicType =
  | 'CONCEPTUAL'
  | 'PROCEDURAL'
  | 'REPRESENTATIONAL'
  | 'LANGUAGE'
  | 'META';

export type MasteryStatus =
  | 'not_started'
  | 'introduced'
  | 'practicing'
  | 'mastered'
  | 'needs_refresh';

export type WorksheetStatus =
  | 'draft'
  | 'ready'
  | 'printed'
  | 'submitted'
  | 'assessed';

export type AssessmentRecommendation = 'advance' | 'practice' | 'refresh';

export type DependencyStrength = 'hard' | 'soft';

export interface Topic {
  id: string;
  type: TopicType;
  subject: string;
  domain: string | null;
  name: string | null;
  description: string;
  ageRangeStart: number | null;
  ageRangeEnd: number | null;
  centrality: number | null;
  evidence: string[];
  assessmentPrompt: string | null;
  standards: string[];
}

export interface Dependency {
  topicId: string;
  prerequisiteId: string;
  strength: DependencyStrength;
  reason: string;
}

export interface Cluster {
  subject: string;
  domain: string;
  ageRangeStart: number;
  summary: string;
}

export interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  /** Derived from dateOfBirth at read time. */
  age: number;
  /** Derived England/Wales year group from dateOfBirth. */
  yearGroup: string | null;
  interests: string[];
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicMastery {
  childId: string;
  topicId: string;
  status: MasteryStatus;
  confidence: number;
  lastAssessedAt: string | null;
  notes: string | null;
}

export interface Worksheet {
  id: string;
  childId: string;
  theme: string;
  durationMinutes: number;
  subjectFocus: string | null;
  domainFocus: string | null;
  topicIds: string[];
  title: string;
  pdfPath: string | null;
  contentJson: string;
  status: WorksheetStatus;
  createdAt: string;
}

export interface AssessmentResult {
  topicId: string;
  score: number;
  evidence: string[];
  recommendation: AssessmentRecommendation;
}

export interface Assessment {
  id: string;
  worksheetId: string;
  childId: string;
  scanPath: string;
  results: AssessmentResult[];
  summary: string;
  createdAt: string;
}

/** Lightweight metadata stored in worksheet.contentJson after image generation. */
export interface GeneratedWorksheetMeta {
  title: string;
  theme: string;
  designVariant?: DesignVariantMeta | null;
}

export interface DesignVariantMeta {
  testId: AbTestId;
  arm: DesignArm;
  label: string;
}

export interface DurationOption {
  minutes: number;
  topicCount: number;
  label: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { minutes: 15, topicCount: 1, label: '15 minutes' },
  { minutes: 20, topicCount: 2, label: '20 minutes' },
  { minutes: 30, topicCount: 3, label: '30 minutes' },
  { minutes: 45, topicCount: 4, label: '45 minutes' },
];

/** Guided tutor duration chips — age-calibrated research defaults first. */
export const TUTOR_DURATION_OPTIONS: DurationOption[] = [
  { minutes: 8, topicCount: 1, label: 'About 8 minutes' },
  { minutes: 12, topicCount: 1, label: 'About 12 minutes' },
  { minutes: 15, topicCount: 1, label: '15 minutes' },
  { minutes: 20, topicCount: 2, label: '20 minutes' },
  { minutes: 30, topicCount: 3, label: '30 minutes' },
];

/** Print-relevant A/B tests from docs/deep-research-report.md. */
export type AbTestId =
  | 'clutter'
  | 'goal_framing'
  | 'feedback_timing'
  | 'choice'
  | 'format';

export type DesignArm = 'A' | 'B';

export type TutorProfileStatus = 'needs_baseline' | 'active' | 'paused';

export type ParentEffort = 'easy' | 'okay' | 'hard';

export type CompletionLevel = 'yes' | 'mostly' | 'no';

export type ReadingSupport = 'independent' | 'some_help' | 'read_aloud';

export type SubjectConfidence = 'strong' | 'ok' | 'unsure' | 'tricky';

export type DesignPrefs = Partial<Record<AbTestId, DesignArm | null>>;

export interface ActiveExperiment {
  testId: AbTestId;
  /** Arm to assign on the next worksheet. */
  nextArm: DesignArm;
  armACount: number;
  armBCount: number;
  startedAt: string;
}

export interface CompletedExperiment {
  testId: AbTestId;
  winner: DesignArm | null;
  reason: string;
  completedAt: string;
  meanScoreA: number;
  meanScoreB: number;
}

export interface BaselineAnswers {
  enjoySubjects: string[];
  trickySubjects: string[];
  readingSupport: ReadingSupport;
  focusMinutes: number;
  mathsConfidence: SubjectConfidence;
  englishConfidence: SubjectConfidence;
  otherNotes?: string;
  wantDiagnosticWorksheet?: boolean;
}

export interface TutorProfile {
  childId: string;
  status: TutorProfileStatus;
  baselineSummary: string | null;
  insightsSummary: string | null;
  designPrefs: DesignPrefs;
  activeExperiment: ActiveExperiment | null;
  completedExperiments: CompletedExperiment[];
  baselineAnswers: BaselineAnswers | null;
  updatedAt: string;
}

export interface SessionReport {
  id: string;
  childId: string;
  worksheetId: string;
  assessmentId: string | null;
  testId: AbTestId | null;
  arm: DesignArm | null;
  completedCore: CompletionLevel;
  timeMinutes: number;
  helpCount: number;
  enjoyment: number;
  parentEffort: ParentEffort;
  errorNotes: string | null;
  learningScore: number;
  compositeScore: number;
  createdAt: string;
}

export interface LessonProposal {
  childId: string;
  topicId: string;
  topicName: string | null;
  subject: string;
  domain: string;
  theme: string;
  durationMinutes: number;
  why: string;
  experimentNote: string | null;
  designVariant: DesignVariantMeta | null;
}

export interface TutorDashboard {
  profile: TutorProfile;
  proposal: LessonProposal | null;
  experimentCard: {
    title: string;
    body: string;
    progressLabel: string;
  } | null;
  nextStep: 'baseline' | 'lesson' | 'paused';
}

export interface TutorInsightView {
  adopted: Array<{ testId: AbTestId; arm: DesignArm; label: string; detail: string }>;
  inProgress: {
    testId: AbTestId;
    title: string;
    body: string;
    progressLabel: string;
  } | null;
  summary: string;
  completed: CompletedExperiment[];
}

export type RagLevel = 'red' | 'amber' | 'green';

export interface RagCounts {
  red: number;
  amber: number;
  green: number;
}

export interface ProgressSummary {
  childId: string;
  totalTracked: number;
  mastered: number;
  practicing: number;
  needsRefresh: number;
  introduced: number;
  ragCounts: RagCounts;
  bySubject: Record<
    string,
    {
      mastered: number;
      practicing: number;
      needsRefresh: number;
      introduced: number;
      total: number;
    }
  >;
  story: string;
  suggestedTheme: string | null;
  frontier: LearningPathFrontier | null;
}

export interface LearningPathTopic {
  id: string;
  name: string | null;
  description: string;
  evidence: string[];
  rag: RagLevel;
  status: MasteryStatus;
  centrality: number | null;
  subject: string;
  domain: string;
}

export interface LearningPathEdge {
  from: string;
  to: string;
}

export interface LearningPathDomain {
  domain: string;
  summary: string | null;
  topics: LearningPathTopic[];
  edges: LearningPathEdge[];
}

export interface LearningPathSubject {
  subject: string;
  domains: LearningPathDomain[];
  ragCounts: RagCounts;
}

export interface LearningPathFrontier {
  subject: string;
  domain: string;
  topicId: string;
  topicName: string | null;
}

export interface LearningPath {
  childId: string;
  age: number;
  ragCounts: RagCounts;
  subjects: LearningPathSubject[];
  frontier: LearningPathFrontier | null;
  constellation: LearningPathTopic[];
}

export interface AppSettings {
  demoMode: boolean;
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
}
