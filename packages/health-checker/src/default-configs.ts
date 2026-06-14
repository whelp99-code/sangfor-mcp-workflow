/**
 * 기본 점검 설정 — EPP/IAG/CC 표준 점검 항목
 */

import type { HealthCheckConfig, HealthCheckItem } from '@sangfor/workflow-core';

// ─── EPP (Endpoint Secure) 점검 설정 ────────────────────────────────────────

export const EPP_CHECK_ITEMS: HealthCheckItem[] = [
  {
    id: 'epp_dashboard',
    name: '대시보드 상태',
    menuPath: ['Dashboard'],
    collectType: 'screenshot',
    alertConditions: [
      {
        field: 'data.criticalAlerts',
        operator: 'greater_than',
        value: 0,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'epp_agents',
    name: '에이전트 상태',
    menuPath: ['Assets', 'Endpoint/Agent List'],
    collectType: 'table',
    expectedFields: ['hostname', 'status', 'lastSeen', 'version'],
    alertConditions: [
      {
        field: 'data.offlineAgents',
        operator: 'greater_than',
        value: 5,
        severity: 'warning',
      },
    ],
  },
  {
    id: 'epp_malware_policy',
    name: '악성코드 보호 정책',
    menuPath: ['Policy', 'Malware/Ransomware Protection'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'epp_device_control',
    name: '장치 제어 정책',
    menuPath: ['Policy', 'Device Control'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.usbBlocked',
        operator: 'equals',
        value: false,
        severity: 'warning',
      },
    ],
  },
  {
    id: 'epp_syslog',
    name: 'Syslog 설정',
    menuPath: ['System', 'Syslog'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'warning',
      },
    ],
  },
];

// ─── IAG (Internet Access Gateway) 점검 설정 ────────────────────────────────

export const IAG_CHECK_ITEMS: HealthCheckItem[] = [
  {
    id: 'iag_dashboard',
    name: '대시보드 상태',
    menuPath: ['Dashboard'],
    collectType: 'screenshot',
    alertConditions: [
      {
        field: 'data.criticalEvents',
        operator: 'greater_than',
        value: 10,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'iag_url_filter',
    name: 'URL 필터링 정책',
    menuPath: ['Security', 'URL Filtering'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'iag_dlp',
    name: 'DLP 정책',
    menuPath: ['Security', 'Data Loss Prevention'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'warning',
      },
    ],
  },
  {
    id: 'iag_ssl_inspection',
    name: 'SSL 검사 설정',
    menuPath: ['Security', 'SSL Inspection'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'warning',
      },
    ],
  },
];

// ─── CC (Cyber Command) 점검 설정 ────────────────────────────────────────────

export const CC_CHECK_ITEMS: HealthCheckItem[] = [
  {
    id: 'cc_dashboard',
    name: '대시보드 상태',
    menuPath: ['Dashboard'],
    collectType: 'screenshot',
    alertConditions: [
      {
        field: 'data.criticalThreats',
        operator: 'greater_than',
        value: 5,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'cc_sensors',
    name: '센서 상태',
    menuPath: ['System', 'Sensors'],
    collectType: 'table',
    expectedFields: ['name', 'status', 'lastSync', 'version'],
    alertConditions: [
      {
        field: 'data.offlineSensors',
        operator: 'greater_than',
        value: 0,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'cc_event_collection',
    name: '이벤트 수집 상태',
    menuPath: ['System', 'Event Collection'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.enabled',
        operator: 'equals',
        value: false,
        severity: 'critical',
      },
    ],
  },
  {
    id: 'cc_ntp',
    name: 'NTP 설정',
    menuPath: ['System', 'NTP Settings'],
    collectType: 'form',
    alertConditions: [
      {
        field: 'data.syncStatus',
        operator: 'not_equals',
        value: 'synced',
        severity: 'warning',
      },
    ],
  },
];

// ─── 기본 설정 생성 ──────────────────────────────────────────────────────────

export function createDefaultHealthCheckConfig(
  product: 'EPP' | 'IAG' | 'CC',
  targetUrl: string,
  credentials: { username: string; password: string },
  outputDir: string
): HealthCheckConfig {
  const checkItems =
    product === 'EPP'
      ? EPP_CHECK_ITEMS
      : product === 'IAG'
        ? IAG_CHECK_ITEMS
        : CC_CHECK_ITEMS;

  return {
    product,
    targetUrl,
    credentials,
    checkItems,
    outputDir,
  };
}

// ─── 실장비 URL 매핑 ────────────────────────────────────────────────────────

export const PRODUCT_URLS: Record<string, string> = {
  EPP: 'https://10.80.1.106',
  IAG: 'https://10.80.1.108',
  CC: 'https://10.80.1.107',
};

/**
 * 제품 인증정보 — process.env에서 읽어온다.
 * .env 파일에 EPP_USERNAME, EPP_PASSWORD, IAG_USERNAME, IAG_PASSWORD, CC_USERNAME, CC_PASSWORD를 설정해야 한다.
 */
export const PRODUCT_CREDENTIALS: Record<string, { username: string; password: string }> = {
  EPP: {
    username: process.env.EPP_USERNAME || '',
    password: process.env.EPP_PASSWORD || '',
  },
  IAG: {
    username: process.env.IAG_USERNAME || '',
    password: process.env.IAG_PASSWORD || '',
  },
  CC: {
    username: process.env.CC_USERNAME || '',
    password: process.env.CC_PASSWORD || '',
  },
};

/** 인증정보가 올바르게 설정되었는지 검증 */
export function validateCredentials(product: string): void {
  const cred = PRODUCT_CREDENTIALS[product];
  if (!cred || !cred.username || !cred.password) {
    throw new Error(
      `Missing credentials for ${product}. ` +
      `Set ${product}_USERNAME and ${product}_PASSWORD in .env`
    );
  }
}
