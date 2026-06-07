import { describe, it, expect } from 'vitest';
import worker from './index.js';

describe('proxy placeholder worker', () => {
  it('fetch는 키 없이 ok 상태를 반환', async () => {
    const res = await worker.fetch();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; phase: number };
    expect(body.status).toBe('ok');
    expect(body.phase).toBe(1);
  });
});
