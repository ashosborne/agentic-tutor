import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AssessScanInput,
  AssessScanOutput,
  GeneratedWorksheet,
  GenerateWorksheetInput,
  ScanAssessor,
  WorksheetGenerator,
} from './types.js';
import { deriveWorksheetTitle } from './worksheetPrompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../../fixtures');

function pickThemeKey(theme: string): string {
  const t = theme.toLowerCase();
  if (t.includes('unicorn')) return 'unicorns';
  if (t.includes('pon')) return 'ponies';
  if (t.includes('sea') || t.includes('ocean') || t.includes('fish')) return 'sea-life';
  return 'sea-life';
}

function loadFixturePng(themeKey: string): Buffer {
  const preferred = path.join(FIXTURES, 'mocks', `worksheet-${themeKey}.png`);
  if (fs.existsSync(preferred)) return fs.readFileSync(preferred);
  const fallback = path.join(FIXTURES, 'mocks', 'worksheet-sea-life.png');
  if (!fs.existsSync(fallback)) {
    throw new Error(`Missing demo worksheet fixture at ${fallback}`);
  }
  return fs.readFileSync(fallback);
}

function loadMockAssessor(themeKey: string): AssessScanOutput {
  const file = path.join(FIXTURES, 'mocks', `assess-${themeKey}.json`);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as AssessScanOutput;
  }
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'mocks', 'assess-sea-life.json'), 'utf8'),
  ) as AssessScanOutput;
}

export class DemoWorksheetGenerator implements WorksheetGenerator {
  async generate(input: GenerateWorksheetInput): Promise<GeneratedWorksheet> {
    const themeKey = pickThemeKey(input.theme);
    return {
      title: deriveWorksheetTitle(input.theme, input.topics),
      theme: input.theme,
      imageBuffer: loadFixturePng(themeKey),
      mimeType: 'image/png',
    };
  }
}

export class DemoScanAssessor implements ScanAssessor {
  async assess(input: AssessScanInput): Promise<AssessScanOutput> {
    const themeKey = pickThemeKey(input.theme);
    const template = loadMockAssessor(themeKey);
    const results = input.topics.map((topic, i) => {
      const base = template.results[i % template.results.length];
      return {
        topicId: topic.id,
        score: base?.score ?? 0.75,
        evidence: base?.evidence ?? [`Demo assessment for ${topic.name}`],
        recommendation: base?.recommendation ?? ('practice' as const),
      };
    });

    return {
      results,
      summary: template.summary
        .replaceAll('{{name}}', input.child.name)
        .replaceAll('{{theme}}', input.theme),
    };
  }
}
