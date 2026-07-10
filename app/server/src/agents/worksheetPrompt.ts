import fs from 'node:fs';
import path from 'node:path';
import type { Child, Topic } from '../../../shared/types.js';
import { APP_ROOT } from '../config.js';

const DOCS_DIR = path.resolve(APP_ROOT, '../docs');

/** Placeholder in docs/examplePrompt.md for the inlined design brief. */
const DESIGN_BRIEF_PLACEHOLDER =
  '[full docs/deep-research-report.md inlined here]';

/** Example learning-point JSON id in docs/examplePrompt.md (substituted at runtime). */
const EXAMPLE_TOPIC_ID = 'mt_FNSeo9_T2Z';

/** Example theme string in docs/examplePrompt.md (substituted at runtime). */
const EXAMPLE_THEME = 'unicorns';

function loadDoc(filename: string): string {
  const filePath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing worksheet prompt doc: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function topicToLearningPoint(topic: Topic, childName: string) {
  return {
    id: topic.id,
    type: topic.type,
    subject: topic.subject,
    domain: topic.domain,
    name: topic.name,
    description: topic.description,
    ageRangeStart: topic.ageRangeStart,
    ageRangeEnd: topic.ageRangeEnd,
    centrality: topic.centrality,
    evidence: topic.evidence,
    assessmentPrompt: topic.assessmentPrompt?.replaceAll('{{name}}', childName) ?? null,
    standards: topic.standards,
  };
}

function learningPointsBlock(topics: Topic[], childName: string): string {
  const points = topics.map((t) => topicToLearningPoint(t, childName));
  if (points.length === 1) {
    return JSON.stringify(points[0], null, 2);
  }
  return JSON.stringify(points, null, 2);
}

/**
 * Build the image-generation prompt from docs/examplePrompt.md — the same shape
 * the app sends — with design brief, child context, topic, and theme substituted.
 */
export function buildWorksheetPrompt(input: {
  child: Child;
  theme: string;
  topics: Topic[];
  durationMinutes: number;
}): string {
  const template = loadDoc('examplePrompt.md');
  const designReport = loadDoc('deep-research-report.md');

  const learningLabel =
    input.topics.length === 1 ? 'learning point' : 'learning points';

  let prompt = template.replace(DESIGN_BRIEF_PLACEHOLDER, designReport);

  prompt = prompt
    .replace(
      /- Name: Maya\n- Age: 5\n- Approximate worksheet duration: 15 minutes/,
      `- Name: ${input.child.name}\n- Age: ${input.child.age}\n- Approximate worksheet duration: ${input.durationMinutes} minutes`,
    )
    .replace(
      /addresses the following learning point:/i,
      `addresses the following ${learningLabel}:`,
    )
    .replace(
      new RegExp(
        `\\{\\s*"id":\\s*"${EXAMPLE_TOPIC_ID}"[\\s\\S]*?\\}\\s*(?=Remember)`,
      ),
      `${learningPointsBlock(input.topics, input.child.name)}\n\n`,
    )
    .replace(
      new RegExp(`themed around ${EXAMPLE_THEME}\\.?`, 'i'),
      `themed around ${input.theme}.`,
    )
    .replace(
      new RegExp(
        `Age-appropriate for Maya \\(age 5\\)\\.`,
      ),
      `Age-appropriate for ${input.child.name} (age ${input.child.age}).`,
    )
    .replace(
      new RegExp(`Theme every activity tightly around "${EXAMPLE_THEME}"\\.`, 'i'),
      `Theme every activity tightly around "${input.theme}".`,
    );

  return prompt;
}

export function deriveWorksheetTitle(theme: string, topics: Topic[]): string {
  const names = topics
    .map((t) => t.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return `${theme} worksheet`;
  if (names.length === 1) return `${theme} — ${names[0]}`;
  if (names.length === 2) return `${theme} — ${names[0]} & ${names[1]}`;
  return `${theme} — ${names[0]} & ${names.length - 1} more`;
}
