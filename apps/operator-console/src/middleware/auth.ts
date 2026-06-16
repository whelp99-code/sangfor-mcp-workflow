/**
 * 인증 미들웨어
 * 
 * API 키 기반 인증 (fail-fast)
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('auth-middleware');

// 환경변수 미설정 시 서버 기동 거부
const API_KEY = process.env.SANGFOR_API_KEY as string;
if (!API_KEY) {
  throw new Error('SANGFOR_API_KEY environment variable is required');
}

/**
 * API 키 인증 미들웨어
 * 
 * X-API-Key 헤더 검증
 * 타이밍 공격 방지를 위해 timingSafeEqual 사용
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    log.warn(`API key missing for ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'API key required' });
  }
  
  // 타이밍 공격 방지
  const apiKeyBuffer = Buffer.from(apiKey);
  const validKeyBuffer = Buffer.from(API_KEY);
  
  if (apiKeyBuffer.length !== validKeyBuffer.length || 
      !timingSafeEqual(apiKeyBuffer, validKeyBuffer)) {
    log.warn(`Invalid API key for ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  log.info(`Authenticated ${req.method} ${req.path}`);
  next();
}
