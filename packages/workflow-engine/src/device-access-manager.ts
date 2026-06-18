/**
 * Device Access Manager — 장비 접근 정보 관리
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { AdapterBoundary, UIActionConstraint } from './types.js';

const log = createLogger('device-access');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface DeviceAccessRequest {
  id: string;
  customer: string;
  projectId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  devices: DeviceAccess[];
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  notes?: string;
}

export interface DeviceAccess {
  product: 'EPP' | 'IAG' | 'CC' | 'SCP';
  ip: string;
  port: number;
  username: string;
  password: string;
  protocol: 'https' | 'http' | 'ssh';
  cdpPort?: number;
  notes?: string;
}

export interface AccessRequestTemplate {
  customer: string;
  projectId: string;
  projectName: string;
  devices: Array<{
    product: string;
    purpose: string;
  }>;
  requestedBy: string;
  requestReason: string;
  estimatedDuration: string;
}

// ─── 접근 정보 요청 프로세스 ────────────────────────────────────────────────

export class DeviceAccessManager {
  private requests: Map<string, DeviceAccessRequest> = new Map();
  private approvedAccess: Map<string, DeviceAccess[]> = new Map();

  // 접근 정보 요청 생성
  createRequest(template: AccessRequestTemplate): DeviceAccessRequest {
    const request: DeviceAccessRequest = {
      id: nowId('access'),
      customer: template.customer,
      projectId: template.projectId,
      requestedAt: nowISO(),
      status: 'pending',
      devices: template.devices.map(d => ({
        product: d.product as any,
        ip: '',
        port: 443,
        username: '',
        password: '',
        protocol: 'https',
      })),
    };

    this.requests.set(request.id, request);
    log.info(`Created access request: ${request.id} for ${template.customer}`);

    return request;
  }

  // 접근 정보 제출 (고객이填写)
  submitAccessInfo(
    requestId: string,
    devices: DeviceAccess[]
  ): DeviceAccessRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    request.devices = devices;
    request.status = 'pending';
    this.requests.set(requestId, request);

    log.info(`Access info submitted for request: ${requestId}`);
    return request;
  }

  // 접근 정보 승인
  approveRequest(
    requestId: string,
    approvedBy: string,
    expiresAt?: string
  ): DeviceAccessRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = nowISO();
    request.expiresAt = expiresAt;

    // 승인된 접근 정보 저장
    this.approvedAccess.set(request.customer, request.devices);

    this.requests.set(requestId, request);
    log.info(`Access request approved: ${requestId} by ${approvedBy}`);

    return request;
  }

  // 접근 정보 거절
  rejectRequest(
    requestId: string,
    reason: string
  ): DeviceAccessRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    request.status = 'rejected';
    request.notes = reason;
    this.requests.set(requestId, request);

    log.info(`Access request rejected: ${requestId} - ${reason}`);
    return request;
  }

  // 고객의 접근 정보 조회
  getApprovedAccess(customer: string): DeviceAccess[] | null {
    return this.approvedAccess.get(customer) || null;
  }

  // 요청 상태 조회
  getRequest(requestId: string): DeviceAccessRequest | null {
    return this.requests.get(requestId) || null;
  }

  // 전체 요청 조회
  getAllRequests(): DeviceAccessRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );
  }

  // 고객의 모든 요청 조회
  getCustomerRequests(customer: string): DeviceAccessRequest[] {
    const requests: DeviceAccessRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.customer === customer) {
        requests.push(request);
      }
    }
    return requests.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  // 접근 정보 만료 확인
  checkExpiredAccess(): string[] {
    const expired: string[] = [];
    const now = new Date();

    for (const [customer, access] of this.approvedAccess) {
      // TODO: 만료 시간 확인 로직
    }

    return expired;
  }

  // 접근 정보 폐기
  revokeAccess(customer: string): void {
    this.approvedAccess.delete(customer);
    log.info(`Access revoked for customer: ${customer}`);
  }

  // 요청 메시지 생성 (고객에게 보낼)
  generateRequestMessage(template: AccessRequestTemplate): string {
    const lines: string[] = [];

    lines.push(`# ${template.customer} - 장비 접근 정보 요청`);
    lines.push('');
    lines.push(`프로젝트: ${template.projectName}`);
    lines.push(`요청자: ${template.requestedBy}`);
    lines.push(`요청 사유: ${template.requestReason}`);
    lines.push(`예상 기간: ${template.estimatedDuration}`);
    lines.push('');
    lines.push('## 필요한 접근 정보');
    lines.push('');

    for (const device of template.devices) {
      lines.push(`### ${device.product}`);
      lines.push(`- 목적: ${device.purpose}`);
      lines.push(`- IP: [입력 필요]`);
      lines.push(`- 포트: [입력 필요]`);
      lines.push(`- 계정: [입력 필요]`);
      lines.push(`- 비밀번호: [입력 필요]`);
      lines.push('');
    }

    lines.push('## 보안 주의사항');
    lines.push('');
    lines.push('1. 접근 정보는 암호화되어 저장됩니다.');
    lines.push('2. 프로젝트 완료 후 접근 정보는 자동 폐기됩니다.');
    lines.push('3. 접근 정보는 승인된 담당자만 사용 가능합니다.');
    lines.push('');

    lines.push('## 제출 방법');
    lines.push('');
    lines.push('아래 양식에 맞춰 접근 정보를 입력해주세요:');
    lines.push('');
    lines.push('```');
    lines.push('EPP:');
    lines.push('  IP: 10.80.1.106');
    lines.push('  포트: 443');
    lines.push('  계정: admin');
    lines.push('  비밀번호: ********');
    lines.push('');
    lines.push('IAG:');
    lines.push('  IP: 10.80.1.108');
    lines.push('  포트: 443');
    lines.push('  계정: admin');
    lines.push('  비밀번호: ********');
    lines.push('```');

    return lines.join('\n');
  }

  // 접근 정보 검증
  validateAccessInfo(devices: DeviceAccess[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const device of devices) {
      if (!device.ip) {
        errors.push(`${device.product}: IP 주소 필수`);
      }
      if (!device.username) {
        errors.push(`${device.product}: 계정 필수`);
      }
      if (!device.password) {
        errors.push(`${device.product}: 비밀번호 필수`);
      }
      if (device.port < 1 || device.port > 65535) {
        errors.push(`${device.product}: 포트 번호 잘못됨`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ─── PR-25: Adapter Boundary 조회 ────────────────────────────────────────

  /**
   * 제품과 기능에 따른 AdapterBoundary 반환
   */
  getAdapterBoundary(product: string, feature: string): AdapterBoundary {
    const featureLower = feature.toLowerCase();

    // API 기반 기능
    if (featureLower.includes('syslog') || featureLower.includes('api') || featureLower.includes('rest')) {
      return {
        adapterType: 'api',
        supportedActions: ['read', 'write', 'query'],
        constraints: {
          selectorRequired: false,
          capabilityBased: false,
          idempotencyRequired: true,
        },
      };
    }

    // SSH 기반 기능
    if (featureLower.includes('cli') || featureLower.includes('ssh') || featureLower.includes('terminal')) {
      return {
        adapterType: 'ssh',
        supportedActions: ['execute', 'read', 'write'],
        constraints: {
          selectorRequired: false,
          capabilityBased: false,
          idempotencyRequired: false,
        },
      };
    }

    // UI 기반 기능 (기본값)
    return {
      adapterType: 'ui',
      supportedActions: ['toggle', 'select', 'input', 'checkbox', 'click_button'],
      constraints: {
        selectorRequired: false,
        capabilityBased: true,
        idempotencyRequired: true,
      },
    };
  }
}
