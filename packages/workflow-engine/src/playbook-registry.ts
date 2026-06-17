/**
 * Playbook Registry — 플레이북 등록, 검색, 관리
 *
 * 시나리오 기반 설정 자동화와 수동 매뉴얼 기반 플레이북을
 * 통합 관리하는 레지스트리.
 */

import { createLogger, nowId } from '@sangfor/workflow-shared';
import type { ProductCode, RiskLevel } from '@sangfor/workflow-shared';
import type { Playbook, PlaybookStep, PlaybookCheck, PlaybookApproval } from './playbook-schema.js';
import { validatePlaybook } from './playbook-schema.js';
import type { Scenario, ScenarioSetting } from './scenario-db.js';

const log = createLogger('playbook-registry');

// ─── Playbook Registry ─────────────────────────────────────────────────────

export class PlaybookRegistry {
  private playbooks: Map<string, Playbook> = new Map();

  /**
   * 플레이북 등록 (검증 포함)
   */
  register(playbook: Playbook): { success: boolean; errors: string[] } {
    const validation = validatePlaybook(playbook);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`);
      log.warn(`Playbook validation failed for ${playbook.id}: ${errorMessages.join('; ')}`);
      return { success: false, errors: errorMessages };
    }

    this.playbooks.set(playbook.id, playbook);
    log.info(`Registered playbook: ${playbook.id} (${playbook.product}/${playbook.capability})`);
    return { success: true, errors: [] };
  }

  /**
   * 플레이북 조회
   */
  get(id: string): Playbook | null {
    return this.playbooks.get(id) ?? null;
  }

  /**
   * 제품별 검색
   */
  findByProduct(product: ProductCode): Playbook[] {
    return Array.from(this.playbooks.values()).filter(p => p.product === product);
  }

  /**
   * 기능별 검색
   */
  findByCapability(capability: string): Playbook[] {
    const lower = capability.toLowerCase();
    return Array.from(this.playbooks.values()).filter(
      p => p.capability.toLowerCase().includes(lower)
    );
  }

  /**
   * 전체 목록
   */
  listAll(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * 플레이북 제거
   */
  unregister(id: string): boolean {
    const deleted = this.playbooks.delete(id);
    if (deleted) log.info(`Unregistered playbook: ${id}`);
    return deleted;
  }

  /**
   * 등록된 플레이북 수
   */
  get size(): number {
    return this.playbooks.size;
  }

  /**
   * Scenario → Playbook 변환 후 등록
   */
  registerFromManualScenario(scenario: Scenario): { success: boolean; errors: string[] } {
    const playbook = this.convertScenarioToPlaybook(scenario);
    return this.register(playbook);
  }

  /**
   * Scenario를 Playbook으로 변환
   */
  private convertScenarioToPlaybook(scenario: Scenario): Playbook {
    const steps: PlaybookStep[] = scenario.settings.map((setting, index) =>
      this.convertSettingToStep(setting, index + 1)
    );

    const postchecks: PlaybookCheck[] = scenario.validation.criteria.map((criterion, index) => ({
      id: `postcheck_${index + 1}`,
      description: criterion,
      type: 'state_match' as const,
      expectedValue: true,
    }));

    const approval: PlaybookApproval = {
      required: scenario.approvalRequired ?? true,
      reason: `Requires approval for ${scenario.feature} configuration on ${scenario.product}`,
    };

    return {
      id: scenario.id,
      product: scenario.product as ProductCode,
      capability: scenario.feature,
      riskLevel: (scenario.riskLevel as RiskLevel) ?? 'medium',
      prechecks: [],
      steps,
      postchecks,
      rollback: [],
      approval,
      source: 'manual_extract',
      metadata: {
        createdAt: scenario.source.extractedAt,
        tags: scenario.menuPath,
      },
      description: scenario.description,
    };
  }

  /**
   * ScenarioSetting → PlaybookStep 변환
   */
  private convertSettingToStep(setting: ScenarioSetting, order: number): PlaybookStep {
    const actionMap: Record<ScenarioSetting['type'], string> = {
      toggle: 'toggle_setting',
      checkbox: 'set_checkbox',
      select: 'select_option',
      input: 'fill_input',
      click_button: 'click_element',
    };

    return {
      id: nowId('step'),
      title: setting.label,
      description: setting.description ?? `${setting.label} 설정 변경`,
      adapter: 'ui',
      action: actionMap[setting.type],
      input: {
        label: setting.label,
        value: setting.value ?? '',
        selector: setting.selector ?? '',
      },
      expectedChange: {
        field: setting.label,
        before: null,
        after: setting.value ?? true,
      },
      order,
    };
  }
}

// ─── Sample Playbook: EPP Malware Protection ───────────────────────────────

export const epp_malware_protection_playbook: Playbook = {
  id: 'epp_malware_protection',
  product: 'ENDPOINT_SECURE',
  capability: 'Anti-Virus / Malware Protection',
  riskLevel: 'medium',
  description: 'EPP 악성코드 보호 설정 플레이북 — 실시간 보호, 엔진 업데이트, 격리 설정',
  prechecks: [
    {
      id: 'precheck_1',
      description: 'EPP 관리 콘솔 접근 가능 여부 확인',
      type: 'health_pass',
      expectedValue: true,
    },
    {
      id: 'precheck_2',
      description: '라이선스 만료 잔여 기간 30일 이상',
      type: 'custom',
      expectedValue: 30,
    },
  ],
  steps: [
    {
      id: 'step_1',
      title: '실시간 보호 활성화',
      description: 'Defense > Malware Scan 메뉴에서 실시간 보호 토글 활성화',
      adapter: 'ui',
      action: 'toggle_setting',
      input: { menuPath: 'Defense > Malware Scan', setting: '실시간 보호', value: true },
      expectedChange: { field: 'realtime_protection', before: false, after: true },
      order: 1,
    },
    {
      id: 'step_2',
      title: '엔진 업데이트 자동 설정',
      description: 'Malware Scan 설정에서 바이러스 엔진 자동 업데이트 활성화',
      adapter: 'ui',
      action: 'select_option',
      input: { setting: '엔진 업데이트', value: '자동' },
      expectedChange: { field: 'engine_update_mode', before: '수동', after: '자동' },
      order: 2,
    },
    {
      id: 'step_3',
      title: '격리 기능 활성화',
      description: '악성코드 탐지 시 자동 격리 설정 활성화',
      adapter: 'ui',
      action: 'set_checkbox',
      input: { setting: '격리 활성화', value: true },
      expectedChange: { field: 'quarantine_enabled', before: false, after: true },
      order: 3,
    },
    {
      id: 'step_4',
      title: '스캔 스케줄 설정',
      description: '전체 시스템 스캔 스케줄 주 1회 설정',
      adapter: 'ui',
      action: 'select_option',
      input: { setting: '스캔 스케줄', value: '주 1회' },
      expectedChange: { field: 'scan_schedule', before: null, after: '주 1회' },
      order: 4,
    },
  ],
  postchecks: [
    {
      id: 'postcheck_1',
      description: '실시간 보호 상태 활성화 확인',
      type: 'state_match',
      expectedValue: true,
    },
    {
      id: 'postcheck_2',
      description: '엔진 업데이트 모드 자동 확인',
      type: 'state_match',
      expectedValue: '자동',
    },
    {
      id: 'postcheck_3',
      description: '격리 기능 활성화 확인',
      type: 'state_match',
      expectedValue: true,
    },
  ],
  rollback: [
    {
      id: 'rollback_1',
      title: '실시간 보호 원복',
      description: '실시간 보호 설정 원래 상태로 복구',
      adapter: 'ui',
      action: 'toggle_setting',
      input: { setting: '실시간 보호', value: false },
      expectedChange: { field: 'realtime_protection', before: true, after: false },
      order: 1,
    },
  ],
  approval: {
    required: true,
    reason: '실시간 보호 설정 변경은 엔드포이트 전체에 영향을 미칠 수 있음',
  },
  source: 'hand_written',
  metadata: {
    author: 'sangfor-engineer',
    version: '1.0.0',
    tags: ['EPP', 'malware', 'anti-virus', 'defense'],
    estimatedDuration: '10m',
  },
};

/**
 * 기본 플레이북이 포함된 레지스트리 생성
 */
export function createDefaultRegistry(): PlaybookRegistry {
  const registry = new PlaybookRegistry();
  const result = registry.register(epp_malware_protection_playbook);
  if (!result.success) {
    log.error(`Failed to register default playbook: ${result.errors.join(', ')}`);
  }
  return registry;
}
