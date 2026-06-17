/**
 * Device Snapshot Collector — 장치 상태 수집기
 *
 * EPP/IAG/CC 장치의 현재 상태를 표준화된 DeviceSnapshot으로 수집.
 * health-checker의 collectData 패턴을 확장하여 구조화된 스냅샷 생성.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { Logger } from '@sangfor/workflow-shared';
import type {
  DeviceSnapshot,
  SangforProduct,
  AccessMethod,
  LicenseInfo,
  DeviceObject,
  DevicePolicy,
  AuthSource,
  NetworkInfo,
  AlarmEntry,
  RawRef,
} from '@sangfor/workflow-engine';

const log = createLogger('device-snapshot-collector');

// ─── Credentials ───────────────────────────────────────────────────────────

export interface DeviceCredentials {
  username: string;
  password: string;
}

// ─── Partial Snapshot ──────────────────────────────────────────────────────

export interface PartialSnapshotResult {
  snapshot: DeviceSnapshot;
  failures: Array<{
    section: string;
    error: string;
    retriable: boolean;
  }>;
  completeness: number; // 0-1
}

// ─── Device Snapshot Collector ─────────────────────────────────────────────

export class DeviceSnapshotCollector {
  private log: Logger;

  constructor() {
    this.log = log;
  }

  /**
   * 장치 스냅샷 수집 (전체)
   * 실패 시 partial snapshot 반환
   */
  async collectSnapshot(
    product: SangforProduct,
    targetUrl: string,
    credentials: DeviceCredentials,
  ): Promise<PartialSnapshotResult> {
    const failures: Array<{ section: string; error: string; retriable: boolean }> = [];
    const collectedAt = nowISO();
    const deviceId = nowId('device');

    this.log.info(`Collecting snapshot for ${product} at ${targetUrl}`);

    // 각 섹션을 독립적으로 수집 (하나 실패해도 나머지 계속)
    const version = await this.collectSection(
      'version',
      () => this.collectVersion(product, targetUrl, credentials),
      failures,
      'unknown',
    );

    const licenses = await this.collectSection(
      'licenses',
      () => this.collectLicenses(product, targetUrl, credentials),
      failures,
      [] as LicenseInfo[],
    );

    const policies = await this.collectSection(
      'policies',
      () => this.collectPolicies(product, targetUrl, credentials),
      failures,
      [] as DevicePolicy[],
    );

    const objects = await this.collectSection(
      'objects',
      () => this.collectObjects(product, targetUrl, credentials),
      failures,
      [] as DeviceObject[],
    );

    const authSources = await this.collectSection(
      'authSources',
      () => this.collectAuthSources(product, targetUrl, credentials),
      failures,
      [] as AuthSource[],
    );

    const network = await this.collectSection(
      'network',
      () => this.collectNetwork(product, targetUrl, credentials),
      failures,
      { interfaces: [] } as NetworkInfo,
    );

    const alarms = await this.collectSection(
      'alarms',
      () => this.collectAlarms(product, targetUrl, credentials),
      failures,
      [] as AlarmEntry[],
    );

    const rawRefs: RawRef[] = [
      {
        source: 'collector',
        path: `${product}/snapshot/${deviceId}`,
        capturedAt: collectedAt,
      },
    ];

    const snapshot: DeviceSnapshot = {
      deviceId,
      product,
      version,
      collectedAt,
      accessMethod: 'api',
      licenses,
      objects,
      policies,
      authSources,
      network,
      alarms,
      rawRefs,
    };

    const totalSections = 7;
    const failedSections = failures.length;
    const completeness = (totalSections - failedSections) / totalSections;

    if (failedSections > 0) {
      this.log.warn(
        `Partial snapshot: ${failedSections}/${totalSections} sections failed (${Math.round(completeness * 100)}% complete)`,
      );
    } else {
      this.log.info('Full snapshot collected successfully');
    }

    return { snapshot, failures, completeness };
  }

  // ─── Individual Collectors ─────────────────────────────────────────────

  async collectVersion(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<string> {
    this.log.debug(`Collecting version for ${product} at ${targetUrl}`);
    // TODO: sangfor-engineer-mcp 연동
    // 현재는 목업 데이터 반환
    return `${product} v5.0.0`;
  }

  async collectLicenses(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<LicenseInfo[]> {
    this.log.debug(`Collecting licenses for ${product} at ${targetUrl}`);
    // TODO: API/SSH를 통한 라이선스 수집
    return [
      {
        key: `${product}-LICENSE-001`,
        type: 'Enterprise',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      },
    ];
  }

  async collectPolicies(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<DevicePolicy[]> {
    this.log.debug(`Collecting policies for ${product} at ${targetUrl}`);
    // TODO: 정책 목록 수집
    return [];
  }

  async collectObjects(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<DeviceObject[]> {
    this.log.debug(`Collecting objects for ${product} at ${targetUrl}`);
    // TODO: 객체 목록 수집
    return [];
  }

  async collectAuthSources(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<AuthSource[]> {
    this.log.debug(`Collecting auth sources for ${product} at ${targetUrl}`);
    // TODO: 인증 소스 수집
    return [
      {
        id: 'local',
        name: 'Local Authentication',
        type: 'local',
        enabled: true,
      },
    ];
  }

  async collectNetwork(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<NetworkInfo> {
    this.log.debug(`Collecting network info for ${product} at ${targetUrl}`);
    // TODO: 네트워크 정보 수집
    return {
      interfaces: [
        {
          name: 'eth0',
          ip: new URL(targetUrl).hostname,
          mask: '255.255.255.0',
          status: 'up',
        },
      ],
      dns: ['8.8.8.8'],
    };
  }

  async collectAlarms(
    product: SangforProduct,
    targetUrl: string,
    _credentials: DeviceCredentials,
  ): Promise<AlarmEntry[]> {
    this.log.debug(`Collecting alarms for ${product} at ${targetUrl}`);
    // TODO: 알람 수집
    return [];
  }

  // ─── Helper ─────────────────────────────────────────────────────────────

  private async collectSection<T>(
    section: string,
    collector: () => Promise<T>,
    failures: Array<{ section: string; error: string; retriable: boolean }>,
    fallback: T,
  ): Promise<T> {
    try {
      return await collector();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn(`Section '${section}' collection failed: ${message}`);
      failures.push({
        section,
        error: message,
        retriable: true,
      });
      return fallback;
    }
  }
}
