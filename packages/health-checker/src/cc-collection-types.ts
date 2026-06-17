/**
 * CC (Cyber Command) 실장비 수집 타입 — device-collection-types 호환 별칭
 */

export type {
  DeviceMenuRoute as CcMenuRoute,
  DeviceDomSummary as CcDomSummary,
  DeviceMenuCapture as CcMenuCapture,
} from './device-collection-types.js';

export { CC_MENU_ROUTES } from './device-collection-types.js';

import type { DeviceCollection } from './device-collection-types.js';

export type CcDeviceCollection = DeviceCollection & { product: 'CC' };
