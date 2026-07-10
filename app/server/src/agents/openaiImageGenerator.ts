import OpenAI from 'openai';
import { getConfig } from '../config.js';
import type {
  GeneratedWorksheet,
  GenerateWorksheetInput,
  WorksheetGenerator,
} from './types.js';
import { buildWorksheetPrompt, deriveWorksheetTitle } from './worksheetPrompt.js';

export class OpenAIWorksheetImageGenerator implements WorksheetGenerator {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? getConfig().openaiApiKey;
    if (!key) throw new Error('OPENAI_API_KEY is required when DEMO_MODE is false');
    this.client = new OpenAI({ apiKey: key });
  }

  async generate(input: GenerateWorksheetInput): Promise<GeneratedWorksheet> {
    const prompt = buildWorksheetPrompt(input);
    const title = deriveWorksheetTitle(input.theme, input.topics);

    const response = await this.client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1536',
      quality: 'high',
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('OpenAI image generation returned no image data');
    }

    return {
      title,
      theme: input.theme,
      imageBuffer: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
    };
  }
}
