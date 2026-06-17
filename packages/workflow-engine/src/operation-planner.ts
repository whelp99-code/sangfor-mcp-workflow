/**
 * Operation Planner — 사용자 의도를 분석하여 실행 가능한 OperationPlan 생성
 *
 * 핵심 규칙:
 * 1. snapshot 없이 plan 실행 단계로 넘어가지 않도록 강제
 * 2. AI 응답을 그대로 실행하지 않고 schema validation 거침
 *
 * Canonical 타입 매핑:
 * - UserIntent: action(IntentAction), target(string), parameters(Record), rawText(string)
 * - DeviceSnapshot: deviceId, product(SangforProduct), version, objects, policies, ...
 * - DeviceCapability: product(SangforProduct), capabilities(string[])
 * - OperationPlan: id, intent, deviceId, desiredState, prechecks(OperationCheck[]),
 *                  steps(OperationStep[]), postchecks(OperationCheck[]), rollback,
 *                  risk(OperationRisk), approval, evidencePolicy
 * - OperationStep: id, title, capability, adapter, action, input, expectedChange,
 *                  idempotencyKey, retryPolicy, requiresApproval
 * - OperationRisk: level, categories, mitigation(string)
 * - DryRunPlan: planId, steps[{stepId,title,adapter,action,estimatedDuration}],
 *               estimatedDuration, riskSummary
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  UserIntent,
  IntentAction,
  DeviceSnapshot,
  DeviceCapability,
  Playbook,
  OperationPlan,
  OperationStep,
  OperationCheck,
  OperationRisk,
  DryRunPlan,
  ValidationResult,
  ProductCode,
  RiskLevel,
  DesiredState,
  ApprovalRequirement,
  EvidencePolicy,
} from './types.js';

const log = createLogger('operation-planner');

// ─── Intent 파싱을 위한 키워드 매핑 ────────────────────────────────────────

const ACTION_KEYWORDS: Record<string, IntentAction> = {
  '설정': 'configure',
  '적용': 'configure',
  '구성': 'configure',
  'configure': 'configure',
  'setup': 'configure',
  '배포': 'configure',
  '설치': 'configure',
  'deploy': 'configure',
  'install': 'configure',
  '검증': 'verify',
  '확인': 'verify',
  'verify': 'verify',
  'check': 'verify',
  '감사': 'verify',
  '점검': 'verify',
  'audit': 'verify',
  '모니터링': 'discover',
  '감시': 'discover',
  'monitor': 'discover',
  '복구': 'remediate',
  '수정': 'remediate',
  'remediate': 'remediate',
};

const PRODUCT_KEYWORDS: Record<string, ProductCode> = {
  'epp': 'ENDPOINT_SECURE',
  'endpoint': 'ENDPOINT_SECURE',
  '엔드포인트': 'ENDPOINT_SECURE',
  'iag': 'IAG',
  '웹필터': 'IAG',
  'cc': 'CYBER_COMMAND',
  '사이버': 'CYBER_COMMAND',
  'cyber': 'CYBER_COMMAND',
  'hci': 'HCI_SCP',
  'scp': 'HCI_SCP',
  'ndr': 'NDR',
};

const FEATURE_KEYWORDS: Record<string, string> = {
  'malware': 'Anti-Virus / Malware Protection',
  '악성코드': 'Anti-Virus / Malware Protection',
  '백신': 'Anti-Virus / Malware Protection',
  'url': 'URL Filtering',
  '웹필터링': 'URL Filtering',
  'dlp': 'Data Loss Prevention',
  '데이터유출': 'Data Loss Prevention',
  'usb': 'Device Control',
  '장치제어': 'Device Control',
  'syslog': 'Syslog Settings',
  '로그': 'Log Management',
};

// ─── OperationPlanner ───────────────────────────────────────────────────────

export class OperationPlanner {
  /**
   * 사용자 의도를 파싱하여 UserIntent 생성
   */
  parseIntent(rawText: string): UserIntent {
    const lower = rawText.toLowerCase();

    // action 추출
    let action: IntentAction = 'configure';
    for (const [keyword, mapped] of Object.entries(ACTION_KEYWORDS)) {
      if (lower.includes(keyword.toLowerCase())) {
        action = mapped;
        break;
      }
    }

    // product 추출 → target
    let target = 'ENDPOINT_SECURE';
    for (const [keyword, mapped] of Object.entries(PRODUCT_KEYWORDS)) {
      if (lower.includes(keyword.toLowerCase())) {
        target = mapped;
        break;
      }
    }

    // feature 추출 → parameters.feature
    let feature = 'General';
    for (const [keyword, mapped] of Object.entries(FEATURE_KEYWORDS)) {
      if (lower.includes(keyword.toLowerCase())) {
        feature = mapped;
        break;
      }
    }

    // 파라미터 추출 (key=value 패턴)
    const parameters: Record<string, string | number | boolean> = { feature };
    const paramPattern = /(\w+)\s*[=:]\s*("[^"]+"|'[^']+'|\S+)/g;
    let match: RegExpExecArray | null = paramPattern.exec(rawText);
    while (match !== null) {
      const key = match[1];
      const value = match[2].replace(/^["']|["']$/g, '');
      parameters[key] = value;
      match = paramPattern.exec(rawText);
    }

    const intent: UserIntent = {
      rawText,
      action,
      target,
      parameters,
    };

    log.info(`Intent 파싱 완료: ${action} ${target}/${feature}`);
    return intent;
  }

  /**
   * intent와 snapshot을 기반으로 적합한 capability 매칭
   */
  matchCapability(intent: UserIntent, snapshot: DeviceSnapshot): DeviceCapability {
    const feature = String(intent.parameters.feature ?? 'General');
    const supported = snapshot.objects.some(
      (o: { name: string }) =>
        o.name.toLowerCase().includes(feature.toLowerCase())
        || feature.toLowerCase().includes(o.name.toLowerCase()),
    );

    return {
      product: snapshot.product,
      capabilities: supported ? [feature] : [],
    };
  }

  /**
   * plan의 필수 입력 검증
   */
  validateRequiredInputs(plan: OperationPlan): ValidationResult {
    const errors: Array<{ field: string; message: string; severity: 'error' }> = [];
    const warnings: Array<{ field: string; message: string; severity: 'warning' }> = [];

    // deviceId 필수 검증
    if (!plan.deviceId) {
      errors.push({ field: 'deviceId', message: 'deviceId가 필요합니다.', severity: 'error' });
    }

    // intent 필수 검증
    if (!plan.intent) {
      errors.push({ field: 'intent', message: 'UserIntent가 필요합니다.', severity: 'error' });
    }

    // steps 검증
    if (!plan.steps || plan.steps.length === 0) {
      errors.push({ field: 'steps', message: '실행 단계가 필요합니다.', severity: 'error' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * intent와 snapshot으로 OperationPlan 생성
   */
  planFromIntent(
    intent: UserIntent,
    snapshot: DeviceSnapshot,
    playbooks: Playbook[],
  ): OperationPlan {
    // intent 검증 (AI 응답을 그대로 실행하지 않고 schema validation)
    this.validateIntentSchema(intent);

    // capability 매칭
    const capability = this.matchCapability(intent, snapshot);
    if (capability.capabilities.length === 0) {
      const feature = String(intent.parameters.feature ?? 'General');
      log.warn(`기능 미지원: ${feature} on ${intent.target}`);
    }

    // 적합한 playbook 찾기
    const playbook = this.findMatchingPlaybook(intent, playbooks);
    if (!playbook) {
      const feature = String(intent.parameters.feature ?? 'General');
      throw new Error(
        `매칭되는 Playbook을 찾을 수 없습니다: ${intent.target}/${feature}`,
      );
    }

    // plan 조립
    const planId = nowId('plan');
    const prechecks = this.assemblePrechecks(planId, playbook);
    const steps = this.assembleSteps(planId, playbook, intent);
    const postchecks = this.assemblePostchecks(planId, playbook);
    const risk = this.generateRiskAssessment(playbook);

    const desiredState: DesiredState = {
      product: snapshot.product,
      settings: { ...intent.parameters },
    };

    const approval: ApprovalRequirement = {
      required: risk.level === 'high' || risk.level === 'critical',
      reason: `위험 수준: ${risk.level}`,
      approverRole: 'admin',
    };

    const evidencePolicy: EvidencePolicy = {
      captureScreenshots: true,
      captureDiff: true,
      generateMarkdown: true,
    };

    const plan: OperationPlan = {
      id: planId,
      intent,
      deviceId: snapshot.deviceId,
      desiredState,
      prechecks,
      steps,
      postchecks,
      rollback: [],
      risk,
      approval,
      evidencePolicy,
    };

    // 최종 검증
    const validation = this.validateRequiredInputs(plan);
    if (!validation.valid) {
      log.warn(`Plan 검증 실패: ${validation.errors.map(e => e.message).join(', ')}`);
    } else {
      log.info(`Plan 생성 완료: ${planId}`);
    }

    if (validation.warnings.length > 0) {
      log.warn(`Plan 경고: ${validation.warnings.map(w => w.message).join(', ')}`);
    }

    return plan;
  }

  /**
   * precheck 단계 조립
   */
  assemblePrechecks(planId: string, playbook: Playbook): OperationCheck[] {
    return playbook.prechecks.map(check => ({
      id: `${planId}_pre_${check.id}`,
      description: check.description,
      checkType: (check.type === 'manual_confirm' ? 'custom' : check.type) as 'state_match' | 'health_pass' | 'custom',
      expected: check.expectedValue,
    }));
  }

  /**
   * 실행 단계 조립
   */
  assembleSteps(planId: string, playbook: Playbook, intent: UserIntent): OperationStep[] {
    return playbook.steps.map(step => ({
      id: `${planId}_step_${step.id}`,
      title: step.title,
      capability: playbook.capability,
      adapter: step.adapter,
      action: step.action,
      input: {
        ...step.input,
        ...intent.parameters,
      },
      expectedChange: step.expectedChange,
      idempotencyKey: `${planId}_${step.id}`,
      retryPolicy: { maxRetries: 3, backoff: 'exponential' as const },
      requiresApproval: false,
    }));
  }

  /**
   * postcheck 단계 조립
   */
  assemblePostchecks(planId: string, playbook: Playbook): OperationCheck[] {
    return playbook.postchecks.map(check => ({
      id: `${planId}_post_${check.id}`,
      description: check.description,
      checkType: (check.type === 'manual_confirm' ? 'custom' : check.type) as 'state_match' | 'health_pass' | 'custom',
      expected: check.expectedValue,
    }));
  }

  /**
   * 위험도 평가
   */
  generateRiskAssessment(playbook: Playbook): OperationRisk {
    const categories: string[] = [];
    const mitigations: string[] = [];
    let level: RiskLevel = playbook.riskLevel;

    // 설정 변경이 있으면 config_change 카테고리 추가
    const hasConfigChange = playbook.steps.some(
      s => s.action.includes('config') || s.action.includes('setting'),
    );
    if (hasConfigChange) {
      categories.push('config_change');
      mitigations.push('설정 변경 전 백업 수행');
      if (level === 'low') level = 'medium';
    }

    // 서비스 영향이 있는 단계 확인
    const hasServiceImpact = playbook.steps.some(
      s => s.action.includes('restart') || s.action.includes('deploy'),
    );
    if (hasServiceImpact) {
      categories.push('service_impact');
      mitigations.push('서비스 중단 시간 최소화');
      if (level === 'medium') level = 'high';
    }

    // 격리/차단 정책
    const hasBlockingPolicy = playbook.steps.some(
      s => s.action.includes('block') || s.action.includes('quarantine'),
    );
    if (hasBlockingPolicy) {
      categories.push('blocking_policy');
      mitigations.push('화이트리스트 사전 확인');
    }

    if (categories.length === 0) {
      categories.push('read_only');
      mitigations.push('읽기 전용 작업');
    }

    return {
      level,
      categories,
      mitigation: mitigations.join('; '),
    };
  }

  /**
   * dry-run plan 생성
   */
  generateDryRunPlan(plan: OperationPlan): DryRunPlan {
    const dryRunSteps = plan.steps.map(step => ({
      stepId: step.id,
      title: step.title,
      adapter: step.adapter,
      action: step.action,
      estimatedDuration: '5s',
    }));

    return {
      planId: plan.id,
      steps: dryRunSteps,
      estimatedDuration: `${dryRunSteps.length * 5}s`,
      riskSummary: `위험 수준: ${plan.risk.level}, 카테고리: ${plan.risk.categories.join(', ')}`,
    };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────────────────────────

  /**
   * intent schema 검증 (AI 응답을 그대로 실행하지 않음)
   */
  private validateIntentSchema(intent: UserIntent): void {
    const requiredFields: Array<keyof UserIntent> = [
      'rawText', 'action', 'target', 'parameters',
    ];

    for (const field of requiredFields) {
      if (intent[field] === undefined || intent[field] === null) {
        throw new Error(`Intent schema 검증 실패: 필수 필드 누락 — ${field}`);
      }
    }

    const validActions: IntentAction[] = ['configure', 'verify', 'remediate', 'discover'];
    if (!validActions.includes(intent.action)) {
      throw new Error(`Intent schema 검증 실패: 유효하지 않은 action — ${intent.action}`);
    }
  }

  /**
   * intent에 매칭되는 playbook 찾기
   */
  private findMatchingPlaybook(intent: UserIntent, playbooks: Playbook[]): Playbook | null {
    const feature = String(intent.parameters.feature ?? 'General');

    // 정확한 매칭
    const exact = playbooks.find(
      p => p.product === intent.target && p.capability === feature,
    );
    if (exact) return exact;

    // 부분 매칭
    const partial = playbooks.find(
      p => p.product === intent.target
        && (p.capability.toLowerCase().includes(feature.toLowerCase())
          || feature.toLowerCase().includes(p.capability.toLowerCase())),
    );
    if (partial) return partial;

    // 제품만 매칭
    return playbooks.find(p => p.product === intent.target) ?? null;
  }
}
