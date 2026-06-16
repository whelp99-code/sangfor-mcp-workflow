/**
 * 파이프라인 테스트
 */

import { describe, it, expect } from 'vitest';
import { createPipeline, getPipeline, listPipelines } from '@sangfor/workflow-core';

describe('Pipeline', () => {
  it('should create a pipeline', () => {
    const pipeline = createPipeline('test-pipeline', ['step1', 'step2', 'step3']);

    expect(pipeline.id).toBeDefined();
    expect(pipeline.name).toBe('test-pipeline');
    expect(pipeline.status).toBe('pending');
    expect(pipeline.steps).toHaveLength(3);
    expect(pipeline.steps[0].name).toBe('step1');
    expect(pipeline.steps[0].status).toBe('pending');
  });

  it('should get a pipeline by ID', () => {
    const pipeline = createPipeline('test-pipeline', ['step1']);
    const retrieved = getPipeline(pipeline.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(pipeline.id);
    expect(retrieved?.name).toBe('test-pipeline');
  });

  it('should list all pipelines', () => {
    const initialCount = listPipelines().length;

    createPipeline('pipeline-1', ['step1']);
    createPipeline('pipeline-2', ['step2']);

    const pipelines = listPipelines();
    expect(pipelines.length).toBe(initialCount + 2);
  });
});
