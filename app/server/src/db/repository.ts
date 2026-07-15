import type {
  ActiveExperiment,
  Assessment,
  AssessmentResult,
  BaselineAnswers,
  Child,
  CompletedExperiment,
  CompletionLevel,
  DesignArm,
  DesignPrefs,
  MasteryStatus,
  ParentEffort,
  SessionReport,
  TopicMastery,
  TutorProfile,
  TutorProfileStatus,
  Worksheet,
  WorksheetStatus,
  AbTestId,
} from '../../../shared/types.js';
import { emptyDesignPrefs } from '../../../shared/abTests.js';
import { deriveChildAgeFields } from '../../../shared/ukSchoolYear.js';
import { getDb, type AppDatabase } from './database.js';

type ChildRow = {
  id: string;
  name: string;
  age: number;
  year_group: string | null;
  date_of_birth: string | null;
  interests: string;
  avatar_color: string;
  created_at: string;
  updated_at: string;
};

type MasteryRow = {
  child_id: string;
  topic_id: string;
  status: MasteryStatus;
  confidence: number;
  last_assessed_at: string | null;
  notes: string | null;
};

type WorksheetRow = {
  id: string;
  child_id: string;
  theme: string;
  duration_minutes: number;
  subject_focus: string | null;
  domain_focus: string | null;
  topic_ids: string;
  title: string;
  pdf_path: string | null;
  content_json: string;
  status: WorksheetStatus;
  created_at: string;
};

type AssessmentRow = {
  id: string;
  worksheet_id: string;
  child_id: string;
  scan_path: string;
  results_json: string;
  summary: string;
  created_at: string;
};

function mapChild(row: ChildRow): Child {
  const dob = row.date_of_birth || approximateFallbackDob(row.age);
  const derived = deriveChildAgeFields(dob);
  return {
    id: row.id,
    name: row.name,
    dateOfBirth: dob,
    age: derived.age,
    yearGroup: derived.yearGroup,
    interests: JSON.parse(row.interests) as string[],
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approximateFallbackDob(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function mapMastery(row: MasteryRow): TopicMastery {
  return {
    childId: row.child_id,
    topicId: row.topic_id,
    status: row.status,
    confidence: row.confidence,
    lastAssessedAt: row.last_assessed_at,
    notes: row.notes,
  };
}

function mapWorksheet(row: WorksheetRow): Worksheet {
  return {
    id: row.id,
    childId: row.child_id,
    theme: row.theme,
    durationMinutes: row.duration_minutes,
    subjectFocus: row.subject_focus,
    domainFocus: row.domain_focus ?? null,
    topicIds: JSON.parse(row.topic_ids) as string[],
    title: row.title,
    pdfPath: row.pdf_path,
    contentJson: row.content_json,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    worksheetId: row.worksheet_id,
    childId: row.child_id,
    scanPath: row.scan_path,
    results: JSON.parse(row.results_json) as AssessmentResult[],
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export function listChildren(db: AppDatabase = getDb()): Child[] {
  const rows = db.prepare('SELECT * FROM children ORDER BY name').all() as ChildRow[];
  return rows.map(mapChild);
}

export function getChild(id: string, db: AppDatabase = getDb()): Child | null {
  const row = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as ChildRow | undefined;
  return row ? mapChild(row) : null;
}

export function upsertChild(child: Child, db: AppDatabase = getDb()): Child {
  const derived = deriveChildAgeFields(child.dateOfBirth);
  db.prepare(
    `INSERT INTO children (id, name, age, year_group, date_of_birth, interests, avatar_color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       age = excluded.age,
       year_group = excluded.year_group,
       date_of_birth = excluded.date_of_birth,
       interests = excluded.interests,
       avatar_color = excluded.avatar_color,
       updated_at = excluded.updated_at`,
  ).run(
    child.id,
    child.name,
    derived.age,
    derived.yearGroup,
    child.dateOfBirth,
    JSON.stringify(child.interests),
    child.avatarColor,
    child.createdAt,
    child.updatedAt,
  );
  return {
    ...child,
    age: derived.age,
    yearGroup: derived.yearGroup,
  };
}

export function deleteChild(id: string, db: AppDatabase = getDb()): void {
  db.prepare('DELETE FROM children WHERE id = ?').run(id);
}

export function listMastery(childId: string, db: AppDatabase = getDb()): TopicMastery[] {
  const rows = db
    .prepare('SELECT * FROM topic_mastery WHERE child_id = ?')
    .all(childId) as MasteryRow[];
  return rows.map(mapMastery);
}

export function upsertMastery(mastery: TopicMastery, db: AppDatabase = getDb()): void {
  db.prepare(
    `INSERT INTO topic_mastery (child_id, topic_id, status, confidence, last_assessed_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id, topic_id) DO UPDATE SET
       status = excluded.status,
       confidence = excluded.confidence,
       last_assessed_at = excluded.last_assessed_at,
       notes = excluded.notes`,
  ).run(
    mastery.childId,
    mastery.topicId,
    mastery.status,
    mastery.confidence,
    mastery.lastAssessedAt,
    mastery.notes,
  );
}

export function listWorksheets(childId: string, db: AppDatabase = getDb()): Worksheet[] {
  const rows = db
    .prepare('SELECT * FROM worksheets WHERE child_id = ? ORDER BY created_at DESC')
    .all(childId) as WorksheetRow[];
  return rows.map(mapWorksheet);
}

export function getWorksheet(id: string, db: AppDatabase = getDb()): Worksheet | null {
  const row = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(id) as WorksheetRow | undefined;
  return row ? mapWorksheet(row) : null;
}

export function insertWorksheet(worksheet: Worksheet, db: AppDatabase = getDb()): Worksheet {
  db.prepare(
    `INSERT INTO worksheets
     (id, child_id, theme, duration_minutes, subject_focus, domain_focus, topic_ids, title, pdf_path, content_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    worksheet.id,
    worksheet.childId,
    worksheet.theme,
    worksheet.durationMinutes,
    worksheet.subjectFocus,
    worksheet.domainFocus,
    JSON.stringify(worksheet.topicIds),
    worksheet.title,
    worksheet.pdfPath,
    worksheet.contentJson,
    worksheet.status,
    worksheet.createdAt,
  );
  return worksheet;
}

export function updateWorksheetStatus(
  id: string,
  status: WorksheetStatus,
  pdfPath?: string | null,
  db: AppDatabase = getDb(),
): void {
  if (pdfPath !== undefined) {
    db.prepare('UPDATE worksheets SET status = ?, pdf_path = ? WHERE id = ?').run(
      status,
      pdfPath,
      id,
    );
  } else {
    db.prepare('UPDATE worksheets SET status = ? WHERE id = ?').run(status, id);
  }
}

export function insertAssessment(assessment: Assessment, db: AppDatabase = getDb()): Assessment {
  db.prepare(
    `INSERT INTO assessments (id, worksheet_id, child_id, scan_path, results_json, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    assessment.id,
    assessment.worksheetId,
    assessment.childId,
    assessment.scanPath,
    JSON.stringify(assessment.results),
    assessment.summary,
    assessment.createdAt,
  );
  return assessment;
}

export function listAssessments(childId: string, db: AppDatabase = getDb()): Assessment[] {
  const rows = db
    .prepare('SELECT * FROM assessments WHERE child_id = ? ORDER BY created_at DESC')
    .all(childId) as AssessmentRow[];
  return rows.map(mapAssessment);
}

export function getSetting(key: string, db: AppDatabase = getDb()): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string, db: AppDatabase = getDb()): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

type TutorProfileRow = {
  child_id: string;
  status: TutorProfileStatus;
  baseline_summary: string | null;
  insights_summary: string | null;
  design_prefs_json: string;
  active_experiment_json: string | null;
  completed_experiments_json: string;
  baseline_answers_json: string | null;
  updated_at: string;
};

type SessionReportRow = {
  id: string;
  child_id: string;
  worksheet_id: string;
  assessment_id: string | null;
  test_id: string | null;
  arm: string | null;
  completed_core: CompletionLevel;
  time_minutes: number;
  help_count: number;
  enjoyment: number;
  parent_effort: ParentEffort;
  error_notes: string | null;
  learning_score: number;
  composite_score: number;
  created_at: string;
};

function mapTutorProfile(row: TutorProfileRow): TutorProfile {
  const prefs = {
    ...emptyDesignPrefs(),
    ...(JSON.parse(row.design_prefs_json || '{}') as DesignPrefs),
  };
  return {
    childId: row.child_id,
    status: row.status,
    baselineSummary: row.baseline_summary,
    insightsSummary: row.insights_summary,
    designPrefs: prefs,
    activeExperiment: row.active_experiment_json
      ? (JSON.parse(row.active_experiment_json) as ActiveExperiment)
      : null,
    completedExperiments: JSON.parse(
      row.completed_experiments_json || '[]',
    ) as CompletedExperiment[],
    baselineAnswers: row.baseline_answers_json
      ? (JSON.parse(row.baseline_answers_json) as BaselineAnswers)
      : null,
    updatedAt: row.updated_at,
  };
}

function mapSessionReport(row: SessionReportRow): SessionReport {
  return {
    id: row.id,
    childId: row.child_id,
    worksheetId: row.worksheet_id,
    assessmentId: row.assessment_id,
    testId: (row.test_id as AbTestId | null) ?? null,
    arm: (row.arm as DesignArm | null) ?? null,
    completedCore: row.completed_core,
    timeMinutes: row.time_minutes,
    helpCount: row.help_count,
    enjoyment: row.enjoyment,
    parentEffort: row.parent_effort,
    errorNotes: row.error_notes,
    learningScore: row.learning_score,
    compositeScore: row.composite_score,
    createdAt: row.created_at,
  };
}

export function getTutorProfile(
  childId: string,
  db: AppDatabase = getDb(),
): TutorProfile | null {
  const row = db
    .prepare('SELECT * FROM tutor_profiles WHERE child_id = ?')
    .get(childId) as TutorProfileRow | undefined;
  return row ? mapTutorProfile(row) : null;
}

export function upsertTutorProfile(
  profile: TutorProfile,
  db: AppDatabase = getDb(),
): TutorProfile {
  db.prepare(
    `INSERT INTO tutor_profiles (
       child_id, status, baseline_summary, insights_summary, design_prefs_json,
       active_experiment_json, completed_experiments_json, baseline_answers_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id) DO UPDATE SET
       status = excluded.status,
       baseline_summary = excluded.baseline_summary,
       insights_summary = excluded.insights_summary,
       design_prefs_json = excluded.design_prefs_json,
       active_experiment_json = excluded.active_experiment_json,
       completed_experiments_json = excluded.completed_experiments_json,
       baseline_answers_json = excluded.baseline_answers_json,
       updated_at = excluded.updated_at`,
  ).run(
    profile.childId,
    profile.status,
    profile.baselineSummary,
    profile.insightsSummary,
    JSON.stringify(profile.designPrefs),
    profile.activeExperiment ? JSON.stringify(profile.activeExperiment) : null,
    JSON.stringify(profile.completedExperiments),
    profile.baselineAnswers ? JSON.stringify(profile.baselineAnswers) : null,
    profile.updatedAt,
  );
  return profile;
}

export function insertSessionReport(
  report: SessionReport,
  db: AppDatabase = getDb(),
): SessionReport {
  db.prepare(
    `INSERT INTO session_reports (
       id, child_id, worksheet_id, assessment_id, test_id, arm,
       completed_core, time_minutes, help_count, enjoyment, parent_effort,
       error_notes, learning_score, composite_score, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    report.id,
    report.childId,
    report.worksheetId,
    report.assessmentId,
    report.testId,
    report.arm,
    report.completedCore,
    report.timeMinutes,
    report.helpCount,
    report.enjoyment,
    report.parentEffort,
    report.errorNotes,
    report.learningScore,
    report.compositeScore,
    report.createdAt,
  );
  return report;
}

export function listSessionReports(
  childId: string,
  db: AppDatabase = getDb(),
): SessionReport[] {
  const rows = db
    .prepare(
      'SELECT * FROM session_reports WHERE child_id = ? ORDER BY created_at DESC',
    )
    .all(childId) as SessionReportRow[];
  return rows.map(mapSessionReport);
}

export function listSessionReportsForExperiment(
  childId: string,
  testId: AbTestId,
  db: AppDatabase = getDb(),
): SessionReport[] {
  const rows = db
    .prepare(
      `SELECT * FROM session_reports
       WHERE child_id = ? AND test_id = ?
       ORDER BY created_at ASC`,
    )
    .all(childId, testId) as SessionReportRow[];
  return rows.map(mapSessionReport);
}

export function getSessionReportForWorksheet(
  worksheetId: string,
  db: AppDatabase = getDb(),
): SessionReport | null {
  const row = db
    .prepare('SELECT * FROM session_reports WHERE worksheet_id = ?')
    .get(worksheetId) as SessionReportRow | undefined;
  return row ? mapSessionReport(row) : null;
}

export function getAssessmentForWorksheet(
  worksheetId: string,
  db: AppDatabase = getDb(),
): Assessment | null {
  const row = db
    .prepare(
      'SELECT * FROM assessments WHERE worksheet_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(worksheetId) as AssessmentRow | undefined;
  return row ? mapAssessment(row) : null;
}
