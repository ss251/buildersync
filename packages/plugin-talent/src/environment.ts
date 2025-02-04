import { z } from 'zod';
import { IAgentRuntime } from '@elizaos/core';
import { TalentAPIConfig } from './types';

const configSchema = z.object({
  TALENT_API_KEY: z.string(),
  TALENT_API_BASE_URL: z.string().default('https://api.talentprotocol.com/v1')
});

export function validateTalentConfig(runtime: IAgentRuntime): TalentAPIConfig {
  try {
    const config = configSchema.parse({
      TALENT_API_KEY: runtime.getSetting('TALENT_API_KEY'),
      TALENT_API_BASE_URL: runtime.getSetting('TALENT_API_BASE_URL')
    });

    return {
      apiKey: config.TALENT_API_KEY,
      baseUrl: config.TALENT_API_BASE_URL
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Talent Protocol configuration: ${error.message}`);
    }
    throw error;
  }
}
