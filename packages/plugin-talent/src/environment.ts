import { z } from 'zod';
import { IAgentRuntime } from '@elizaos/core';
import { TalentAPIConfig } from './types';

interface RuntimeWithConfig extends IAgentRuntime {
  config?: {
    talent?: {
      apiKey?: string;
      baseUrl?: string;
    };
  };
}

const configSchema = z.object({
  TALENT_API_KEY: z.string(),
  TALENT_API_BASE_URL: z.string().default('https://api.talentprotocol.com')
});

export function validateTalentConfig(runtime: RuntimeWithConfig): TalentAPIConfig {
  try {
    const apiKey = runtime.config?.talent?.apiKey || runtime.getSetting('TALENT_API_KEY');
    const baseUrl = runtime.config?.talent?.baseUrl || runtime.getSetting('TALENT_API_BASE_URL');

    if (!apiKey) {
      throw new Error('TALENT_API_KEY is required');
    }

    return {
      apiKey,
      baseUrl: (baseUrl || 'https://api.talentprotocol.com').replace(/\/$/, '')
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Talent Protocol configuration: ${error.message}`);
    }
    throw error;
  }
}

export function getConfig(runtime: RuntimeWithConfig | TalentAPIConfig): TalentAPIConfig {
  if ('apiKey' in runtime) {
    return {
      apiKey: runtime.apiKey,
      baseUrl: (runtime.baseUrl || 'https://api.talentprotocol.com').replace(/\/$/, '')
    };
  }
  return validateTalentConfig(runtime);
}
