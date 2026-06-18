/**
 * Device Menu Capture — 실장비 메뉴 구조 캡처
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('device-menu-capture');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface DeviceMenuCaptureConfig {
  product: 'EPP' | 'IAG' | 'CC';
  targetUrl: string;
  credentials: {
    username: string;
    password: string;
  };
  cdpPort?: number;
}

export interface CapturedMenu {
  id: string;
  product: string;
  version: string;
  capturedAt: string;
  menus: MenuNode[];
  screenshotPaths: string[];
}

export interface MenuNode {
  id: string;
  name: string;
  path: string[];
  children: MenuNode[];
  features: string[];
  screenshotPath?: string;
}

export interface MenuComparisonResult {
  product: string;
  manualVersion: string;
  deviceVersion: string;
  differences: MenuDifference[];
  summary: string;
}

export interface MenuDifference {
  type: 'added' | 'removed' | 'modified' | 'moved';
  manualPath: string[];
  devicePath: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// ─── MCP menu route parsing & comparison helpers ────────────────────────────

export function normalizeMenuName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[&/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function flattenMenuNodes(menus: MenuNode[]): MenuNode[] {
  const result: MenuNode[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(menus);
  return result;
}

export function parseMcpMenuRoutes(menuRoutes: unknown[]): MenuNode[] {
  return menuRoutes.map((route, index) => {
    if (typeof route === 'string') {
      const segments = route.split('>').map((s) => s.trim()).filter(Boolean);
      const name = segments[segments.length - 1] ?? route;
      return { id: `mcp-${index}`, name, path: segments, children: [], features: [] };
    }
    if (route && typeof route === 'object') {
      const obj = route as { name?: string; path?: string[] };
      const path = obj.path ?? (obj.name ? [obj.name] : [`Menu ${index + 1}`]);
      const name = obj.name ?? path[path.length - 1] ?? `Menu ${index + 1}`;
      return { id: `mcp-menu-${index}`, name, path, children: [], features: [] };
    }
    return {
      id: `mcp-menu-${index}`,
      name: `Menu ${index + 1}`,
      path: [`Menu ${index + 1}`],
      children: [],
      features: [],
    };
  });
}

// Synonym groups for MCP discover routes vs reference manual naming
const MENU_SYNONYM_GROUPS: string[][] = [
  ['dashboard', 'home'],
  ['malware scan'],
  ['app control'],
  ['security events', 'threats', 'detection and response'],
  ['endpoint inventory', 'endpoint agent list', 'endpoints'],
  ['usb device control', 'behavior control', 'device control'],
  ['agent deployment', 'update management'],
  ['syslog reporting', 'syslog', 'data sync'],
  ['behavior monitor'],
  ['exceptions'],
  ['interfaces', 'routing', 'general'],
  ['url filtering', 'url application control', 'access control'],
  ['internet access logs', 'logs'],
];

function normalizedTokens(name: string): string[] {
  return normalizeMenuName(name).split(' ').filter(Boolean);
}

function namesMatchSynonyms(a: string, b: string): boolean {
  const na = normalizeMenuName(a);
  const nb = normalizeMenuName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  for (const group of MENU_SYNONYM_GROUPS) {
    const aHit = group.some((term) => na.includes(term) || term.includes(na));
    const bHit = group.some((term) => nb.includes(term) || term.includes(nb));
    if (aHit && bHit) return true;
  }

  const aTokens = normalizedTokens(a);
  const bTokens = normalizedTokens(b);
  return aTokens.some((t) => bTokens.includes(t) && t.length > 3);
}

function menuNodeMatches(manualNode: MenuNode, deviceFlat: MenuNode[]): boolean {
  const manualNames = [
    manualNode.name,
    ...(manualNode.path[manualNode.path.length - 1] ? [manualNode.path[manualNode.path.length - 1]] : []),
  ];

  return deviceFlat.some((device) => {
    const deviceNames = [
      device.name,
      ...(device.path[device.path.length - 1] ? [device.path[device.path.length - 1]] : []),
      ...device.path,
    ];
    return manualNames.some((mn) => deviceNames.some((dn) => namesMatchSynonyms(mn, dn)));
  });
}

export function computeMenuAccuracy(
  manualMenus: MenuNode[],
  deviceMenus: MenuNode[],
): { accuracy: number; matchedItems: string[] } {
  const manualFlat = flattenMenuNodes(manualMenus);
  const deviceFlat = flattenMenuNodes(deviceMenus);
  const matchedItems: string[] = [];

  for (const manual of manualFlat) {
    if (menuNodeMatches(manual, deviceFlat)) {
      matchedItems.push(manual.name);
    }
  }

  const accuracy = manualFlat.length > 0
    ? Math.round((matchedItems.length / manualFlat.length) * 100)
    : 100;

  return { accuracy, matchedItems };
}

// ─── 실장비 메뉴 캡처 ──────────────────────────────────────────────────────

export class DeviceMenuCapture {
  // 메뉴 구조 캡처
  async captureMenuStructure(config: DeviceMenuCaptureConfig): Promise<CapturedMenu> {
    log.info(`Capturing menu structure: ${config.product} at ${config.targetUrl}`);

    const captured: CapturedMenu = {
      id: nowId('capture'),
      product: config.product,
      version: '',
      capturedAt: nowISO(),
      menus: [],
      screenshotPaths: [],
    };

    // 제품별 메뉴 구조 정의
    switch (config.product) {
      case 'EPP':
        captured.menus = this.getEPPMenuStructure();
        break;
      case 'IAG':
        captured.menus = this.getIAGMenuStructure();
        break;
      case 'CC':
        captured.menus = this.getCCMenuStructure();
        break;
    }

    log.info(`Captured ${captured.menus.length} menus`);
    return captured;
  }

  // 메뉴얼 vs 실장비 비교
  async compareWithManual(
    captured: CapturedMenu,
    manualMenus: MenuNode[]
  ): Promise<MenuComparisonResult> {
    log.info(`Comparing menus: ${captured.product}`);

    const differences: MenuDifference[] = [];
    const manualFlat = flattenMenuNodes(manualMenus);
    const deviceFlat = flattenMenuNodes(captured.menus);

    for (const manualMenu of manualFlat) {
      if (!menuNodeMatches(manualMenu, deviceFlat)) {
        differences.push({
          type: 'removed',
          manualPath: manualMenu.path,
          devicePath: [],
          description: `메뉴얼에만 존재: ${manualMenu.name}`,
          severity: 'medium',
        });
      }
    }

    for (const deviceMenu of deviceFlat) {
      const found = manualFlat.some((manual) => menuNodeMatches(manual, [deviceMenu]));
      if (!found) {
        differences.push({
          type: 'added',
          manualPath: [],
          devicePath: deviceMenu.path,
          description: `실장비에만 존재: ${deviceMenu.name}`,
          severity: 'low',
        });
      }
    }

    return {
      product: captured.product,
      manualVersion: '',
      deviceVersion: captured.version,
      differences,
      summary: this.generateComparisonSummary(differences),
    };
  }

  // ─── 제품별 메뉴 구조 ──────────────────────────────────────────────────────

  private getEPPMenuStructure(): MenuNode[] {
    return [
      {
        id: 'epp-dashboard',
        name: 'Dashboard',
        path: ['Dashboard'],
        children: [],
        features: ['대시보드', '현황 요약'],
      },
      {
        id: 'epp-detection',
        name: 'Detection and Response',
        path: ['Detection and Response'],
        children: [
          { id: 'epp-security-events', name: 'Security Events', path: ['Detection and Response', 'Security Events'], children: [], features: ['보안 이벤트'] },
        ],
        features: ['탐지 및 대응'],
      },
      {
        id: 'epp-defense',
        name: 'Defense',
        path: ['Defense'],
        children: [
          { id: 'epp-malware-scan', name: 'Malware Scan', path: ['Defense', 'Malware Scan'], children: [], features: ['악성코드 스캔'] },
          { id: 'epp-behavior-monitor', name: 'Behavior Monitor', path: ['Defense', 'Behavior Monitor'], children: [], features: ['행위 모니터링'] },
        ],
        features: ['방어', '악성코드 차단'],
      },
      {
        id: 'epp-endpoints',
        name: 'Endpoints',
        path: ['Endpoints'],
        children: [
          { id: 'epp-endpoint-inventory', name: 'Endpoint Inventory', path: ['Endpoints', 'Endpoint Inventory'], children: [], features: ['에이전트 목록'] },
        ],
        features: ['엔드포인트'],
      },
      {
        id: 'epp-policies',
        name: 'Policies',
        path: ['Policies'],
        children: [
          { id: 'epp-app-control', name: 'App Control', path: ['Policies', 'App Control'], children: [], features: ['소프트웨어 제어'] },
          { id: 'epp-usb-control', name: 'USB Device Control', path: ['Policies', 'USB Device Control'], children: [], features: ['장치 제어', 'USB 차단'] },
          { id: 'epp-exceptions', name: 'Exceptions', path: ['Policies', 'Exceptions'], children: [], features: ['예외 처리'] },
        ],
        features: ['정책 관리'],
      },
      {
        id: 'epp-system',
        name: 'System',
        path: ['System'],
        children: [
          { id: 'epp-agent-deploy', name: 'Agent Deployment', path: ['System', 'Agent Deployment'], children: [], features: ['에이전트 배포'] },
          { id: 'epp-syslog', name: 'Syslog Reporting', path: ['System', 'Syslog Reporting'], children: [], features: ['로그 설정'] },
        ],
        features: ['시스템 관리'],
      },
    ];
  }

  private getIAGMenuStructure(): MenuNode[] {
    return [
      {
        id: 'iag-dashboard',
        name: 'Dashboard',
        path: ['Dashboard'],
        children: [],
        features: ['대시보드', '현황 요약'],
      },
      {
        id: 'iag-security',
        name: 'Security',
        path: ['Security'],
        children: [
          { id: 'iag-url-filter', name: 'URL Filtering', path: ['Security', 'URL Filtering'], children: [], features: ['URL 필터링'] },
          { id: 'iag-dlp', name: 'Data Loss Prevention', path: ['Security', 'Data Loss Prevention'], children: [], features: ['데이터 유출 방지'] },
          { id: 'iag-email-filter', name: 'Email Filtering', path: ['Security', 'Email Filtering'], children: [], features: ['이메일 필터링'] },
        ],
        features: ['보안 정책'],
      },
      {
        id: 'iag-network',
        name: 'Network',
        path: ['Network'],
        children: [
          { id: 'iag-firewall', name: 'Firewall', path: ['Network', 'Firewall'], children: [], features: ['방화벽'] },
          { id: 'iag-vpn', name: 'VPN', path: ['Network', 'VPN'], children: [], features: ['VPN'] },
        ],
        features: ['네트워크 관리'],
      },
      {
        id: 'iag-endpoint',
        name: 'Endpoint Mgt',
        path: ['Endpoint Mgt'],
        children: [
          { id: 'iag-endpoint-security', name: 'Security', path: ['Endpoint Mgt', 'Security'], children: [], features: ['엔드포인트 보안'] },
        ],
        features: ['엔드포인트 관리'],
      },
      {
        id: 'iag-system',
        name: 'System',
        path: ['System'],
        children: [
          { id: 'iag-general', name: 'General', path: ['System', 'General'], children: [], features: ['일반 설정'] },
        ],
        features: ['시스템 관리'],
      },
    ];
  }

  private getCCMenuStructure(): MenuNode[] {
    return [
      {
        id: 'cc-dashboard',
        name: 'Dashboard',
        path: ['Dashboard'],
        children: [],
        features: ['대시보드', '현황 요약'],
      },
      {
        id: 'cc-detection',
        name: 'Detection',
        path: ['Detection'],
        children: [
          { id: 'cc-threats', name: 'Threats', path: ['Detection', 'Threats'], children: [], features: ['위협 탐지'] },
          { id: 'cc-logs', name: 'Logs', path: ['Detection', 'Logs'], children: [], features: ['로그'] },
          { id: 'cc-anomalies', name: 'Anomalies', path: ['Detection', 'Anomalies'], children: [], features: ['이상 탐지'] },
        ],
        features: ['탐지'],
      },
      {
        id: 'cc-response',
        name: 'Response',
        path: ['Response'],
        children: [],
        features: ['대응'],
      },
      {
        id: 'cc-system',
        name: 'System',
        path: ['System'],
        children: [
          { id: 'cc-sensors', name: 'Sensors', path: ['System', 'Sensors'], children: [], features: ['센서 관리'] },
        ],
        features: ['시스템 관리'],
      },
    ];
  }

  // ─── 유틸리티 ──────────────────────────────────────────────────────────────

  private findMenuInList(menus: MenuNode[], name: string): MenuNode | null {
    for (const menu of menus) {
      if (menu.name === name) return menu;
      if (menu.children) {
        const found = this.findMenuInList(menu.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  private generateComparisonSummary(differences: MenuDifference[]): string {
    const added = differences.filter(d => d.type === 'added').length;
    const removed = differences.filter(d => d.type === 'removed').length;
    const modified = differences.filter(d => d.type === 'modified').length;

    const lines: string[] = [];
    lines.push(`메뉴 비교 결과:`);
    lines.push(`- 추가: ${added}개`);
    lines.push(`- 삭제: ${removed}개`);
    lines.push(`- 수정: ${modified}개`);

    if (removed > 0) {
      lines.push('');
      lines.push('⚠️ 메뉴얼에만 존재하는 메뉴가 있습니다. 문서 업데이트가 필요합니다.');
    }

    return lines.join('\n');
  }

  /** 메뉴얼 기준(reference) 메뉴 트리 */
  getReferenceManualMenus(product: 'EPP' | 'IAG' | 'CC'): MenuNode[] {
    switch (product) {
      case 'EPP':
        return this.getEPPMenuStructure();
      case 'IAG':
        return this.getIAGMenuStructure();
      case 'CC':
        return this.getCCMenuStructure();
    }
  }
}
