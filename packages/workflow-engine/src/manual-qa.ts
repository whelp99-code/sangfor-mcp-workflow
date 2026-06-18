/**
 * Manual QA System — 메뉴얼 기반 질의응답 시스템
 */

import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('manual-qa');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ManualQuery {
  question: string;
  product?: string;
  version?: string;
  category?: string;
}

export interface ManualAnswer {
  id: string;
  question: string;
  answer: string;
  sources: ManualSource[];
  confidence: number;
  relatedQuestions: string[];
}

export interface ManualSource {
  document: string;
  page?: number;
  section: string;
  excerpt: string;
  relevance: number;
}

export interface MenuStructure {
  product: string;
  version: string;
  menus: MenuItem[];
  capturedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  path: string[];
  children?: MenuItem[];
  features?: string[];
}

// ─── 메뉴얼 QA 시스템 ──────────────────────────────────────────────────────

interface BuiltinAnswer {
  pattern: RegExp;
  products?: string[];
  answer: string;
  source: string;
  score: number;
}

const SANGFOR_BUILTIN_ANSWERS: BuiltinAnswer[] = [
  {
    pattern: /usb|device control|storage media/i,
    products: ['EPP', 'ENDPOINT_SECURE'],
    answer: 'EPP USB/저장매체 제어는 Policies > General Policies > Endpoint Control > USB Device Control 메뉴에서 정책을 설정합니다. 허용/차단 목록과 예외 장치를 정의한 뒤 정책을 배포하세요.',
    source: 'Sangfor EPP Admin Guide',
    score: 0.88,
  },
  {
    pattern: /malware|anti.?virus|scan/i,
    products: ['EPP', 'ENDPOINT_SECURE'],
    answer: '악성코드 검사는 Defense > Malware Scan에서 스캔 정책과 예약 검사를 구성합니다. 엔진 업데이트 상태는 System > Update Management에서 확인합니다.',
    source: 'Sangfor EPP Admin Guide',
    score: 0.86,
  },
  {
    pattern: /app control|software control|unauthorized/i,
    products: ['EPP', 'ENDPOINT_SECURE'],
    answer: '미승인 소프트웨어 통제는 Policies > App Control에서 허용/차단 애플리케이션 목록을 정의합니다.',
    source: 'Sangfor EPP Admin Guide',
    score: 0.85,
  },
  {
    pattern: /url|internet|web filter|dlp/i,
    products: ['IAG'],
    answer: 'IAG URL/인터넷 정책은 Policy > URL/Application Control 또는 Policy > Access Control에서 설정합니다.',
    source: 'Sangfor IAG Admin Guide',
    score: 0.84,
  },
  {
    pattern: /agent|deploy|endpoint/i,
    products: ['EPP', 'ENDPOINT_SECURE'],
    answer: '에이전트 배포는 System > Agent Deployment에서 패키지 생성 및 배포 대상 그룹을 지정합니다. Endpoint Inventory에서 온라인/오프라인 상태를 확인합니다.',
    source: 'Sangfor EPP Admin Guide',
    score: 0.83,
  },
];

export class ManualQASystem {
  private ragSearch: (query: string, product?: string) => Promise<any[]>;
  private manualIndex: Map<string, any[]> = new Map();

  constructor(ragSearch: (query: string, product?: string) => Promise<any[]>) {
    this.ragSearch = ragSearch;
  }

  // 메뉴얼 기반 질의응답
  async askQuestion(query: ManualQuery): Promise<ManualAnswer> {
    log.info(`Question: ${query.question} (product: ${query.product || 'all'})`);

    // RAG 검색
    let searchResults = await this.ragSearch(query.question, query.product);

    if (searchResults.length === 0) {
      const builtin = this.findBuiltinAnswer(query);
      if (builtin) {
        searchResults = [builtin];
      }
    }

    // 답변 생성
    const answer = this.generateAnswer(query, searchResults);

    return answer;
  }

  // 메뉴 경로 조회
  async findMenuPath(
    product: string,
    feature: string
  ): Promise<string[]> {
    log.info(`Finding menu path: ${product} - ${feature}`);

    const results = await this.ragSearch(`${product} ${feature} menu path`, product);

    if (results.length > 0) {
      const menuPath = this.extractMenuPath(results[0].content);
      return menuPath;
    }

    return [];
  }

  // 설정 방법 조회
  async findConfiguration(
    product: string,
    feature: string
  ): Promise<string[]> {
    log.info(`Finding configuration: ${product} - ${feature}`);

    const results = await this.ragSearch(`${product} ${feature} configuration setup`, product);

    return results.map(r => r.content);
  }

  // 문제 해결 방법 조회
  async findTroubleshooting(
    product: string,
    issue: string
  ): Promise<string[]> {
    log.info(`Finding troubleshooting: ${product} - ${issue}`);

    const results = await this.ragSearch(`${product} ${issue} troubleshoot error`, product);

    return results.map(r => r.content);
  }

  // 버전별 차이점 조회
  async findVersionDifferences(
    product: string,
    version1: string,
    version2: string
  ): Promise<string[]> {
    log.info(`Finding version differences: ${product} ${version1} vs ${version2}`);

    const results = await this.ragSearch(
      `${product} ${version1} ${version2} changes differences`,
      product
    );

    return results.map(r => r.content);
  }

  // ─── 내부 메서드 ──────────────────────────────────────────────────────────

  private findBuiltinAnswer(query: ManualQuery): { content: string; score: number; metadata: Record<string, string> } | null {
    const product = query.product?.toUpperCase();
    for (const entry of SANGFOR_BUILTIN_ANSWERS) {
      if (!entry.pattern.test(query.question)) continue;
      if (entry.products && product && !entry.products.includes(product)) continue;
      return {
        content: entry.answer,
        score: entry.score,
        metadata: { source: entry.source, section: 'builtin' },
      };
    }
    return null;
  }

  private generateAnswer(query: ManualQuery, searchResults: any[]): ManualAnswer {
    const sources: ManualSource[] = searchResults.map(r => ({
      document: r.metadata?.source || 'Unknown',
      section: r.metadata?.section || '',
      excerpt: r.content.substring(0, 200),
      relevance: r.score || 0.5,
    }));

    const answer = searchResults.length > 0
      ? this.synthesizeAnswer(query.question, searchResults)
      : '관련 정보를 찾을 수 없습니다.';

    const confidence = searchResults.length > 0
      ? Math.min(0.9, searchResults[0].score || 0.5)
      : 0;

    return {
      id: `qa-${Date.now()}`,
      question: query.question,
      answer,
      sources,
      confidence,
      relatedQuestions: this.generateRelatedQuestions(query.question),
    };
  }

  private synthesizeAnswer(question: string, results: any[]): string {
    // 가장 관련성 높은 결과 기반 답변
    const topResult = results[0];
    if (!topResult) return '관련 정보를 찾을 수 없습니다.';

    // 답변 형식화
    const lines: string[] = [];
    lines.push(`**질문**: ${question}`);
    lines.push('');
    lines.push('**답변**:');
    lines.push(topResult.content.substring(0, 500));

    if (results.length > 1) {
      lines.push('');
      lines.push('**추가 정보**:');
      for (let i = 1; i < Math.min(3, results.length); i++) {
        lines.push(`- ${results[i].content.substring(0, 100)}...`);
      }
    }

    return lines.join('\n');
  }

  private extractMenuPath(content: string): string[] {
    // 메뉴 경로 추출 로직
    const menuPatterns = [
      /메뉴[:\s]+(.+)/,
      /Menu[:\s]+(.+)/i,
      /경로[:\s]+(.+)/,
      /Path[:\s]+(.+)/i,
    ];

    for (const pattern of menuPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].split('>').map(s => s.trim());
      }
    }

    return [];
  }

  private generateRelatedQuestions(question: string): string[] {
    const related: string[] = [];
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('설정') || lowerQuestion.includes('설정')) {
      related.push(`${question} - 상세 설정 방법은?`);
      related.push(`${question} - 관련 정책은?`);
    }

    if (lowerQuestion.includes('오류') || lowerQuestion.includes('에러')) {
      related.push(`${question} - 해결 방법은?`);
      related.push(`${question} - 로그 확인 방법은?`);
    }

    return related;
  }
}
