/**
 * EPP / IAG / CC 실장비 수집 타입 및 메뉴 라우트
 */

export type SangforProduct = 'EPP' | 'IAG' | 'CC';

export interface DeviceMenuRoute {
  id: string;
  name: string;
  menuPath: string[];
  hashRoute: string;
}

export interface DeviceDomSummary {
  title: string;
  url: string;
  panels: number;
  tables: number;
  gridRows: number;
  labels: string[];
  metrics: Record<string, string | number>;
}

export interface DeviceMenuCapture {
  id: string;
  name: string;
  menuPath: string[];
  hashRoute: string;
  url: string;
  status: 'ok' | 'error';
  error?: string;
  screenshotPath?: string;
  domPath?: string;
  domSummary?: DeviceDomSummary;
  capturedAt: string;
}

export interface DeviceCollection {
  product: SangforProduct;
  targetUrl: string;
  deviceId: string;
  version: string;
  collectedAt: string;
  loginUrl: string;
  menus: DeviceMenuCapture[];
}

export interface ProductCollectionConfig {
  product: SangforProduct;
  defaultTarget: string;
  urlPathPrefix: string;
}

export const PRODUCT_COLLECTION_CONFIGS: Record<SangforProduct, ProductCollectionConfig> = {
  EPP: {
    product: 'EPP',
    defaultTarget: 'https://10.80.1.106',
    urlPathPrefix: '',
  },
  IAG: {
    product: 'IAG',
    defaultTarget: 'https://10.80.1.108',
    urlPathPrefix: '',
  },
  CC: {
    product: 'CC',
    defaultTarget: 'https://10.80.1.107',
    urlPathPrefix: '/ui',
  },
};

export function buildMenuUrl(
  targetUrl: string,
  product: SangforProduct,
  hashRoute: string,
): string {
  const base = targetUrl.replace(/\/$/, '');
  const prefix = PRODUCT_COLLECTION_CONFIGS[product].urlPathPrefix;
  return `${base}${prefix}${hashRoute}`;
}

export const EPP_MENU_ROUTES: DeviceMenuRoute[] = [
  { id: 'dashboard', name: 'Dashboard', menuPath: ['Dashboard'], hashRoute: '/#/dashboard' },
  { id: 'agents', name: 'Agent List', menuPath: ['Assets', 'Endpoint/Agent List'], hashRoute: '/#/assets/endpoint' },
  { id: 'malware_policy', name: 'Malware Protection', menuPath: ['Policy', 'Malware/Ransomware Protection'], hashRoute: '/#/policy/antiMalware' },
  { id: 'device_control', name: 'Device Control', menuPath: ['Policy', 'Device Control'], hashRoute: '/#/policy/deviceControl' },
  { id: 'app_control', name: 'Software Control', menuPath: ['Policy', 'Software Control'], hashRoute: '/#/policy/appControl' },
  { id: 'scan', name: 'Scan', menuPath: ['Scan'], hashRoute: '/#/scan' },
  { id: 'events', name: 'Events', menuPath: ['Events'], hashRoute: '/#/event' },
  { id: 'syslog', name: 'Syslog', menuPath: ['System', 'Syslog'], hashRoute: '/#/system/syslog' },
  { id: 'deployment', name: 'Agent Deployment', menuPath: ['Deployment', 'Agent Deployment'], hashRoute: '/#/deployment' },
];

export const IAG_MENU_ROUTES: DeviceMenuRoute[] = [
  { id: 'access_policy', name: 'Access Control', menuPath: ['Policy', 'Access Control'], hashRoute: '/#/onlineActivities/accessPolicy' },
  { id: 'dlp', name: 'DLP Policy', menuPath: ['Policy', 'DLP'], hashRoute: '/#/activityAudit/dlpPolicy' },
  { id: 'dlp_events', name: 'DLP Events', menuPath: ['Activity Audit', 'DLP Events'], hashRoute: '/#/activityAudit/dlpEvent' },
  { id: 'endpoint_compliance', name: 'Endpoint Compliance', menuPath: ['Authentication', 'Endpoint Compliance'], hashRoute: '/#/authentication/endpointCompliance' },
  { id: 'internet_logs', name: 'Internet Access Logs', menuPath: ['Logs', 'Internet Access Logs'], hashRoute: '/#/logs/internetAccess' },
];

export const CC_MENU_ROUTES: DeviceMenuRoute[] = [
  { id: 'overview', name: 'Overview', menuPath: ['Dashboard', 'Overview'], hashRoute: '/#/overview' },
  { id: 'dashboard', name: 'Security Operations', menuPath: ['Dashboard', 'Security Operations'], hashRoute: '/#/dashboard' },
  { id: 'detection_logs', name: 'Detection Logs', menuPath: ['Detection', 'Logs'], hashRoute: '/#/detection/logs' },
  { id: 'detection_threats', name: 'Threats', menuPath: ['Detection', 'Threats'], hashRoute: '/#/detection/threats' },
  { id: 'incidents', name: 'Incident List', menuPath: ['Incidents', 'Incident List'], hashRoute: '/#/incidents' },
  { id: 'alerts', name: 'Alert Rules', menuPath: ['Alerts', 'Alert Rules'], hashRoute: '/#/alerts' },
  { id: 'response', name: 'Response', menuPath: ['Response'], hashRoute: '/#/response' },
  { id: 'assets', name: 'Sensors/Connectors', menuPath: ['Assets', 'Sensors'], hashRoute: '/#/assets' },
  { id: 'events', name: 'Event Sources', menuPath: ['Events', 'Event Sources'], hashRoute: '/#/events' },
  { id: 'soar', name: 'SOAR Playbooks', menuPath: ['SOAR', 'Playbooks'], hashRoute: '/#/soar' },
  { id: 'system', name: 'System Integrations', menuPath: ['System', 'Integrations'], hashRoute: '/#/system' },
];

export function getMenuRoutes(product: SangforProduct): DeviceMenuRoute[] {
  switch (product) {
    case 'EPP':
      return EPP_MENU_ROUTES;
    case 'IAG':
      return IAG_MENU_ROUTES;
    case 'CC':
      return CC_MENU_ROUTES;
  }
}
