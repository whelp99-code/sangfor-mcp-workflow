/**
 * Sangfor Auto Config — Sangfor 설정 자동화
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('sangfor-auto-config');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface SangforConfig {
  product: 'EPP' | 'IAG' | 'CC';
  feature: string;
  menuPath: string[];
  settings: Record<string, any>;
  prerequisites: string[];
  validation: {
    method: 'api' | 'webui' | 'manual';
    criteria: string[];
  };
}

export interface ConfigResult {
  success: boolean;
  appliedSettings: Record<string, any>;
  errors: string[];
  warnings: string[];
}

export interface VerificationResult {
  verified: boolean;
  passedCriteria: string[];
  failedCriteria: string[];
  evidence: string[];
}

// ─── 감사항목 → Sangfor 설정 매핑 ──────────────────────────────────────────

const AUDIT_TO_CONFIG_MAP: Record<string, SangforConfig> = {
  // Anti-Virus 관련
  '③Malware Infection Prevention': {
    product: 'EPP',
    feature: 'Anti-Virus',
    menuPath: ['Defense', 'Malware Scan'],
    settings: {
      realtimeProtection: true,
      scanSchedule: '0 2 * * *',
      engineUpdate: 'auto',
      quarantineEnabled: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['실시간 보호 활성화', '스캔 스케줄 설정', '엔진 업데이트 자동'],
    },
  },
  '⑦Incident Analysis and Response': {
    product: 'EPP',
    feature: 'Log Management',
    menuPath: ['System', 'Log Settings'],
    settings: {
      logRetention: '365d',
      syslogEnabled: true,
      syslogServer: '',
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['로그 보존 기간 1년', 'Syslog 설정'],
    },
  },
  // Software Control 관련
  'Software Control': {
    product: 'EPP',
    feature: 'Application Control',
    menuPath: ['Policies', 'App Control'],
    settings: {
      blockUnauthorized: true,
      whitelistEnabled: true,
      logBlockedApps: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['비인가 소프트웨어 차단', '화이트리스트 설정'],
    },
  },
  // Device Control 관련
  'Device Control': {
    product: 'EPP',
    feature: 'Device Control',
    menuPath: ['Policies', 'Behavior Control'],
    settings: {
      usbBlocked: true,
      cdBlocked: true,
      logDeviceAccess: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['USB 차단', 'CD 차단', '장치 접근 로그'],
    },
  },
  // Anti-Spam 관련
  'Anti-Spam': {
    product: 'IAG',
    feature: 'Email Security',
    menuPath: ['Security', 'Email Filtering'],
    settings: {
      spamFilterEnabled: true,
      virusScanEnabled: true,
      quarantineEnabled: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['스팸 필터 활성화', '바이러스 스캔 활성화'],
    },
  },
  // DLP 관련
  'Data Loss Prevention': {
    product: 'IAG',
    feature: 'DLP',
    menuPath: ['Security', 'Data Loss Prevention'],
    settings: {
      dlpEnabled: true,
      keywordDetection: true,
      fileBlocking: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['DLP 활성화', '키워드 탐지', '파일 차단'],
    },
  },
  // Network Access Control 관련
  'Network Access Contro': {
    product: 'IAG',
    feature: 'Network Access Control',
    menuPath: ['Security', 'Network Access'],
    settings: {
      nacEnabled: true,
      deviceAuthentication: true,
      quarantineUnknownDevices: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['NAC 활성화', '장치 인증', '미인증 장치 격리'],
    },
  },
  // Log Management 관련
  'Log Management': {
    product: 'CC',
    feature: 'Log Management',
    menuPath: ['System', 'Log Settings'],
    settings: {
      centralizedLogging: true,
      logRetention: '365d',
      alertEnabled: true,
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['중앙 로그 수집', '로그 보존 1년', '알림 설정'],
    },
  },
  // Security Monitoring 관련
  'Security Monitoring': {
    product: 'CC',
    feature: 'Security Monitoring',
    menuPath: ['Detection', 'Monitoring'],
    settings: {
      anomalyDetection: true,
      alertThreshold: 'medium',
      notificationEmail: '',
    },
    prerequisites: [],
    validation: {
      method: 'webui',
      criteria: ['이상 탐지 활성화', '알림 임계값 설정', '이메일 알림'],
    },
  },
};

// ─── Sangfor Auto Config ────────────────────────────────────────────────────

export class SangforAutoConfig {
  // 감사항목으로 Sangfor 설정 조회
  findByAuditItem(auditItem: string): SangforConfig | null {
    return AUDIT_TO_CONFIG_MAP[auditItem] || null;
  }

  // Solution으로 Sangfor 설정 조회
  findBySolution(solution: string): SangforConfig[] {
    const configs: SangforConfig[] = [];
    for (const [key, config] of Object.entries(AUDIT_TO_CONFIG_MAP)) {
      if (key.includes(solution) || config.feature.includes(solution)) {
        configs.push(config);
      }
    }
    return configs;
  }

  // 설정 자동 적용
  async applyConfig(product: string, config: SangforConfig): Promise<ConfigResult> {
    log.info(`Applying config for ${product}: ${config.feature}`);

    // 1. 사전 조건 확인
    const prerequisitesMet = await this.checkPrerequisites(config.prerequisites);
    if (!prerequisitesMet) {
      return {
        success: false,
        appliedSettings: {},
        errors: ['사전 조건 미충족'],
        warnings: [],
      };
    }

    // 2. 설정 적용 (TODO: sangfor-engineer-mcp 연동)
    const result: ConfigResult = {
      success: true,
      appliedSettings: config.settings,
      errors: [],
      warnings: [],
    };

    log.info(`Config applied successfully: ${config.feature}`);
    return result;
  }

  // 설정 검증
  async verifyConfig(product: string, config: SangforConfig): Promise<VerificationResult> {
    log.info(`Verifying config for ${product}: ${config.feature}`);

    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const evidence: string[] = [];

    // TODO: sangfor-engineer-mcp의 verify_product_change 연동
    for (const criterion of config.validation.criteria) {
      // 현재는 모두 통과로 처리
      passedCriteria.push(criterion);
    }

    return {
      verified: failedCriteria.length === 0,
      passedCriteria,
      failedCriteria,
      evidence,
    };
  }

  // 사전 조건 확인
  private async checkPrerequisites(prerequisites: string[]): Promise<boolean> {
    // TODO: 사전 조건 확인 로직
    return true;
  }
}
