/**
 * @sangfor/screenshot PRODUCT_CONFIGS 와 동일한 메뉴 정의 (메뉴 클릭 수집용)
 */

import type { SangforProduct } from './sangfor-console-login.js';

export interface MenuPathStep {
  menu: string;
  submenu?: string;
}

export const PRODUCT_MENU_STEPS: Record<SangforProduct, MenuPathStep[]> = {
  EPP: [
    { menu: 'Dashboard' },
    { menu: 'Assets', submenu: 'Endpoint/Agent List' },
    { menu: 'Policy', submenu: 'Malware/Ransomware Protection' },
    { menu: 'Policy', submenu: 'Exceptions' },
    { menu: 'Policy', submenu: 'Device Control' },
    { menu: 'Policy', submenu: 'Software Control' },
    { menu: 'System', submenu: 'Update Management' },
    { menu: 'System', submenu: 'Syslog' },
    { menu: 'Deployment', submenu: 'Agent Deployment' },
  ],
  IAG: [
    { menu: 'Dashboard' },
    { menu: 'Status' },
    { menu: 'Access Mgt' },
    { menu: 'Online Activities' },
    { menu: 'Activity Audit' },
    { menu: 'Endpoint Mgt' },
    { menu: 'System' },
    { menu: 'Logs', submenu: 'Internet Access Logs' },
  ],
  CC: [
    { menu: 'Dashboard', submenu: 'Security Operations' },
    { menu: 'Assets', submenu: 'Sensors/Connectors' },
    { menu: 'Events', submenu: 'Event Sources' },
    { menu: 'Incidents', submenu: 'Incident List' },
    { menu: 'Alerts', submenu: 'Alert Rules' },
    { menu: 'SOAR', submenu: 'Playbooks' },
    { menu: 'System', submenu: 'Integrations' },
  ],
};

export function menuStepId(step: MenuPathStep): string {
  const raw = step.submenu ? `${step.menu}_${step.submenu}` : step.menu;
  return raw.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase();
}

export function menuStepLabel(step: MenuPathStep): string {
  return step.submenu ? `${step.menu} > ${step.submenu}` : step.menu;
}

export function menuStepPath(step: MenuPathStep): string[] {
  return step.submenu ? [step.menu, step.submenu] : [step.menu];
}
