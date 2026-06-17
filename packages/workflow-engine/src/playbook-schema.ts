/**
 * Playbook Schema — 수동 매뉴얼 기반 플레이북 타입 및 검증
 *
 * Sangfor 제품 설정을 단계별로 정의하는 플레이북 스키마.
 * 매뉴얼 문서에서 추출되거나 수작업으로 작성될 수 있음.
 */

import type { ProductCode, RiskLevel } from '@sangfor/workflow-shared';
import type { AdapterType } from './device-model.js';

// ─── Playbook Types ────────────────────────────────────────────────────────

export type PlaybookCheckType = 'state_match' | 'health_pass' | 'manual_confirm' | 'custom';

export interface PlaybookCheck {
  id: string;
  description: string;
  type: PlaybookCheckType;
  expectedValue: string | number | boolean;
}

export interface PlaybookApproval {
  required: boolean;
  reason: string;
}

export type PlaybookSource = 'markdown' | 'url' | 'manual_extract' | 'hand_written';

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  adapter: AdapterType;
  action: string;
  input: Record<string, string | number | boolean>;
  expectedChange: {
    field: string;
    before: string | number | boolean | null;
    after: string | number | boolean;
  };
  order: number;
}

export interface PlaybookMetadata {
  author?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  estimatedDuration?: string;
}

export interface Playbook {
  id: string;
  product: ProductCode;
  capability: string;
  riskLevel: RiskLevel;
  prechecks: PlaybookCheck[];
  steps: PlaybookStep[];
  postchecks: PlaybookCheck[];
  rollback: PlaybookStep[];
  approval: PlaybookApproval;
  source: PlaybookSource;
  metadata: PlaybookMetadata;
  description?: string;
}

// ─── Validation ────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * 플레이북 구조 검증
 * - postchecks가 없는 playbook은 reject (운영 안전장치 필수)
 * - steps가 비어있으면 reject
 * - id/product/capability 필수 필드 확인
 */
export function validatePlaybook(playbook: Playbook): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 필수 필드 검사
  if (!playbook.id) {
    errors.push({ field: 'id', message: 'Playbook ID is required', severity: 'error' });
  }
  if (!playbook.product) {
    errors.push({ field: 'product', message: 'Product is required', severity: 'error' });
  }
  if (!playbook.capability) {
    errors.push({ field: 'capability', message: 'Capability is required', severity: 'error' });
  }

  // steps가 비어있으면 reject
  if (!playbook.steps || playbook.steps.length === 0) {
    errors.push({ field: 'steps', message: 'Playbook must have at least one step', severity: 'error' });
  }

  // postchecks가 없으면 reject (운영 안전장치)
  if (!playbook.postchecks || playbook.postchecks.length === 0) {
    errors.push({
      field: 'postchecks',
      message: 'Playbook must have at least one postcheck for operational safety',
      severity: 'error',
    });
  }

  // prechecks가 없으면 warning
  if (!playbook.prechecks || playbook.prechecks.length === 0) {
    warnings.push({
      field: 'prechecks',
      message: 'Consider adding prechecks for safer execution',
      severity: 'warning',
    });
  }

  // rollback이 없으면 warning
  if (!playbook.rollback || playbook.rollback.length === 0) {
    warnings.push({
      field: 'rollback',
      message: 'Consider adding rollback steps for error recovery',
      severity: 'warning',
    });
  }

  // step ID 중복 검사
  const stepIds = playbook.steps.map(s => s.id);
  const duplicateIds = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    errors.push({
      field: 'steps',
      message: `Duplicate step IDs: ${duplicateIds.join(', ')}`,
      severity: 'error',
    });
  }

  // step order 연속성 검사
  const orders = playbook.steps.map(s => s.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      warnings.push({
        field: 'steps',
        message: `Step orders should be sequential starting from 1 (found gaps or non-sequential)`,
        severity: 'warning',
      });
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
