/**
 * Autopilot Policy — 자동 실행 정책 관리 (PR-28)
 *
 * OperationPlan의 자동 승인/거부를 결정하는 정책 엔진.
 * - allowlist: 안전한 작업 자동 승인
 * - denylist: 위험한 작업 자동 차단 (allowlist보다 우선)
 * - product/version별 자동화 허용 조건
 * - 정책 변경 이력 관리
 */

import { nowId, nowISO, createLogger, type RiskLevel } from '@sangfor/workflow-shared';

const log = createLogger('autopilot-policy');

// ─── 타입 ────────────────────────────────────────────────────────────────────

/** Operation Plan (MCP tool surface에서 정의된 계획) */
export interface OperationPlan {
  id: string;
  product: string;
  version: string;
  action: string;
  riskLevel: RiskLevel;
  description: string;
  steps: OperationStep[];
  dryRun: boolean;
  metadata: Record<string, string>;
}

export interface OperationStep {
  name: string;
  toolName: string;
  args: Record<string, string>;
}

/** 정책 규칙 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  /** 대상 제품 (와일드카드 '*' 지원) */
  product: string;
  /** 위험 수준 조건 */
  riskLevel: RiskLevel | '*';
  /** 매칭할 액션 패턴 (정규식) */
  actionPattern: string;
  /** 자동 승인 여부 */
  autoApprove: boolean;
  /** 추가 조건 */
  conditions: PolicyCondition[];
  /** 우선순위 (높을수록 먼저 평가) */
  priority: number;
  /** 활성화 여부 */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
  value: string | string[];
}

/** 자동 조종 결정 */
export interface AutopilotDecision {
  autoApprovable: boolean;
  reason: string;
  matchedRule: PolicyRule | null;
  evaluatedAt: string;
  planId: string;
}

/** 정책 변경 이력 */
export interface PolicyChangeRecord {
  id: string;
  ruleId: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled';
  before: PolicyRule | null;
  after: PolicyRule | null;
  changedBy: string;
  changedAt: string;
  reason: string;
}

// ─── 기본 정책 규칙 ──────────────────────────────────────────────────────────

/** allowlist: 자동 승인 가능한 안전한 작업 */
const DEFAULT_ALLOWLIST: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'read-only-snapshot',
    description: '읽기 전용 장비 상태 수집은 항상 자동 승인',
    product: '*',
    riskLevel: '*',
    actionPattern: '^get_device_snapshot$',
    autoApprove: true,
    conditions: [],
    priority: 100,
    enabled: true,
  },
  {
    name: 'dry-run-plan',
    description: 'Dry-run 모드의 plan 생성은 항상 자동 승인',
    product: '*',
    riskLevel: '*',
    actionPattern: '^plan_configuration_change$',
    autoApprove: true,
    conditions: [
      { field: 'dryRun', operator: 'equals', value: 'true' },
    ],
    priority: 90,
    enabled: true,
  },
  {
    name: 'report-generation',
    description: '보고서 생성은 항상 자동 승인',
    product: '*',
    riskLevel: '*',
    actionPattern: '^generate_evidence_report$',
    autoApprove: true,
    conditions: [],
    priority: 80,
    enabled: true,
  },
  {
    name: 'low-risk-object-creation',
    description: '저위험 객체 생성 자동 승인',
    product: '*',
    riskLevel: 'low',
    actionPattern: '(create|add|register)',
    autoApprove: true,
    conditions: [],
    priority: 70,
    enabled: true,
  },
  {
    name: 'validate-only',
    description: '검증만 수행하는 작업 자동 승인',
    product: '*',
    riskLevel: '*',
    actionPattern: '^validate_operation_plan$',
    autoApprove: true,
    conditions: [],
    priority: 95,
    enabled: true,
  },
];

/** denylist: 절대 자동 승인 불가능한 위험한 작업 */
const DEFAULT_DENYLIST: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'deny-policy-delete',
    description: '정책 삭제는 항상 수동 승인 필요',
    product: '*',
    riskLevel: '*',
    actionPattern: '(delete.*policy|remove.*policy|policy.*delete)',
    autoApprove: false,
    conditions: [],
    priority: 200,
    enabled: true,
  },
  {
    name: 'deny-external-access',
    description: '외부 접근 허용 변경은 항상 수동 승인 필요',
    product: '*',
    riskLevel: '*',
    actionPattern: '(external.*access|allow.*external|open.*port)',
    autoApprove: false,
    conditions: [],
    priority: 200,
    enabled: true,
  },
  {
    name: 'deny-auth-server-change',
    description: '인증 서버 변경은 항상 수동 승인 필요',
    product: '*',
    riskLevel: '*',
    actionPattern: '(auth.*server|ldap.*server|radius.*server|authentication)',
    autoApprove: false,
    conditions: [],
    priority: 200,
    enabled: true,
  },
  {
    name: 'deny-device-restart',
    description: '장비 재시작은 항상 수동 승인 필요',
    product: '*',
    riskLevel: '*',
    actionPattern: '(restart|reboot|shutdown|poweroff)',
    autoApprove: false,
    conditions: [],
    priority: 200,
    enabled: true,
  },
  {
    name: 'deny-high-risk-auto',
    description: 'high-risk 이상 자동 실행 차단',
    product: '*',
    riskLevel: 'high',
    actionPattern: '.*',
    autoApprove: false,
    conditions: [],
    priority: 190,
    enabled: true,
  },
  {
    name: 'deny-critical-risk-auto',
    description: 'critical 위험도 자동 실행 차단',
    product: '*',
    riskLevel: 'critical',
    actionPattern: '.*',
    autoApprove: false,
    conditions: [],
    priority: 195,
    enabled: true,
  },
];

// ─── AutopilotPolicy 클래스 ──────────────────────────────────────────────────

export class AutopilotPolicy {
  private rules: PolicyRule[] = [];
  private changeHistory: PolicyChangeRecord[] = [];

  constructor(options?: { loadDefaults?: boolean }) {
    const loadDefaults = options?.loadDefaults ?? true;
    if (loadDefaults) {
      this.loadDefaultRules();
    }
    log.info(`AutopilotPolicy 초기화: ${this.rules.length}개 규칙 로드`);
  }

  /**
   * OperationPlan을 평가하여 자동 승인 가능 여부를 결정
   *
   * 평가 순서:
   * 1. denylist 먼저 평가 (우선순위 높음)
   * 2. denylist에 매칭되면 즉시 거부
   * 3. allowlist 평가
   * 4. 매칭되는 규칙이 없으면 기본적으로 거부 (안전 우선)
   */
  evaluate(plan: OperationPlan): AutopilotDecision {
    log.info(`정책 평가: plan=${plan.id}, action=${plan.action}, risk=${plan.riskLevel}`);

    // 우선순위 순으로 정렬 (높은 순)
    const sortedRules = [...this.rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!this.matchesRule(plan, rule)) continue;

      const decision: AutopilotDecision = {
        autoApprovable: rule.autoApprove,
        reason: rule.autoApprove
          ? `자동 승인: ${rule.name} — ${rule.description}`
          : `자동 거부: ${rule.name} — ${rule.description}`,
        matchedRule: rule,
        evaluatedAt: nowISO(),
        planId: plan.id,
      };

      log.info(
        `결정: ${decision.autoApprovable ? 'AUTO-APPROVE' : 'DENY'} ` +
        `(규칙: ${rule.name}, 우선순위: ${rule.priority})`,
      );

      return decision;
    }

    // 매칭되는 규칙이 없으면 안전을 위해 거부
    const defaultDecision: AutopilotDecision = {
      autoApprovable: false,
      reason: '매칭되는 자동화 정책이 없어 수동 승인이 필요합니다.',
      matchedRule: null,
      evaluatedAt: nowISO(),
      planId: plan.id,
    };

    log.info(`결정: DENY (기본 정책 — 규칙 미매칭)`);
    return defaultDecision;
  }

  /**
   * 새 정책 규칙 추가
   */
  addRule(rule: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>): PolicyRule {
    const fullRule: PolicyRule = {
      id: nowId('rule'),
      ...rule,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    this.rules.push(fullRule);

    this.recordChange({
      id: nowId('policy_change'),
      ruleId: fullRule.id,
      action: 'created',
      before: null,
      after: fullRule,
      changedBy: 'system',
      changedAt: nowISO(),
      reason: '새 정책 규칙 추가',
    });

    log.info(`규칙 추가: ${fullRule.name} (${fullRule.id})`);
    return fullRule;
  }

  /**
   * 정책 규칙 수정
   */
  updateRule(
    ruleId: string,
    updates: Partial<Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>>,
    changedBy: string,
    reason: string,
  ): PolicyRule {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index === -1) throw new Error(`규칙을 찾을 수 없음: ${ruleId}`);

    const before = { ...this.rules[index] };
    const updated: PolicyRule = {
      ...this.rules[index],
      ...updates,
      updatedAt: nowISO(),
    };
    this.rules[index] = updated;

    this.recordChange({
      id: nowId('policy_change'),
      ruleId,
      action: 'updated',
      before,
      after: updated,
      changedBy,
      changedAt: nowISO(),
      reason,
    });

    log.info(`규칙 수정: ${updated.name} (${ruleId})`);
    return updated;
  }

  /**
   * 정책 규칙 삭제
   */
  deleteRule(ruleId: string, changedBy: string, reason: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;

    const removed = this.rules[index];
    this.rules.splice(index, 1);

    this.recordChange({
      id: nowId('policy_change'),
      ruleId,
      action: 'deleted',
      before: removed,
      after: null,
      changedBy,
      changedAt: nowISO(),
      reason,
    });

    log.info(`규칙 삭제: ${removed.name} (${ruleId})`);
    return true;
  }

  /**
   * 규칙 활성화/비활성화
   */
  setRuleEnabled(ruleId: string, enabled: boolean, changedBy: string): PolicyRule {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index === -1) throw new Error(`규칙을 찾을 수 없음: ${ruleId}`);

    const before = { ...this.rules[index] };
    this.rules[index].enabled = enabled;
    this.rules[index].updatedAt = nowISO();

    this.recordChange({
      id: nowId('policy_change'),
      ruleId,
      action: enabled ? 'enabled' : 'disabled',
      before,
      after: { ...this.rules[index] },
      changedBy,
      changedAt: nowISO(),
      reason: enabled ? '규칙 활성화' : '규칙 비활성화',
    });

    log.info(`규칙 ${enabled ? '활성화' : '비활성화'}: ${this.rules[index].name}`);
    return this.rules[index];
  }

  /**
   * 모든 규칙 조회
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  /**
   * 정책 변경 이력 조회
   */
  getChangeHistory(): PolicyChangeRecord[] {
    return [...this.changeHistory];
  }

  /**
   * 특정 규칙의 변경 이력 조회
   */
  getRuleChangeHistory(ruleId: string): PolicyChangeRecord[] {
    return this.changeHistory.filter(c => c.ruleId === ruleId);
  }

  /**
   * product/version별 자동화 허용 여부를 빠르게 확인
   */
  isProductAutoAllowed(product: string, action: string): boolean {
    const matchingRules = this.rules.filter(
      r =>
        r.enabled &&
        r.autoApprove &&
        (r.product === '*' || r.product === product) &&
        new RegExp(r.actionPattern, 'i').test(action),
    );

    // denylist 규칙이 있으면 거부
    const denyRules = this.rules.filter(
      r =>
        r.enabled &&
        !r.autoApprove &&
        (r.product === '*' || r.product === product) &&
        new RegExp(r.actionPattern, 'i').test(action),
    );

    if (denyRules.length > 0) return false;
    return matchingRules.length > 0;
  }

  // ─── 내부 메서드 ──────────────────────────────────────────────────────────

  /**
   * plan이 rule과 매칭되는지 확인
   */
  private matchesRule(plan: OperationPlan, rule: PolicyRule): boolean {
    // 제품 매칭
    if (rule.product !== '*' && rule.product !== plan.product) {
      return false;
    }

    // 위험 수준 매칭
    if (rule.riskLevel !== '*' && rule.riskLevel !== plan.riskLevel) {
      return false;
    }

    // 액션 패턴 매칭
    const actionRegex = new RegExp(rule.actionPattern, 'i');
    if (!actionRegex.test(plan.action)) {
      return false;
    }

    // 추가 조건 매칭
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(plan, condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 개별 조건 평가
   */
  private evaluateCondition(plan: OperationPlan, condition: PolicyCondition): boolean {
    const fieldValue = this.getFieldValue(plan, condition.field);
    const strValue = String(fieldValue ?? '');

    switch (condition.operator) {
      case 'equals':
        return strValue === String(condition.value);
      case 'not_equals':
        return strValue !== String(condition.value);
      case 'contains':
        return strValue.includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(strValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(strValue);
      default:
        return false;
    }
  }

  /**
   * plan에서 필드 값 추출 (중첩 경로 지원: metadata.dryRun)
   */
  private getFieldValue(plan: OperationPlan, field: string): string | boolean | undefined {
    const parts = field.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-unknown
    let current: unknown = plan;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current as string | boolean | undefined;
  }

  /**
   * 기본 규칙 로드
   */
  private loadDefaultRules(): void {
    for (const rule of DEFAULT_ALLOWLIST) {
      this.rules.push({
        id: nowId('allow'),
        ...rule,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    }

    for (const rule of DEFAULT_DENYLIST) {
      this.rules.push({
        id: nowId('deny'),
        ...rule,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    }
  }

  /**
   * 변경 이력 기록
   */
  private recordChange(record: PolicyChangeRecord): void {
    this.changeHistory.push(record);
  }
}

/**
 * 기본 AutopilotPolicy 인스턴스 생성 팩토리
 */
export function createDefaultAutopilotPolicy(): AutopilotPolicy {
  return new AutopilotPolicy({ loadDefaults: true });
}
