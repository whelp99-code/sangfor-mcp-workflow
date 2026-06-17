/**
 * CC 수집 결과 → DeviceSnapshot + HealthCheckResult 변환
 * @deprecated device-snapshot-builder.js 사용
 */

export {
  buildDeviceSnapshotFromCollection,
  buildHealthCheckFromCollection,
  saveCcDeviceCollection,
  saveDeviceCollection,
  newCcDeviceId,
  newDeviceId,
  collectionTimestamp,
} from './device-snapshot-builder.js';
