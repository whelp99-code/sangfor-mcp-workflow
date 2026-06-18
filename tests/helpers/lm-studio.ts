/**
 * LM Studio availability probe for integration tests.
 * Skips slow LLM tests when LM Studio is offline or CI without LM_STUDIO_TEST=1.
 */

import type { LLMClient } from '@sangfor/workflow-engine';

const PROBE_TIMEOUT_MS = 3_000;

export function shouldRunLmStudioIntegrationTests(): boolean {
  if (process.env.CI === 'true' && process.env.LM_STUDIO_TEST !== '1') {
    return false;
  }
  return true;
}

export async function probeLmStudio(client: LLMClient): Promise<boolean> {
  if (!shouldRunLmStudioIntegrationTests()) {
    return false;
  }

  try {
    if (!(await client.healthCheck())) {
      return false;
    }

    const result = await Promise.race([
      client.testConnection(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LM Studio probe timeout')), PROBE_TIMEOUT_MS),
      ),
    ]);

    return result.available === true;
  } catch {
    return false;
  }
}
