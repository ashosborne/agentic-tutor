import type { Child, Topic } from '../../../shared/types.js';

export interface GenerateWorksheetInput {
  child: Child;
  theme: string;
  durationMinutes: number;
  topics: Topic[];
}

export interface GeneratedWorksheet {
  title: string;
  theme: string;
  imageBuffer: Buffer;
  mimeType: 'image/png';
}

export interface AssessScanInput {
  child: Child;
  theme: string;
  topics: Topic[];
  /** Completed worksheet scan from the parent. */
  imageBase64: string;
  mimeType: string;
  /** Blank generated worksheet image for reference (optional in demo). */
  worksheetImageBase64?: string;
  worksheetMimeType?: string;
}

export interface AssessScanOutput {
  results: Array<{
    topicId: string;
    score: number;
    evidence: string[];
    recommendation: 'advance' | 'practice' | 'refresh';
  }>;
  summary: string;
}

export interface WorksheetGenerator {
  generate(input: GenerateWorksheetInput): Promise<GeneratedWorksheet>;
}

export interface ScanAssessor {
  assess(input: AssessScanInput): Promise<AssessScanOutput>;
}
