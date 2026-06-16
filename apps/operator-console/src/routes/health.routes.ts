/**
 * Health Check 라우트
 * 
 * 장비 상태 확인 API
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('health-routes');
const router: Router = Router();

// ─── 모킹 데이터 ──────────────────────────────────────────────────────────

interface Device {
  id: string;
  name: string;
  ip: string;
  status: 'healthy' | 'warning' | 'critical';
  lastCheck: string;
}

interface DeviceDetail extends Device {
  cpu: number;
  memory: number;
  disk: number;
}

const MOCK_DEVICES: Record<string, DeviceDetail> = {
  'epp-1': {
    id: 'epp-1',
    name: 'EPP',
    ip: '10.80.1.106',
    status: 'healthy',
    cpu: 45,
    memory: 62,
    disk: 78,
    lastCheck: new Date().toISOString(),
  },
  'iag-1': {
    id: 'iag-1',
    name: 'IAG',
    ip: '10.80.1.108',
    status: 'healthy',
    cpu: 32,
    memory: 55,
    disk: 65,
    lastCheck: new Date().toISOString(),
  },
  'cc-1': {
    id: 'cc-1',
    name: 'CC',
    ip: '10.80.1.107',
    status: 'warning',
    cpu: 89,
    memory: 92,
    disk: 45,
    lastCheck: new Date().toISOString(),
  },
};

// ─── 라우트 ──────────────────────────────────────────────────────────────

/**
 * GET /api/devices/health
 * 장비 목록 조회
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices: Device[] = Object.values(MOCK_DEVICES).map(({ cpu, memory, disk, ...rest }) => rest);
    log.info(`Returning ${devices.length} devices`);
    res.json(devices);
  } catch (error) {
    log.error(`Failed to get devices: ${error}`);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

/**
 * GET /api/devices/health/:id
 * 장비 상세 조회
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deviceId = String(req.params.id ?? '');
    const device = MOCK_DEVICES[deviceId];
    
    if (!device) {
      log.warn(`Device not found: ${deviceId}`);
      return res.status(404).json({ error: 'Device not found' });
    }
    
    log.info(`Returning device detail: ${device.id}`);
    res.json(device);
  } catch (error) {
    log.error(`Failed to get device: ${error}`);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

/**
 * POST /api/devices/health/check
 * 장비 상태 확인 실행
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { deviceIds } = req.body;
    
    // 입력 검증
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds array required' });
    }
    
    if (deviceIds.length > 10) {
      return res.status(400).json({ error: 'deviceIds max length is 10' });
    }
    
    const results = (deviceIds as string[]).map((id: string) => {
      const device = MOCK_DEVICES[id];
      return {
        deviceId: id,
        exists: !!device,
        status: device?.status || 'unknown',
        timestamp: new Date().toISOString(),
        responseTime: 50 + Math.floor(Math.random() * 50), // 50-100ms
      };
    });
    
    log.info(`Checked ${deviceIds.length} devices`);
    res.json({ results });
  } catch (error) {
    log.error(`Failed to check devices: ${error}`);
    res.status(500).json({ error: 'Failed to check devices' });
  }
});

export default router;
