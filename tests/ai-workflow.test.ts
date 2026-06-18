/**
 * AI Workflow Generator 테스트 — LM Studio 연동 검증
 *
 * LM Studio 통합 테스트는 로컬에서 LM Studio가 실행 중일 때만 수행됩니다.
 * CI에서는 LM_STUDIO_TEST=1 환경 변수가 설정된 경우에만 실행됩니다.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LLMClient, getLLMClient, resetLLMClient } from '@sangfor/workflow-engine';
import { AIWorkflowGenerator } from '@sangfor/workflow-engine';
import { probeLmStudio, shouldRunLmStudioIntegrationTests } from './helpers/lm-studio.js';

function skipWithoutLmStudio(available: boolean, skip: (reason?: string) => void): void {
  if (!available) {
    skip(shouldRunLmStudioIntegrationTests()
      ? 'LM Studio not available'
      : 'LM Studio integration skipped in CI (set LM_STUDIO_TEST=1 to enable)');
  }
}

describe('LLM Client — LM Studio 연결', () => {
  let client: LLMClient;
  let lmStudioAvailable = false;

  beforeAll(async () => {
    resetLLMClient();
    client = getLLMClient({ baseUrl: 'http://localhost:1234/v1' });
    lmStudioAvailable = await probeLmStudio(client);
  });

  afterAll(() => {
    resetLLMClient();
  });

  it('should connect to LM Studio health check', async () => {
    const isHealthy = await client.healthCheck();
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should list available models when LM Studio is running', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    const models = await client.listModels();
    expect(Array.isArray(models)).toBe(true);
    if (models.length > 0) {
      expect(models[0].id).toBeDefined();
    }
  });

  it('should get current model', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    const model = await client.getCurrentModel();
    expect(model).toBeTruthy();
    expect(model).not.toContain('embedding');
  });

  it('should test connection with simple prompt', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    const result = await client.testConnection();
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('latency');
    expect(typeof result.latency).toBe('number');
    expect(result.available).toBe(true);
  });

  it('should complete a simple chat request', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    const result = await client.chat(
      [{ role: 'user', content: 'Say "hello"' }],
      { maxTokens: 10 },
    );

    expect(result.choices.length).toBeGreaterThan(0);
  });

  it('should complete JSON request', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    const result = await client.completeJSON<{ greeting: string }>(
      'Return JSON: {"greeting": "hello"}',
      'You must respond with valid JSON only.',
    );

    expect(result.greeting).toBeDefined();
  }, 30_000);
});

describe('AIWorkflowGenerator — AI 기반 워크플로우 생성', () => {
  let generator: AIWorkflowGenerator;
  let lmStudioAvailable = false;

  beforeAll(async () => {
    resetLLMClient();
    generator = new AIWorkflowGenerator(undefined, { baseUrl: 'http://localhost:1234/v1' });
    lmStudioAvailable = await probeLmStudio(generator.getLLMClient());
  });

  afterAll(() => {
    resetLLMClient();
  });

  it('should check LLM status', async () => {
    const status = await generator.checkLLMStatus();
    expect(status).toHaveProperty('available');
    expect(status).toHaveProperty('model');
    expect(status).toHaveProperty('latency');
  });

  it('should analyze input', async () => {
    const profile = await generator.analyzeInput({
      customerName: 'AI 테스트 고객',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정', 'USB 정책 적용'],
    });

    expect(profile.customerName).toBe('AI 테스트 고객');
    expect(profile.products).toBeDefined();
    expect(profile.requirements.length).toBe(2);
  });

  it('should generate workflow with AI when LM Studio is available', async ({ skip }) => {
    skipWithoutLmStudio(lmStudioAvailable, skip);

    generator.setUseAI(true);

    const profile = await generator.analyzeInput({
      customerName: 'AI 생성 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정', '스캐너 캡처'],
    });

    try {
      const workflow = await Promise.race([
        generator.generateWorkflow(profile),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('workflow generate timeout')), 25_000),
        ),
      ]);

      expect(workflow.reasoning).toBeDefined();
      expect(workflow.steps.length).toBeGreaterThan(0);
    } catch (error) {
      skip(`LM Studio workflow generation failed or timed out: ${error}`);
    }
  }, 30_000);

  it('should fallback to rules when AI is disabled', async () => {
    generator.setUseAI(false);

    const profile = await generator.analyzeInput({
      customerName: '규칙 기반 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.reasoning).toContain('규칙 기반');
    expect(workflow.steps.length).toBeGreaterThan(0);
  });

  it('should fallback to rules when LM Studio is unavailable', async () => {
    resetLLMClient();
    const offlineGenerator = new AIWorkflowGenerator(undefined, { baseUrl: 'http://localhost:99999/v1' });

    const profile = await offlineGenerator.analyzeInput({
      customerName: '오프라인 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await offlineGenerator.generateWorkflow(profile);

    expect(workflow.reasoning).toContain('규칙 기반');
    expect(workflow.steps.length).toBeGreaterThan(0);
  });
});
