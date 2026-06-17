import { describe, it, expect } from 'vitest';
import {
  buildDeviceSnapshotFromCollection,
  buildHealthCheckFromCollection,
} from '@sangfor/health-checker';
import type { CcDeviceCollection } from '@sangfor/health-checker';

const fixture: CcDeviceCollection = {
  product: 'CC',
  targetUrl: 'https://10.80.1.107',
  deviceId: 'cc-device-test',
  version: 'V3.0.98C',
  collectedAt: '2026-06-17T12:00:00.000Z',
  loginUrl: 'https://10.80.1.107/ui/#/overview',
  menus: [
    {
      id: 'overview',
      name: 'Overview',
      menuPath: ['Dashboard', 'Overview'],
      hashRoute: '/#/overview',
      url: 'https://10.80.1.107/ui/#/overview',
      status: 'ok',
      capturedAt: '2026-06-17T12:00:00.000Z',
      domSummary: {
        title: 'Cyber Command',
        url: 'https://10.80.1.107/ui/#/overview',
        panels: 115,
        tables: 5,
        gridRows: 20,
        labels: ['Pending Risks 537', 'GravityRAT', '10.80.1.102'],
        metrics: { pendingRisks: 537, pendingServers: 2, pendingHosts: 16, hotIncidents: 9 },
      },
    },
    {
      id: 'assets',
      name: 'Sensors',
      menuPath: ['Assets', 'Sensors'],
      hashRoute: '/#/assets',
      url: 'https://10.80.1.107/ui/#/assets',
      status: 'ok',
      capturedAt: '2026-06-17T12:00:00.000Z',
      domSummary: {
        title: 'Cyber Command',
        url: 'https://10.80.1.107/ui/#/assets',
        panels: 10,
        tables: 2,
        gridRows: 5,
        labels: [],
        metrics: {},
      },
    },
  ],
};

describe('CC snapshot builder', () => {
  it('builds DeviceSnapshot from collection', () => {
    const snapshot = buildDeviceSnapshotFromCollection(fixture);
    expect(snapshot.product).toBe('CC');
    expect(snapshot.version).toBe('V3.0.98C');
    expect(snapshot.alarms.length).toBeGreaterThan(0);
    expect(snapshot.objects.some((o) => o.name === '10.80.1.102')).toBe(true);
  });

  it('builds HealthCheckResult from collection metrics', () => {
    const result = buildHealthCheckFromCollection(fixture);
    expect(result.product).toBe('CC');
    expect(result.items.length).toBe(4);
    const dashboard = result.items.find((i) => i.itemId === 'cc_dashboard');
    expect(dashboard?.collectedData?.criticalThreats).toBe(9);
    expect(dashboard?.status).toBe('critical');
  });
});
