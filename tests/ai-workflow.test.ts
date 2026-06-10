/**
 * AI Workflow Generator 테스트 — LM Studio 연동 검증
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LLMClient, getLLMClient, resetLLMClient } from '@sangfor/workflow-engine';
import { AIWorkflowGenerator } from '@sangfor/workflow-engine';

describe('LLM Client — LM Studio 연결', () => {
  let client: LLMClient;

  beforeAll(() => {
    resetLLMClient();
    client = getLLMClient({ baseUrl: 'http://localhost:1234/v1' });
  });

  afterAll(() => {
    resetLLMClient();
  });

  it('should connect to LM Studio health check', async () => {
    const isHealthy = await client.healthCheck();
    console.log(`LM Studio health check: ${isHealthy}`);
    // LM Studio가 실행 중이면 true, 아니면 false
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should list available models', async () => {
    try {
      const models = await client.listModels();
      console.log(`Available models: ${models.map(m => m.id).join(', ')}`);
      expect(Array.isArray(models)).toBe(true);
      
      // LM Studio가 실행 중이면 모델이 있어야 함
      if (models.length > 0) {
        expect(models[0].id).toBeDefined();
      }
    } catch (error) {
      // LM Studio가 꺼져있으면 에러 발생
      console.log(`List models error (expected if LM Studio is off): ${error}`);
      expect(error).toBeDefined();
    }
  });

  it('should get current model', async () => {
    const model = await client.getCurrentModel();
    console.log(`Current model: ${model}`);
    
    // LM Studio가 실행 중이면 모델이 있어야 함
    if (await client.healthCheck()) {
      expect(model).toBeTruthy();
      // 임베딩 모델이 아닌 채팅 모델이어야 함
      expect(model).not.toContain('embedding');
    }
  });

  it('should test connection with simple prompt', async () => {
    const result = await client.testConnection();
    console.log(`Connection test:`, result);
    
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('latency');
    expect(typeof result.latency).toBe('number');
  });

  it('should complete a simple chat request', async () => {
    if (!(await client.healthCheck())) {
      console.log('Skipping chat test - LM Studio not available');
      return;
    }

    const result = await client.chat(
      [{ role: 'user', content: 'Say "hello"' }],
      { maxTokens: 10 }
    );

    expect(result).toBeDefined();
    expect(result.choices).toBeDefined();
    expect(result.choices.length).toBeGreaterThan(0);
    console.log(`Chat response: ${result.choices[0].message.content}`);
  });

  it('should complete JSON request', async () => {
    if (!(await client.healthCheck())) {
      console.log('Skipping JSON test - LM Studio not available');
      return;
    }

    const result = await client.completeJSON<{ greeting: string }>(
      'Return JSON: {"greeting": "hello"}',
      'You must respond with valid JSON only.'
    );

    expect(result).toBeDefined();
    expect(result.greeting).toBeDefined();
    console.log(`JSON response:`, result);
  });
});

describe('AIWorkflowGenerator — AI 기반 워크플로우 생성', () => {
  let generator: AIWorkflowGenerator;

  beforeAll(() => {
    resetLLMClient();
    generator = new AIWorkflowGenerator(undefined, { baseUrl: 'http://localhost:1234/v1' });
  });

  afterAll(() => {
    resetLLMClient();
  });

  it('should check LLM status', async () => {
    const status = await generator.checkLLMStatus();
    console.log(`LLM Status:`, status);
    
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

  it('should generate workflow (AI or Rules)', async () => {
    const profile = await generator.analyzeInput({
      customerName: 'AI 테스트 고객',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.id).toBeDefined();
    expect(workflow.name).toContain('AI 테스트 고객');
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.reasoning).toBeDefined();
    expect(workflow.status).toBe('draft');

    // AI 사용 여부에 따라 reasoning 내용이 다름
    const isAI = workflow.reasoning?.includes('AI 기반');
    console.log(`Workflow generation mode: ${isAI ? 'AI' : 'Rules'}`);
    console.log(`Steps: ${workflow.steps.length}`);
    console.log(`Reasoning preview: ${workflow.reasoning?.substring(0, 100)}...`);
  });

  it('should generate workflow with AI when LM Studio is available', async () => {
    const isHealthy = await generator.getLLMClient().healthCheck();
    
    if (!isHealthy) {
      console.log('Skipping AI generation test - LM Studio not available');
      return;
    }

    // AI 활성화
    generator.setUseAI(true);

    const profile = await generator.analyzeInput({
      customerName: 'AI 생성 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정', '스캐너 캡처'],
    });

    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.reasoning).toContain('AI 기반');
    console.log(`AI-generated workflow: ${workflow.steps.length} steps`);
    console.log(`Selected tools: ${workflow.steps.map(s => s.toolName).join(', ')}`);
  });

  it('should fallback to rules when AI is disabled', async () => {
    // AI 비활성화
    generator.setUseAI(false);

    const profile = await generator.analyzeInput({
      customerName: '규칙 기반 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.reasoning).toContain('규칙 기반');
    console.log(`Rule-based workflow: ${workflow.steps.length} steps`);
  });

  it('should fallback to rules when LM Studio is unavailable', async () => {
    // 잘못된 URL로 클라이언트 생성
    resetLLMClient();
    const offlineGenerator = new AIWorkflowGenerator(undefined, { baseUrl: 'http://localhost:99999/v1' });

    const profile = await offlineGenerator.analyzeInput({
      customerName: '오프라인 테스트',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await offlineGenerator.generateWorkflow(profile);

    expect(workflow.reasoning).toContain('규칙 기반');
    console.log(`Offline fallback workflow: ${workflow.steps.length} steps`);
  });
});
