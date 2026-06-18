/**
 * Scenario DB — 시나리오 파일 기반 관리
 *
 * YAML 파일에서 시나리오를 로드/저장/검색하는 핵심 모듈.
 * MANUAL_EXTRACT, DEVICE_DISCOVERY, Integuru HAR 등 다양한 소스에서
 * 생성된 시나리오를 통합 관리.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('scenario-db');

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type ScenarioSource =
  | 'knowledge_base'
  | 'manual_extract'
  | 'device_discovery'
  | 'integuru_har'
  | 'hand_written';

export interface ScenarioSetting {
  type: 'toggle' | 'select' | 'input' | 'checkbox' | 'click_button';
  label: string;
  value?: string | boolean;
  selector?: string;
  description?: string;
  auditItems?: string[];
  waitAfter?: number;
}

export interface ScenarioAPIEndpoint {
  method: string;
  url: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  authType?: 'bearer' | 'basic' | 'cookie';
  responseField?: string;
  discoveredBy?: string;
  discoveredAt?: string;
  confidence?: number;
}

export interface Scenario {
  id: string;
  product: 'EPP' | 'IAG' | 'CC';
  feature: string;
  description: string;
  source: {
    type: ScenarioSource;
    url?: string;
    extractedAt?: string;
    confidence: number;
  };
  menuPath: string[];
  hashRoute?: string;
  apiEndpoint?: ScenarioAPIEndpoint;
  settings: ScenarioSetting[];
  validation: {
    method: 'api' | 'webui' | 'manual';
    criteria: string[];
  };
  prerequisites?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  approvalRequired?: boolean;
  // 실장비 검증 결과
  verification?: {
    lastVerified?: string;
    result?: 'pass' | 'partial' | 'fail';
    uiMatch?: boolean;
    apiMatch?: boolean;
    notes?: string[];
  };
}

export interface ScenarioIndexEntry {
  id: string;
  product: string;
  feature: string;
  source: ScenarioSource;
  hasAPI: boolean;
  lastVerified?: string;
}

// ─── 시나리오 DB ──────────────────────────────────────────────────────────────

export class ScenarioDB {
  private dbPath: string;
  private cache: Map<string, Scenario> = new Map();
  private indexCache: ScenarioIndexEntry[] | null = null;

  constructor(dbPath: string = 'data/scenarios') {
    this.dbPath = dbPath;
  }

  // ── 초기화 ──

  init(): void {
    for (const product of ['epp', 'iag', 'cc']) {
      const dir = join(this.dbPath, product);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    log.info(`ScenarioDB initialized: ${this.dbPath}`);
  }

  // ── 로드 ──

  loadAll(): Scenario[] {
    this.cache.clear();
    const scenarios: Scenario[] = [];

    for (const product of ['epp', 'iag', 'cc']) {
      const dir = join(this.dbPath, product);
      if (!existsSync(dir)) continue;

      for (const file of readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
        const scenario = this.loadFile(join(dir, file));
        if (scenario) {
          this.cache.set(scenario.id, scenario);
          scenarios.push(scenario);
        }
      }
    }

    log.info(`Loaded ${scenarios.length} scenarios`);
    return scenarios;
  }

  // ── 조회 ──

  get(id: string): Scenario | null {
    return this.cache.get(id) ?? null;
  }

  findByProduct(product: string): Scenario[] {
    const upper = product.toUpperCase();
    return Array.from(this.cache.values()).filter(s => s.product === upper);
  }

  findByFeature(feature: string): Scenario | null {
    const lower = feature.toLowerCase();
    return Array.from(this.cache.values()).find(s =>
      s.feature.toLowerCase().includes(lower) ||
      s.id.toLowerCase().includes(lower),
    ) ?? null;
  }

  findByAuditItem(auditItem: string): Scenario[] {
    return Array.from(this.cache.values()).filter(s =>
      s.settings.some(setting =>
        setting.auditItems?.some(a => auditItem.includes(a) || a.includes(auditItem)),
      ),
    );
  }

  findByMenuPath(menuPath: string[]): Scenario[] {
    return Array.from(this.cache.values()).filter(s =>
      s.menuPath.length === menuPath.length &&
      s.menuPath.every((p, i) => p === menuPath[i]),
    );
  }

  list(): ScenarioIndexEntry[] {
    if (this.indexCache) return this.indexCache;
    this.indexCache = Array.from(this.cache.values()).map(s => ({
      id: s.id,
      product: s.product,
      feature: s.feature,
      source: s.source.type,
      hasAPI: !!s.apiEndpoint,
      lastVerified: s.verification?.lastVerified,
    }));
    return this.indexCache;
  }

  // ── 저장 ──

  save(scenario: Scenario): void {
    const dir = join(this.dbPath, scenario.product.toLowerCase());
    mkdirSync(dir, { recursive: true });

    const path = join(dir, `${scenario.id}.yaml`);
    const yaml = this.toYAML(scenario);
    writeFileSync(path, yaml, 'utf8');

    this.cache.set(scenario.id, scenario);
    this.indexCache = null;

    log.info(`Saved scenario: ${scenario.id} → ${path}`);
  }

  saveBatch(scenarios: Scenario[]): number {
    let count = 0;
    for (const s of scenarios) {
      this.save(s);
      count++;
    }
    return count;
  }

  // ── 인덱스 관리 ──

  rebuildIndex(): void {
    const entries = this.list();
    const indexPath = join(this.dbPath, '_index.json');
    writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf8');
    log.info(`Index rebuilt: ${entries.length} scenarios`);
  }

  // ── 시나리오 업데이트 ──

  updateVerification(id: string, result: Scenario['verification']): void {
    const scenario = this.cache.get(id);
    if (!scenario) throw new Error(`Scenario not found: ${id}`);
    scenario.verification = result;
    this.save(scenario);
  }

  updateAPIEndpoint(id: string, endpoint: ScenarioAPIEndpoint): void {
    const scenario = this.cache.get(id);
    if (!scenario) throw new Error(`Scenario not found: ${id}`);
    scenario.apiEndpoint = endpoint;
    this.save(scenario);
  }

  mergeScenario(newScenario: Scenario): void {
    const existing = this.cache.get(newScenario.id);
    if (!existing) {
      this.save(newScenario);
      return;
    }

    // API 정보가 있으면 추가/업데이트
    if (newScenario.apiEndpoint && !existing.apiEndpoint) {
      existing.apiEndpoint = newScenario.apiEndpoint;
    }

    // 검증 정보 업데이트
    if (newScenario.verification) {
      existing.verification = newScenario.verification;
    }

    // source confidence가 높으면 업데이트
    if (newScenario.source.confidence > existing.source.confidence) {
      existing.source = newScenario.source;
    }

    this.save(existing);
  }

  // ── 파일 I/O ──

  private loadFile(path: string): Scenario | null {
    try {
      const content = readFileSync(path, 'utf8');
      return this.parseYAML(content);
    } catch (err) {
      log.warn(`Failed to load ${path}: ${err}`);
      return null;
    }
  }

  // ── YAML 파서/시리얼라이저 (간이 구현) ──

  private parseYAML(content: string): Scenario | null {
    try {
      // YAML을 JSON으로 변환하는 간이 파서
      // 실제 프로젝트에서는 js-yaml 라이브러리 사용 권장
      const lines = content.split('\n');
      const cleaned = lines
        .filter(l => !l.trim().startsWith('#') || l.trim().startsWith('# '))
        .join('\n');

      // 중괄호 {} 표기법을 JSON으로 변환
      const json = cleaned
        .replace(/:\s*\{([^}]*)\}/g, (_, inner) => {
          const pairs = inner.split(',').map((p: string) => {
            const [k, v] = p.split(':').map((s: string) => s.trim());
            const val = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
            return `"${k}": ${JSON.stringify(val)}`;
          });
          return `: {${pairs.join(', ')}}`;
        });

      // YAML 키-값 파싱 (간이)
      const result: Record<string, unknown> = {};
      let currentSection = result;
      const sectionStack: Record<string, unknown>[] = [result];
      const indent = 0;

      for (const line of cleaned.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#')) continue;

        const match = line.match(/^(\s*)([\w_]+):\s*(.*)/);
        if (!match) continue;

        const [, spaces, key, value] = match;
        const lineIndent = spaces.length;

        if (value && value.trim()) {
          // 값이 있는 경우
          const trimmed = value.trim();
          if (trimmed === 'true') currentSection[key] = true;
          else if (trimmed === 'false') currentSection[key] = false;
          else if (!isNaN(Number(trimmed))) currentSection[key] = Number(trimmed);
          else currentSection[key] = trimmed.replace(/^["']|["']$/g, '');
        } else {
          // 하위 섹션
          const newSection: Record<string, unknown> = {};
          currentSection[key] = newSection;
          sectionStack.push(newSection);
          currentSection = newSection;
        }
      }

      return result as unknown as Scenario;
    } catch {
      // 파싱 실패 시 null 반환
      return null;
    }
  }

  private toYAML(scenario: Scenario, indent: number = 0): string {
    const pad = '  '.repeat(indent);
    const lines: string[] = [];

    lines.push(`${pad}id: ${scenario.id}`);
    lines.push(`${pad}product: ${scenario.product}`);
    lines.push(`${pad}feature: "${scenario.feature}"`);
    lines.push(`${pad}description: "${scenario.description}"`);
    lines.push('');

    // source
    lines.push(`${pad}source:`);
    lines.push(`${pad}  type: ${scenario.source.type}`);
    if (scenario.source.url) lines.push(`${pad}  url: "${scenario.source.url}"`);
    lines.push(`${pad}  confidence: ${scenario.source.confidence}`);
    lines.push('');

    // menuPath
    lines.push(`${pad}menuPath:`);
    for (const p of scenario.menuPath) {
      lines.push(`${pad}  - "${p}"`);
    }

    if (scenario.hashRoute) {
      lines.push(`${pad}hashRoute: "${scenario.hashRoute}"`);
    }
    lines.push('');

    // apiEndpoint
    if (scenario.apiEndpoint) {
      lines.push(`${pad}apiEndpoint:`);
      lines.push(`${pad}  method: ${scenario.apiEndpoint.method}`);
      lines.push(`${pad}  url: "${scenario.apiEndpoint.url}"`);
      if (scenario.apiEndpoint.authType) lines.push(`${pad}  authType: ${scenario.apiEndpoint.authType}`);
      if (scenario.apiEndpoint.payload) {
        lines.push(`${pad}  payload:`);
        for (const [k, v] of Object.entries(scenario.apiEndpoint.payload)) {
          lines.push(`${pad}    ${k}: ${JSON.stringify(v)}`);
        }
      }
      if (scenario.apiEndpoint.confidence) {
        lines.push(`${pad}  confidence: ${scenario.apiEndpoint.confidence}`);
      }
      lines.push('');
    }

    // settings
    lines.push(`${pad}settings:`);
    for (const s of scenario.settings) {
      lines.push(`${pad}  - type: ${s.type}`);
      lines.push(`${pad}    label: "${s.label}"`);
      if (s.value !== undefined) lines.push(`${pad}    value: ${JSON.stringify(s.value)}`);
      if (s.selector) lines.push(`${pad}    selector: "${s.selector}"`);
      if (s.description) lines.push(`${pad}    description: "${s.description}"`);
      if (s.auditItems && s.auditItems.length) {
        lines.push(`${pad}    auditItems:`);
        for (const a of s.auditItems) {
          lines.push(`${pad}      - "${a}"`);
        }
      }
    }
    lines.push('');

    // validation
    lines.push(`${pad}validation:`);
    lines.push(`${pad}  method: ${scenario.validation.method}`);
    lines.push(`${pad}  criteria:`);
    for (const c of scenario.validation.criteria) {
      lines.push(`${pad}    - "${c}"`);
    }

    // verification
    if (scenario.verification) {
      lines.push('');
      lines.push(`${pad}verification:`);
      if (scenario.verification.lastVerified) {
        lines.push(`${pad}  lastVerified: "${scenario.verification.lastVerified}"`);
      }
      if (scenario.verification.result) {
        lines.push(`${pad}  result: ${scenario.verification.result}`);
      }
      if (scenario.verification.uiMatch !== undefined) {
        lines.push(`${pad}  uiMatch: ${scenario.verification.uiMatch}`);
      }
      if (scenario.verification.apiMatch !== undefined) {
        lines.push(`${pad}  apiMatch: ${scenario.verification.apiMatch}`);
      }
      if (scenario.verification.notes && scenario.verification.notes.length) {
        lines.push(`${pad}  notes:`);
        for (const n of scenario.verification.notes) {
          lines.push(`${pad}    - "${n}"`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }
}
