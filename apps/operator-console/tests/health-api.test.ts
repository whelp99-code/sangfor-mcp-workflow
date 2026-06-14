/**
 * Health Check API 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRoutes } from '../src/routes';
import { apiKeyAuth } from '../src/middleware/auth';

describe('Health Check API', () => {
  const API_KEY = process.env.SANGFOR_API_KEY || 'test-api-key';
  let app: express.Application;
  
  beforeAll(() => {
    process.env.SANGFOR_API_KEY = 'test-api-key';
    app = express();
    app.use(express.json());
    app.use('/api/devices/health', apiKeyAuth, healthRoutes);
  });

  afterAll(() => {
    delete process.env.SANGFOR_API_KEY;
  });

  describe('GET /api/devices/health', () => {
    it('should return device list', async () => {
      const res = await request(app)
        .get('/api/devices/health')
        .set('X-API-Key', API_KEY);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return 401 without API key', async () => {
      const res = await request(app)
        .get('/api/devices/health');
      
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid API key', async () => {
      const res = await request(app)
        .get('/api/devices/health')
        .set('X-API-Key', 'invalid-key');
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/health/:id', () => {
    it('should return device detail', async () => {
      const res = await request(app)
        .get('/api/devices/health/epp-1')
        .set('X-API-Key', API_KEY);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'epp-1');
      expect(res.body).toHaveProperty('cpu');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('disk');
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .get('/api/devices/health/non-existent')
        .set('X-API-Key', API_KEY);
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/devices/health/check', () => {
    it('should check devices', async () => {
      const res = await request(app)
        .post('/api/devices/health/check')
        .set('X-API-Key', API_KEY)
        .send({ deviceIds: ['epp-1', 'iag-1'] });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body.results).toHaveLength(2);
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/devices/health/check')
        .set('X-API-Key', API_KEY)
        .send({ deviceIds: 'invalid' });
      
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty array', async () => {
      const res = await request(app)
        .post('/api/devices/health/check')
        .set('X-API-Key', API_KEY)
        .send({ deviceIds: [] });
      
      expect(res.status).toBe(400);
    });
  });
});
