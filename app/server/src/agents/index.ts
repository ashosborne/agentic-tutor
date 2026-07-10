import { isDemoMode, getConfig } from '../config.js';
import { DemoScanAssessor, DemoWorksheetGenerator } from './demo.js';
import { OpenAIWorksheetImageGenerator } from './openaiImageGenerator.js';
import { GptScanAssessor } from './gptAssessor.js';
import type { ScanAssessor, WorksheetGenerator } from './types.js';

export function getWorksheetGenerator(): WorksheetGenerator {
  if (isDemoMode()) return new DemoWorksheetGenerator();
  return new OpenAIWorksheetImageGenerator();
}

export function getScanAssessor(): ScanAssessor {
  if (isDemoMode()) return new DemoScanAssessor();
  return new GptScanAssessor();
}

export function getAgentStatus() {
  const config = getConfig();
  return {
    demoMode: isDemoMode(),
    anthropicConfigured: Boolean(config.anthropicApiKey),
    openaiConfigured: Boolean(config.openaiApiKey),
  };
}
