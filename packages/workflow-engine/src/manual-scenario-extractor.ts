/**
 * Manual Scenario Extractor — 매뉴얼 → 시나리오 자동 추출
 *
 * KB 문서, 매뉴얼 PDF, Obsidian 노트 등에서
 * 설정 시나리오를 자동으로 추출하여 ScenarioDB에 저장.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, nowId, nowISO } from '@sangfor/workflow-shared';
import type { Scenario, ScenarioSetting, ScenarioSource } from './scenario-db.js';
import { ScenarioDB } from './scenario-db.js';
import type { Playbook } from './playbook-schema.js';
import { validatePlaybook } from './playbook-schema.js';

const log = createLogger('scenario-extractor');

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface ExtractionSource {
  type: 'kb_article' | 'pdf' | 'obsidian_note' | 'community_thread' | 'text';
  content: string;
  url?: string;
  title?: string;
  product?: string;
}

export interface ExtractionResult {
  scenarios: Scenario[];
  source: ExtractionSource;
  extractedAt: string;
  llmTokensUsed?: number;
}

// ─── 감사항목 → 시나리오 패턴 매핑 ───────────────────────────────────────────

const AUDIT_PATTERNS: Array<{
  pattern: RegExp;
  product: 'EPP' | 'IAG' | 'CC';
  feature: string;
  menuPath: string[];
  hashRoute: string;
  defaultSettings: ScenarioSetting[];
  validationCriteria: string[];
}> = [
  {
    pattern: /malware|악성코드|anti.?virus|바이러스|ransomware|랜섬웨어/i,
    product: 'EPP',
    feature: 'Anti-Virus / Malware Protection',
    menuPath: ['Defense', 'Malware Scan'],
    hashRoute: '#/policy/antiMalware',
    defaultSettings: [
      { type: 'checkbox', label: '실시간 보호', value: true, auditItems: ['Malware Infection Prevention'] },
      { type: 'select', label: '엔진 업데이트', value: '자동' },
      { type: 'checkbox', label: '격리 활성화', value: true },
    ],
    validationCriteria: ['실시간 보호 활성화', '엔진 업데이트 자동'],
  },
  {
    pattern: /software.?control|소프트웨어.?통제|unauthorized.?software|비인가/i,
    product: 'EPP',
    feature: 'Application Control',
    menuPath: ['Policies', 'App Control'],
    hashRoute: '#/policy/appControl',
    defaultSettings: [
      { type: 'checkbox', label: '비인가 소프트웨어 차단', value: true, auditItems: ['Software Control'] },
      { type: 'checkbox', label: '화이트리스트 모드', value: true },
    ],
    validationCriteria: ['비인가 소프트웨어 차단', '화이트리스트 설정'],
  },
  {
    pattern: /device.?control|장치.?통제|usb|저장.?매체|usb.?device/i,
    product: 'EPP',
    feature: 'Device Control',
    menuPath: ['Policies', 'Behavior Control'],
    hashRoute: '#/policy/deviceControl',
    defaultSettings: [
      { type: 'checkbox', label: 'USB 저장 장치 차단', value: true, auditItems: ['Device Control', 'USB Device Control'] },
      { type: 'checkbox', label: 'CD/DVD 차단', value: true },
      { type: 'checkbox', label: '장치 접근 로그', value: true },
    ],
    validationCriteria: ['USB 차단', 'CD 차단', '장치 접근 로그'],
  },
  {
    pattern: /syslog|log.?export|로그.?전송|siem/i,
    product: 'EPP',
    feature: 'Syslog Settings',
    menuPath: ['System', 'Data Sync', 'Syslog Reporting'],
    hashRoute: '#/system/dataSync',
    defaultSettings: [
      { type: 'checkbox', label: 'Syslog 활성화', value: true, auditItems: ['Log Settings', 'Syslog'] },
      { type: 'input', label: 'Syslog 서버', value: '' },
    ],
    validationCriteria: ['Syslog 활성화', '서버 설정'],
  },
  {
    pattern: /url.?filter|url.?차단|웹.?필터|web.?filter/i,
    product: 'IAG',
    feature: 'URL Filtering',
    menuPath: ['Security', 'URL Filtering'],
    hashRoute: '#/policy/urlFilter',
    defaultSettings: [
      { type: 'checkbox', label: 'URL 필터링 활성화', value: true, auditItems: ['URL Filtering'] },
      { type: 'checkbox', label: '악성 URL 차단', value: true },
    ],
    validationCriteria: ['URL 필터링 활성화', '악성 URL 차단'],
  },
  {
    pattern: /dlp|data.?loss|데이터.?유출|정보.?유출/i,
    product: 'IAG',
    feature: 'Data Loss Prevention',
    menuPath: ['Activity Audit', 'DLP Policy'],
    hashRoute: '#/activityAudit/dlpPolicy',
    defaultSettings: [
      { type: 'checkbox', label: 'DLP 활성화', value: true, auditItems: ['Data Loss Prevention', 'DLP'] },
      { type: 'checkbox', label: '키워드 탐지', value: true },
    ],
    validationCriteria: ['DLP 활성화', '키워드 탐지'],
  },
  {
    pattern: /network.?access|접근.?통제|nac|네트워크.?접근/i,
    product: 'IAG',
    feature: 'Network Access Control',
    menuPath: ['Online Activities', 'Access Policy'],
    hashRoute: '#/onlineActivities/accessPolicy',
    defaultSettings: [
      { type: 'checkbox', label: 'NAC 활성화', value: true, auditItems: ['Network Access Control'] },
      { type: 'checkbox', label: '미인증 장치 격리', value: true },
    ],
    validationCriteria: ['NAC 활성화', '미인증 장치 격리'],
  },
  {
    pattern: /log.?management|로그.?관리|보존|retention/i,
    product: 'CC',
    feature: 'Log Management',
    menuPath: ['System', 'Log Settings'],
    hashRoute: '#/system/logSettings',
    defaultSettings: [
      { type: 'checkbox', label: '중앙 로그 수집', value: true, auditItems: ['Log Management'] },
      { type: 'select', label: '로그 보존 기간', value: '365일' },
    ],
    validationCriteria: ['중앙 로그 수집', '로그 보존 1년'],
  },
  {
    pattern: /security.?monitor|보안.?모니터|이상.?탐지|anomaly/i,
    product: 'CC',
    feature: 'Security Monitoring',
    menuPath: ['Detection', 'Monitoring'],
    hashRoute: '#/detection/monitoring',
    defaultSettings: [
      { type: 'checkbox', label: '이상 탐지 활성화', value: true, auditItems: ['Security Monitoring'] },
      { type: 'select', label: '알림 임계값', value: '중간' },
    ],
    validationCriteria: ['이상 탐지 활성화', '알림 임계값 설정'],
  },
];

// ─── ManualScenarioExtractor ────────────────────────────────────────────────

export class ManualScenarioExtractor {
  private llmEndpoint: string;
  private llmApiKey: string;
  private llmModel: string;
  private scenarioDB: ScenarioDB;

  constructor(options: {
    scenarioDB: ScenarioDB;
    llmEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
  }) {
    this.scenarioDB = options.scenarioDB;
    const useMimo = !options.llmEndpoint || options.llmEndpoint.includes('xiaomimimo');
    this.llmEndpoint = options.llmEndpoint
      ?? process.env.LLM_ENDPOINT
       ?? (useMimo ? 'https://api.xiaomimimo.com/v1/chat/completions' : 'http://localhost:1234/v1/chat/completions');
    this.llmApiKey = options.llmApiKey
      ?? process.env.XIAOMI_API_KEY
       ?? process.env.OPENAI_API_KEY
       ?? (useMimo ? '' : 'lm-studio');
    this.llmModel = options.llmModel
      ?? process.env.LLM_MODEL
       ?? (useMimo ? 'mimo-v2-flash' : 'local-model');
  }

  // ── 1단계: 패턴 기반 빠른 추출 (LLM 불필요) ──

  extractByPattern(content: string, source: ExtractionSource): Scenario[] {
    const scenarios: Scenario[] = [];

    for (const pattern of AUDIT_PATTERNS) {
      if (!pattern.pattern.test(content)) continue;

      const id = `${pattern.product.toLowerCase()}_${pattern.feature
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+$/, '')}`;

      scenarios.push({
        id,
        product: pattern.product,
        feature: pattern.feature,
        description: `${pattern.feature} 설정 — ${source.title ?? '문서에서 추출'}`,
        source: {
          type: source.type as ScenarioSource,
          url: source.url,
          extractedAt: nowISO(),
          confidence: 0.6,
        },
        menuPath: pattern.menuPath,
        hashRoute: pattern.hashRoute,
        settings: pattern.defaultSettings,
        validation: {
          method: 'webui',
          criteria: pattern.validationCriteria,
        },
        prerequisites: [],
        riskLevel: 'medium',
        approvalRequired: true,
      });
    }

    return scenarios;
  }

  // ── 2단계: LLM 기반 정밀 추출 ──

  async extractByLLM(content: string, source: ExtractionSource): Promise<Scenario[]> {
    const prompt = `
You are a Sangfor security product engineer analyzing a manual document.

Product hint: ${source.product ?? 'unknown'}
Document title: ${source.title ?? 'untitled'}
Document type: ${source.type}

Content:
---
${content.slice(0, 6000)}
---

Extract ALL configurable settings from this document. For each setting group, output:
{
  "product": "EPP|IAG|CC",
  "feature": "feature name",
  "description": "what this setting does",
  "menuPath": ["Menu", "Submenu"],
  "hashRoute": "#/route",
  "settings": [
    {
      "type": "checkbox|select|input|toggle",
      "label": "UI label as shown in console",
      "value": true/false/"value",
      "description": "what this action does",
      "auditItems": ["relevant audit item names"]
    }
  ],
  "validationCriteria": ["criterion 1", "criterion 2"],
  "riskLevel": "low|medium|high|critical"
}

Return a JSON array. Only include settings that can be automated via UI.
`;

    try {
      const response = await this.callLLM(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        product: string;
        feature: string;
        description: string;
        menuPath: string[];
        hashRoute: string;
        settings: Array<{ type: string; label: string; value: unknown; description?: string; auditItems?: string[] }>;
        validationCriteria: string[];
        riskLevel: string;
      }>;

      return parsed.map(s => ({
        id: `${s.product.toLowerCase()}_${s.feature
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/_+$/, '')}`,
        product: s.product.toUpperCase() as 'EPP' | 'IAG' | 'CC',
        feature: s.feature,
        description: s.description,
        source: {
          type: source.type as ScenarioSource,
          url: source.url,
          extractedAt: nowISO(),
          confidence: 0.8,
        },
        menuPath: s.menuPath,
        hashRoute: s.hashRoute,
        settings: s.settings.map(setting => ({
          type: setting.type as ScenarioSetting['type'],
          label: setting.label,
          value: setting.value as string | boolean,
          description: setting.description,
          auditItems: setting.auditItems,
        })),
        validation: {
          method: 'webui' as const,
          criteria: s.validationCriteria,
        },
        prerequisites: [],
        riskLevel: (s.riskLevel as Scenario['riskLevel']) ?? 'medium',
        approvalRequired: true,
      }));
    } catch (err) {
      log.warn(`LLM 추출 실패: ${err}`);
      return [];
    }
  }

  // ── 3단계: 통합 추출 (패턴 + LLM) ──

  async extract(source: ExtractionSource): Promise<ExtractionResult> {
    log.info(`시나리오 추출 시작: ${source.type} — ${source.title ?? 'untitled'}`);

    // 패턴 기반 빠른 추출
    const patternScenarios = this.extractByPattern(source.content, source);
    log.info(`패턴 기반 추출: ${patternScenarios.length}개`);

    // LLM 기반 정밀 추출
    const llmScenarios = await this.extractByLLM(source.content, source);
    log.info(`LLM 기반 추출: ${llmScenarios.length}개`);

    // 중복 제거 (패턴 기반 우선)
    const merged = this.mergeScenarios(patternScenarios, llmScenarios);

    return {
      scenarios: merged,
      source,
      extractedAt: nowISO(),
    };
  }

  // ── 4단계: 파일에서 추출 ──

  async extractFromFile(filePath: string, product?: string): Promise<ExtractionResult> {
    if (!existsSync(filePath)) {
      throw new Error(`파일 없음: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf8');
    const ext = filePath.split('.').pop()?.toLowerCase();

    return this.extract({
      type: ext === 'md' ? 'obsidian_note' : ext === 'pdf' ? 'pdf' : 'text',
      content,
      url: filePath,
      title: filePath.split('/').pop(),
      product,
    });
  }

  // ── 5단계: 추출 결과를 DB에 저장 ──

  async saveToDB(result: ExtractionResult): Promise<number> {
    let saved = 0;
    for (const scenario of result.scenarios) {
      this.scenarioDB.mergeScenario(scenario);
      saved++;
    }
    log.info(`DB 저장 완료: ${saved}개 시나리오`);
    return saved;
  }

  // ── 내부 헬퍼 ──

  private mergeScenarios(patternScenarios: Scenario[], llmScenarios: Scenario[]): Scenario[] {
    const merged = new Map<string, Scenario>();

    // 패턴 기반 먼저 (높은 우선순위)
    for (const s of patternScenarios) {
      merged.set(s.id, s);
    }

    // LLM 기반은 없는 것만 추가
    for (const s of llmScenarios) {
      if (!merged.has(s.id)) {
        merged.set(s.id, s);
      } else {
        // 기존 시나리오에 LLM 정보 보강
        const existing = merged.get(s.id)!;
        if (s.description.length > existing.description.length) {
          existing.description = s.description;
        }
        // LLM이 발견한 새 설정 액션 추가
        for (const setting of s.settings) {
          if (!existing.settings.some((e: ScenarioSetting) => e.label === setting.label)) {
            existing.settings.push(setting);
          }
        }
      }
    }

    return Array.from(merged.values());
  }

  // ── 6단계: 시나리오 → 플레이북 변환 ──

  convertScenarioToPlaybook(scenario: Scenario): Playbook {
    const steps = scenario.settings.map((setting, index) => ({
      id: nowId('step'),
      title: setting.label,
      description: setting.description ?? `${setting.label} 설정 변경`,
      adapter: 'ui' as const,
      action: this.settingTypeToAction(setting.type),
      input: {
        label: setting.label,
        value: setting.value ?? '',
        ...(setting.selector ? { selector: setting.selector } : {}),
      },
      expectedChange: {
        field: setting.label,
        before: null as string | number | boolean | null,
        after: setting.value ?? true,
      },
      order: index + 1,
    }));

    const postchecks = scenario.validation.criteria.map((criterion, index) => ({
      id: `postcheck_${index + 1}`,
      description: criterion,
      type: 'state_match' as const,
      expectedValue: true,
    }));

    const playbook: Playbook = {
      id: scenario.id,
      product: scenario.product as Playbook['product'],
      capability: scenario.feature,
      riskLevel: (scenario.riskLevel as Playbook['riskLevel']) ?? 'medium',
      prechecks: [],
      steps,
      postchecks,
      rollback: [],
      approval: {
        required: scenario.approvalRequired ?? true,
        reason: `${scenario.feature} 설정 변경 — ${scenario.product}`,
      },
      source: 'manual_extract',
      metadata: {
        createdAt: scenario.source.extractedAt,
        tags: scenario.menuPath,
      },
      description: scenario.description,
    };

    const validation = validatePlaybook(playbook);
    if (!validation.valid) {
      log.warn(`Playbook validation warnings for ${playbook.id}: ${validation.errors.map(e => e.message).join('; ')}`);
    }

    return playbook;
  }

  /**
   * 추출된 시나리오를 플레이북으로 변환 후 등록
   */
  convertExtractionToPlaybooks(result: ExtractionResult): Playbook[] {
    return result.scenarios.map(s => this.convertScenarioToPlaybook(s));
  }

  private settingTypeToAction(type: ScenarioSetting['type']): string {
    const actionMap: Record<ScenarioSetting['type'], string> = {
      toggle: 'toggle_setting',
      checkbox: 'set_checkbox',
      select: 'select_option',
      input: 'fill_input',
      click_button: 'click_element',
    };
    return actionMap[type];
  }

  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch(this.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.llmApiKey}`,
      },
      body: JSON.stringify({
        model: this.llmModel,
        messages: [
          { role: 'system', content: 'You are an expert at extracting configuration scenarios from Sangfor product manuals.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`LLM API ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
