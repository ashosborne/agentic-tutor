import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { GeneratedWorksheetMeta, Worksheet } from '../../../shared/types.js';
import { resolveTopicCount, selectTopicsForWorksheet } from '../../../shared/topicSelection.js';
import { getWorksheetGenerator } from '../agents/index.js';
import {
  getChild,
  insertWorksheet,
  listMastery,
  updateWorksheetStatus,
} from '../db/repository.js';
import { STORAGE_DIR } from '../db/database.js';
import { loadTaxonomy } from './taxonomy.js';

export interface CreateWorksheetRequest {
  childId: string;
  theme: string;
  durationMinutes: number;
  subjectFocus?: string | null;
  domainFocus?: string | null;
  preferTopicId?: string | null;
}

export async function createWorksheet(
  req: CreateWorksheetRequest,
): Promise<Worksheet> {
  const child = getChild(req.childId);
  if (!child) throw new Error('Child not found');

  const taxonomy = loadTaxonomy();
  const mastery = listMastery(child.id);
  const count = resolveTopicCount(req.durationMinutes);

  const topics = selectTopicsForWorksheet({
    topics: taxonomy.topics,
    dependencies: taxonomy.dependencies,
    mastery,
    age: child.age,
    count,
    subjectFocus: req.subjectFocus,
    domainFocus: req.domainFocus,
    preferTopicId: req.preferTopicId,
    preferUkNc: true,
  });

  if (topics.length === 0) {
    throw new Error(
      'No suitable topics found for this child. Try a different subject or add more progress first.',
    );
  }

  const generator = getWorksheetGenerator();
  const generated = await generator.generate({
    child,
    theme: req.theme,
    durationMinutes: req.durationMinutes,
    topics,
  });

  const id = nanoid();
  const worksheetsDir = path.join(STORAGE_DIR, 'worksheets');
  fs.mkdirSync(worksheetsDir, { recursive: true });
  const filePath = path.join(worksheetsDir, `${id}.png`);
  fs.writeFileSync(filePath, generated.imageBuffer);

  const meta: GeneratedWorksheetMeta = {
    title: generated.title,
    theme: generated.theme,
  };

  const worksheet: Worksheet = {
    id,
    childId: child.id,
    theme: req.theme,
    durationMinutes: req.durationMinutes,
    subjectFocus: req.subjectFocus ?? null,
    domainFocus: req.domainFocus ?? null,
    topicIds: topics.map((t) => t.id),
    title: generated.title,
    pdfPath: filePath,
    contentJson: JSON.stringify(meta),
    status: 'ready',
    createdAt: new Date().toISOString(),
  };

  insertWorksheet(worksheet);
  return worksheet;
}

export function markWorksheetPrinted(id: string): void {
  updateWorksheetStatus(id, 'printed');
}
