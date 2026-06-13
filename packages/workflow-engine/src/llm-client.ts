/**
 * LLM Client — LM Studio (OpenAI 호환) API 클라이언트
 */

import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('llm-client');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface LLMConfig {
  baseUrl: string;       // http://localhost:1234/v1
  model?: string;        // 자동 감지 또는 지정
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryCount?: number;   // 재시도 횟수
  retryDelay?: number;   // 재시도 대기 시간 (ms)
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// ─── 기본 설정 ──────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: 'http://localhost:1234/v1',
  maxTokens: 4096,
  temperature: 0.3,
  timeout: 120000,
  retryCount: 2,
  retryDelay: 1000,
};

// ─── LLM 클라이언트 ────────────────────────────────────────────────────────

export class LLMClient {
  private config: LLMConfig;
  private cachedModel: string | null = null;
  private lastModelCheck: number = 0;
  private static readonly MODEL_CACHE_TTL = 30000; // 30초 캐시

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info(`LLM Client initialized: ${this.config.baseUrl}`);
  }

  // 사용 가능한 모델 목록 조회
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = (await response.json()) as { data?: ModelInfo[] };
      return data.data || [];
    } catch (error) {
      log.error(`Failed to list models: ${error}`);
      throw error;
    }
  }

  // 현재 로드된 모델 확인 (캐시 사용)
  async getCurrentModel(): Promise<string | null> {
    const now = Date.now();
    
    // 캐시 유효하면 재사용
    if (this.cachedModel && now - this.lastModelCheck < LLMClient.MODEL_CACHE_TTL) {
      return this.cachedModel;
    }

    try {
      const models = await this.listModels();
      if (models.length > 0) {
        // 임베딩 모델 제외하고 첫 번째 모델 사용
        const chatModel = models.find(m => !m.id.includes('embedding'));
        this.cachedModel = chatModel?.id || models[0].id;
        this.lastModelCheck = now;
        log.info(`Detected model: ${this.cachedModel}`);
        return this.cachedModel;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Chat Completion 요청 (재시도 로직 포함)
  async chat(messages: ChatMessage[], options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<ChatCompletion> {
    const model = options?.model || this.config.model || await this.getCurrentModel() || 'default';
    const maxTokens = options?.maxTokens || this.config.maxTokens;
    const temperature = options?.temperature || this.config.temperature;

    const body: any = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }

    log.info(`Chat request: model=${model}, messages=${messages.length}, maxTokens=${maxTokens}`);

    let lastError: Error | null = null;
    const maxRetries = this.config.retryCount || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as ChatCompletion;
        log.info(`Chat response: ${data.usage?.total_tokens || 0} tokens`);

        return data;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt);
          log.warn(`Chat request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          log.error(`Chat request failed after ${maxRetries + 1} attempts: ${error}`);
        }
      }
    }

    throw lastError || new Error('Chat request failed');
  }

  // 간단한 텍스트 완료
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await this.chat(messages);
    return result.choices[0]?.message?.content || '';
  }

  // JSON 응답 요청
  async completeJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // response_format 미사용 (LM Studio 호환성 향상)
    // 대신 프롬프트에 JSON 출력을 명시적으로 요청
    const jsonPrompt = prompt + '\n\n IMPORTANT: Respond with valid JSON only. No markdown, no explanation.';
    const result = await this.chat(messages, {
      temperature: 0.1, // JSON은 낮은 temperature
    });

    const content = result.choices[0]?.message?.content || '{}';

    try {
      return JSON.parse(content) as T;
    } catch {
      // JSON 파싱 실패 시 마크다운 코드 블록에서 추출 시도
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }
      
      // 중괄호로 감싸진 JSON 추출 시도
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]) as T;
        } catch {
          // 파싱 실패
        }
      }
      
      throw new Error(`Failed to parse JSON response: ${content.substring(0, 200)}`);
    }
  }

  // 연결 상태 확인 (빠른 테스트)
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // 간단한 테스트 요청으로 실제 사용 가능 여부 확인
  async testConnection(): Promise<{ available: boolean; model: string | null; latency: number }> {
    const start = Date.now();
    try {
      const model = await this.getCurrentModel();
      if (!model) {
        return { available: false, model: null, latency: Date.now() - start };
      }

      // 간단한 테스트 요청
      const result = await this.chat(
        [{ role: 'user', content: 'Say "ok"' }],
        { maxTokens: 10, temperature: 0 }
      );

      return {
        available: true,
        model,
        latency: Date.now() - start,
      };
    } catch {
      return { available: false, model: null, latency: Date.now() - start };
    }
  }

  // 설정 조회
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  // 설정 업데이트
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    log.info(`Updated LLM config: ${this.config.baseUrl}`);
  }

  // 캐시 초기화
  clearCache(): void {
    this.cachedModel = null;
    this.lastModelCheck = 0;
  }
}

// ─── 싱글톤 인스턴스 ────────────────────────────────────────────────────────

let defaultClient: LLMClient | null = null;

export function getLLMClient(config?: Partial<LLMConfig>): LLMClient {
  if (!defaultClient || config) {
    defaultClient = new LLMClient(config);
  }
  return defaultClient;
}

// 싱글톤 초기화 함수
export function resetLLMClient(): void {
  defaultClient = null;
}
