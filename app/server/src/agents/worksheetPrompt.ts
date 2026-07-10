import fs from 'node:fs';
import path from 'node:path';
import type { Child, Topic } from '../../../shared/types.js';
import { APP_ROOT } from '../config.js';

const DOCS_DIR = path.resolve(APP_ROOT, '../docs');

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
 * Build the image-generation prompt from docs/examplePrompt.md with topic + theme
 * substituted, and docs/deep-research-report.md attached as the design brief.
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

  let body = template
    .replace(
      /addresses the following learning point:/i,
      `addresses the following ${learningLabel}:`,
    )
    .replace(
      /\{\s*"id":\s*"mt_mr_Vk7FGzK"[\s\S]*?\}\s*(?=Remember)/,
      `${learningPointsBlock(input.topics, input.child.name)}\n\n`,
    )
    .replace(
      /themed around the ocean\.?/i,
      `themed around ${input.theme}.`,
    );

  return `DESIGN BRIEF (treat as the attached report "Designing homework worksheet that children want to do"):
---
${designReport}
---

CHILD CONTEXT:
- Name: ${input.child.name}
- Age: ${input.child.age}
- Approximate worksheet duration: ${input.durationMinutes} minutes

${body}

OUTPUT REQUIREMENTS:
- Produce a single printable A4 portrait worksheet as an image.
- Follow every item in the "Checklist for designers and teachers".
- UK English spelling. Age-appropriate for ${input.child.name} (age ${input.child.age}).
- Theme every activity tightly around "${input.theme}".
- Do not look like generic AI clip-art; illustrations must be task-relevant and specific.`;
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
