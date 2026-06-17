/**
 * Device Model — 장치 스냅샷, 기능, 상태 타입 정의
 *
 * Sangfor 제품(EPP, IAG, CC)의 장치 상태를 표준화된 모델로 캡슐화.
 * OperationPlan과 결합하여 desired state → 실행 계획으로 변환에 활용.
 */

import type { ProductCode, RiskLevel } from '@sangfor/workflow-shared';
import type { UserIntent, ExpectedChange, EvidencePolicy } from './operation-model.js';

// ─── Sangfor Product ───────────────────────────────────────────────────────

export type SangforProduct = 'EPP' | 'IAG' | 'CC';

// ─── Device Snapshot ──────────────────────────────────────────────────────

export type AccessMethod = 'api' | 'ssh' | 'ui' | 'snmp';

export interface LicenseInfo {
  key: string;
  type: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'expiring_soon';
}

export interface DeviceObject {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string | number | boolean>;
}

export interface DevicePolicy {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  rules: Record<string, string | number | boolean>;
  priority?: number;
}

export interface AuthSource {
  id: string;
  name: string;
  type: 'local' | 'ldap' | 'radius' | 'tacacs' | 'saml';
  enabled: boolean;
}

export interface NetworkInfo {
  interfaces: Array<{
    name: string;
    ip: string;
    mask: string;
    status: 'up' | 'down';
  }>;
  routes?: Array<{
    destination: string;
    gateway: string;
    metric?: number;
  }>;
  dns?: string[];
}

export interface AlarmEntry {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  resolved: boolean;
}

export interface RawRef {
  source: string;
  path: string;
  capturedAt: string;
}

export interface DeviceSnapshot {
  deviceId: string;
  product: SangforProduct;
  version: string;
  collectedAt: string;
  accessMethod: AccessMethod;
  licenses: LicenseInfo[];
  objects: DeviceObject[];
  policies: DevicePolicy[];
  authSources: AuthSource[];
  network: NetworkInfo;
  alarms: AlarmEntry[];
  rawRefs: RawRef[];
}

// ─── Device Capability ────────────────────────────────────────────────────

export interface DeviceCapability {
  product: SangforProduct;
  capabilities: string[];
}

// ─── Desired State ─────────────────────────────────────────────────────────

export interface DesiredState {
  product: SangforProduct;
  settings: Record<string, string | number | boolean | null>;
}

// ─── Operation Plan ────────────────────────────────────────────────────────

export type AdapterType = 'api' | 'ssh' | 'ui';

export interface OperationStep {
  id: string;
  title: string;
  capability: string;
  adapter: AdapterType;
  action: string;
  input: Record<string, string | number | boolean>;
  expectedChange: ExpectedChange;
  idempotencyKey: string;
  retryPolicy: {
    maxRetries: number;
    backoff: 'none' | 'linear' | 'exponential';
  };
  requiresApproval: boolean;
}

export interface OperationCheck {
  id: string;
  description: string;
  checkType: 'state_match' | 'health_pass' | 'custom';
  expected: string | number | boolean;
  actual?: string | number | boolean;
}

export interface OperationRisk {
  level: RiskLevel;
  categories: string[];
  mitigation: string;
}

export interface ApprovalRequirement {
  required: boolean;
  reason: string;
  approverRole: string;
}

export interface EvidenceRef {
  type: 'screenshot' | 'diff' | 'log' | 'markdown';
  path: string;
  capturedAt: string;
  description: string;
}

export interface OperationPlan {
  id: string;
  intent: UserIntent;
  deviceId: string;
  desiredState: DesiredState;
  prechecks: OperationCheck[];
  steps: OperationStep[];
  postchecks: OperationCheck[];
  rollback: OperationStep[];
  risk: OperationRisk;
  approval: ApprovalRequirement;
  evidencePolicy: EvidencePolicy;
}
