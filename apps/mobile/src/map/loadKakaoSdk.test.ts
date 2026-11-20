/** loadKakaoSdk — 타임아웃·실패 후 재시도(캐시 초기화). node 환경이라 document·kakao 전역을 최소 목으로. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type FakeScript = { src: string; onload?: () => void; onerror?: () => void };

let scripts: FakeScript[];
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  scripts = [];
  g.document = {
    getElementById: () => null,
    createElement: () => ({ src: '' }),
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete g.document;
  delete g.kakao;
});

describe('loadKakaoSdk', () => {
  it('kakao.maps.load가 응답하지 않으면 타임아웃 reject, 다음 호출은 다시 주입한다', async () => {
    const { loadKakaoSdk, SDK_LOAD_TIMEOUT_MS } = await import('./loadKakaoSdk.js');
    g.kakao = { maps: { load: () => {} } }; // 콜백을 영영 안 부름
    const first = loadKakaoSdk('key');
    const assertion = expect(first).rejects.toThrow('타임아웃');
    scripts[0]!.onload!();
    await vi.advanceTimersByTimeAsync(SDK_LOAD_TIMEOUT_MS);
    await assertion;

    void loadKakaoSdk('key').catch(() => {});
    expect(scripts).toHaveLength(2);
  });

  it('스크립트 로드 실패 → reject 후 재시도 가능', async () => {
    const { loadKakaoSdk } = await import('./loadKakaoSdk.js');
    const first = loadKakaoSdk('key');
    scripts[0]!.onerror!();
    await expect(first).rejects.toThrow('로드 실패');
    void loadKakaoSdk('key').catch(() => {});
    expect(scripts).toHaveLength(2);
  });

  it('정상 로드는 resolve되고 같은 Promise를 재사용한다', async () => {
    const { loadKakaoSdk } = await import('./loadKakaoSdk.js');
    const kakao = { maps: { load: (cb: () => void) => cb() } };
    g.kakao = kakao;
    const p = loadKakaoSdk('key');
    expect(loadKakaoSdk('key')).toBe(p);
    scripts[0]!.onload!();
    await expect(p).resolves.toBe(kakao);
    expect(scripts).toHaveLength(1);
  });
});
