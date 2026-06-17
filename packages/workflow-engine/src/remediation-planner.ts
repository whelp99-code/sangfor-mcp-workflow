/**
 * Remediation Planner — Incident 기반 복구 계획 생성
 *
 * IncidentDetector가 탐지한 Incident를 기반으로
 * Playbook을 매칭하고 복구 계획을 수립하는 모듈.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { RiskLevel } from '@sangfor/workflow-shared';
import type { Incident, IncidentSeverity } from './incident-detector.js';
import type { Playbook, PlaybookStep } from './playbook-schema.js';

const log = createLogger('remediation-planner');

// ─── Remediation Types ─────────────────────────────────────────────────────

export interface RemediationStep {
  id: string;
  order: number;
  title: string;
  description: string;
  playbookId: string;
  playbookStepId: string;
  action: string;
  input: Record<string, string | number | boolean>;
  expectedChange: string;
  dryRunSafe: boolean;
  requiresApproval: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface RollbackPlan {
  steps: RemediationStep[];
  automaticTrigger: boolean;
  triggerCondition: string;
}

export interface RemediationPlan {
  id: string;
  incident: Incident;
  steps: RemediationStep[];
  rollback: RollbackPlan;
  impact: ImpactAnalysis;
  approvalRequired: boolean;
  estimatedDuration: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  metadata: Record<string, unknown>;
}

export interface ImpactAnalysis {
  affectedDevices: string[];
  affectedServices: string[];
  riskLevel: RiskLevel;
  downtimeEstimate: string;
  blastRadius: 'device' | 'service' | 'network' | 'organization';
  prerequisites: string[];
  warnings: string[];
}

// ─── Remediation Planner ───────────────────────────────────────────────────

export class RemediationPlanner {

  /**
   * Incident와 Playbook 목록을 기반으로 복구 계획 생성
   */
  planRemediation(incident: Incident, playbooks: Playbook[]): RemediationPlan {
    log.info(
      `Planning remediation for incident: ${incident.id} ` +
      `(severity: ${incident.severity}, ${playbooks.length} playbooks available)`,
    );

    const matchedPlaybooks = this.matchPlaybooks(incident, playbooks);
    log.info(`Matched ${matchedPlaybooks.length} playbooks for incident ${incident.id}`);

    const steps = this.buildRemediationSteps(incident, matchedPlaybooks);
    const rollbackPlan = this.buildRollbackPlan(matchedPlaybooks);
    const impact = this.analyzeImpact({
      id: 'temp',
      incident,
      steps,
      rollback: rollbackPlan,
      impact: {
        affectedDevices: [],
        affectedServices: [],
        riskLevel: 'low',
        downtimeEstimate: '',
        blastRadius: 'device',
        prerequisites: [],
        warnings: [],
      },
      approvalRequired: false,
      estimatedDuration: '',
      createdAt: '',
      status: 'draft',
      metadata: {},
    });
    const approvalRequired = this.isApprovalRequired(incident.severity, impact);
    const estimatedDuration = this.estimateDuration(steps);

    const plan: RemediationPlan = {
      id: nowId('remediation'),
      incident,
      steps,
      rollback: rollbackPlan,
      impact,
      approvalRequired,
      estimatedDuration,
      createdAt: nowISO(),
      status: 'draft',
      metadata: {
        matchedPlaybookIds: matchedPlaybooks.map(p => p.id),
        incidentSeverity: incident.severity,
      },
    };

    log.info(
      `Remediation plan created: ${plan.id} ` +
      `(${steps.length} steps, approval: ${approvalRequired}, ` +
      `duration: ${estimatedDuration})`,
    );

    return plan;
  }

  /**
   * 복구 계획의 영향도 분석
   */
  analyzeImpact(plan: RemediationPlan): ImpactAnalysis {
    const incident = plan.incident;
    const affectedDevices = [...incident.affectedDevices];

    // affected services 추출
    const affectedServices: string[] = [];
    for (const alert of incident.alerts) {
      const serviceName = this.extractServiceName(alert.itemName);
      if (serviceName && !affectedServices.includes(serviceName)) {
        affectedServices.push(serviceName);
      }
    }

    // blast radius 결정
    const blastRadius = this.determineBlastRadius(incident);

    // risk level 결정
    const riskLevel = this.determineRiskLevel(incident.severity, plan.steps.length);

    // downtime estimate
    const downtimeEstimate = this.estimateDowntime(plan.steps.length, riskLevel);

    // prerequisites
    const prerequisites = this.collectPrerequisites(plan);

    // warnings
    const warnings = this.collectWarnings(incident, plan);

    return {
      affectedDevices,
      affectedServices,
      riskLevel,
      downtimeEstimate,
      blastRadius,
      prerequisites,
      warnings,
    };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────────────────────────

  /**
   * Incident에 적합한 Playbook 매칭
   * - alert itemName/product 정보와 playbook capability/product를 비교
   */
  private matchPlaybooks(incident: Incident, playbooks: Playbook[]): Playbook[] {
    const matched: Playbook[] = [];

    for (const playbook of playbooks) {
      const product = incident.metadata['product'];
      if (typeof product === 'string' && playbook.product !== product) {
        continue;
      }

      // capability가 incident alert과 관련 있는지 확인
      const relevant = incident.alerts.some(alert =>
        playbook.capability.toLowerCase().includes(alert.itemName.toLowerCase()) ||
        alert.itemName.toLowerCase().includes(playbook.capability.toLowerCase()) ||
        this.isKeywordMatch(alert.message, playbook.capability),
      );

      if (relevant) {
        matched.push(playbook);
      }
    }

    return matched;
  }

  /**
   * 키워드 기반 매칭
   */
  private isKeywordMatch(text: string, capability: string): boolean {
    const textLower = text.toLowerCase();
    const capLower = capability.toLowerCase();
    const keywords = capLower.split(/[\/\s]+/).filter(k => k.length > 2);

    return keywords.some(kw => textLower.includes(kw));
  }

  /**
   * Playbook steps를 RemediationStep으로 변환
   */
  private buildRemediationSteps(
    incident: Incident,
    playbooks: Playbook[],
  ): RemediationStep[] {
    const steps: RemediationStep[] = [];
    let order = 1;

    for (const playbook of playbooks) {
      // prechecks → remediation steps
      for (const check of playbook.prechecks) {
        steps.push({
          id: nowId('rstep'),
          order: order++,
          title: `[사전점검] ${check.description}`,
          description: `Playbook ${playbook.id}의 사전점검: ${check.description}`,
          playbookId: playbook.id,
          playbookStepId: check.id,
          action: 'precheck',
          input: { expectedValue: check.expectedValue },
          expectedChange: `사전점검 ${check.description} 통과`,
          dryRunSafe: true,
          requiresApproval: false,
          status: 'pending',
        });
      }

      // main steps
      for (const step of playbook.steps) {
        steps.push({
          id: nowId('rstep'),
          order: order++,
          title: step.title,
          description: step.description,
          playbookId: playbook.id,
          playbookStepId: step.id,
          action: step.action,
          input: step.input,
          expectedChange: `${step.expectedChange.field}: ${String(step.expectedChange.before)} → ${String(step.expectedChange.after)}`,
          dryRunSafe: step.adapter !== 'ui',
          requiresApproval: playbook.approval.required,
          status: 'pending',
        });
      }

      // postchecks → remediation steps
      for (const check of playbook.postchecks) {
        steps.push({
          id: nowId('rstep'),
          order: order++,
          title: `[사후검증] ${check.description}`,
          description: `Playbook ${playbook.id}의 사후검증: ${check.description}`,
          playbookId: playbook.id,
          playbookStepId: check.id,
          action: 'postcheck',
          input: { expectedValue: check.expectedValue },
          expectedChange: `사후검증 ${check.description} 통과`,
          dryRunSafe: true,
          requiresApproval: false,
          status: 'pending',
        });
      }
    }

    return steps;
  }

  /**
   * Playbook rollback steps를 RollbackPlan으로 변환
   */
  private buildRollbackPlan(playbooks: Playbook[]): RollbackPlan {
    const rollbackSteps: RemediationStep[] = [];
    let order = 1;

    for (const playbook of playbooks) {
      for (const step of playbook.rollback) {
        rollbackSteps.push({
          id: nowId('rstep'),
          order: order++,
          title: `[롤백] ${step.title}`,
          description: step.description,
          playbookId: playbook.id,
          playbookStepId: step.id,
          action: step.action,
          input: step.input,
          expectedChange: `롤백: ${step.expectedChange.field} 복구`,
          dryRunSafe: step.adapter !== 'ui',
          requiresApproval: false,
          status: 'pending',
        });
      }
    }

    return {
      steps: rollbackSteps,
      automaticTrigger: rollbackSteps.length > 0,
      triggerCondition: '복구 단계 실패 시 자동 롤백',
    };
  }

  private extractServiceName(itemName: string): string {
    // itemName에서 서비스명 추출 (예: "EPP 실시간 보호" → "EPP")
    const parts = itemName.split(/[\s_\-]+/);
    return parts[0] ?? itemName;
  }

  private determineBlastRadius(
    incident: Incident,
  ): 'device' | 'service' | 'network' | 'organization' {
    if (incident.severity === 'critical') return 'network';
    if (incident.severity === 'high') return 'service';
    if (incident.affectedDevices.length > 3) return 'service';
    return 'device';
  }

  private determineRiskLevel(severity: IncidentSeverity, stepCount: number): RiskLevel {
    if (severity === 'critical') return 'critical';
    if (severity === 'high' || stepCount > 5) return 'high';
    if (severity === 'medium') return 'medium';
    return 'low';
  }

  private estimateDowntime(stepCount: number, riskLevel: RiskLevel): string {
    const baseMinutes = stepCount * 2;
    const multiplier = riskLevel === 'critical' ? 3 : riskLevel === 'high' ? 2 : 1;
    const totalMinutes = baseMinutes * multiplier;
    if (totalMinutes >= 60) {
      return `약 ${Math.ceil(totalMinutes / 60)}시간`;
    }
    return `약 ${totalMinutes}분`;
  }

  private isApprovalRequired(severity: IncidentSeverity, impact: ImpactAnalysis): boolean {
    if (severity === 'critical' || severity === 'high') return true;
    if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') return true;
    if (impact.blastRadius === 'network' || impact.blastRadius === 'organization') return true;
    return false;
  }

  private collectPrerequisites(plan: RemediationPlan): string[] {
    const prereqs: string[] = [
      '장비 접근 권한 확인',
      '현재 설정 백업 완료',
    ];

    if (plan.approvalRequired) {
      prereqs.push('관리자 승인 획득');
    }

    if (plan.incident.severity === 'critical') {
      prereqs.push('유지보수 윈도우 확보');
      prereqs.push('긴급 연락망 확인');
    }

    return prereqs;
  }

  private collectWarnings(incident: Incident, plan: RemediationPlan): string[] {
    const warnings: string[] = [];

    if (plan.rollback.steps.length === 0) {
      warnings.push('롤백 단계가 정의되지 않았습니다. 복구 실패 시 수동 복구가 필요합니다.');
    }

    if (incident.severity === 'critical') {
      warnings.push('Critical incident — 서비스 중단 가능성이 있습니다.');
    }

    const nonDryRunSafe = plan.steps.filter(s => !s.dryRunSafe);
    if (nonDryRunSafe.length > 0) {
      warnings.push(`${nonDryRunSafe.length}개 단계가 dry-run 불가능합니다.`);
    }

    return warnings;
  }

  private estimateDuration(steps: RemediationStep[]): string {
    const totalMinutes = steps.length * 3;
    if (totalMinutes >= 60) {
      return `약 ${Math.ceil(totalMinutes / 60)}시간`;
    }
    return `약 ${totalMinutes}분`;
  }
}
