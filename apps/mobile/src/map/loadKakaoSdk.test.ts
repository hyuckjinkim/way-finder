/** loadKakaoSdk — 타임아웃·실패 후 재시도(캐시 초기화). node 환경이라 document·kakao 전역을 최소 목으로. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type FakeScript = {
  id?: string;
  src: string;
  onload?: () => void;
  onerror?: () => void;
  remove: () => void;
  listeners: Record<string, Array<() => void>>;
  addEventListener: (type: string, fn: () => void) => void;
};

let scripts: FakeScript[];
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  scripts = [];
  g.document = {
    getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
    createElement: (): FakeScript => {
      const s: FakeScript = {
        src: '',
        listeners: {},
        remove: () => void scripts.splice(scripts.indexOf(s), 1),
        addEventListener: (type, fn) => void (s.listeners[type] ??= []).push(fn),
      };
      return s;
    },
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete g.document;
  delete g.kakao;
});

describe('loadKakaoSdk', () => {
  it('kakao.maps.load가 응답하지 않으면 타임아웃 reject, 다음 호출은 태그를 또 만들지 않고 maps.load만 다시', async () => {
    const { loadKakaoSdk, SDK_LOAD_TIMEOUT_MS } = await import('./loadKakaoSdk.js');
    const first = loadKakaoSdk('key');
    const assertion = expect(first).rejects.toThrow('타임아웃');
    g.kakao = { maps: { load: () => {} } }; // 스크립트가 전역을 만들지만 콜백을 영영 안 부름
    scripts[0]!.onload!();
    await vi.advanceTimersByTimeAsync(SDK_LOAD_TIMEOUT_MS);
    await assertion;

    const load = vi.fn();
    (g.kakao as { maps: { load: () => void } }).maps.load = load;
    void loadKakaoSdk('key').catch(() => {});
    void loadKakaoSdk('key').catch(() => {});
    expect(scripts).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('스크립트가 로딩 중에 타임아웃되면 다음 호출은 같은 태그를 기다린다', async () => {
    const { loadKakaoSdk, SDK_LOAD_TIMEOUT_MS } = await import('./loadKakaoSdk.js');
    const first = loadKakaoSdk('key');
    const assertion = expect(first).rejects.toThrow('타임아웃');
    await vi.advanceTimersByTimeAsync(SDK_LOAD_TIMEOUT_MS);
    await assertion;

    const kakao = { maps: { load: (cb: () => void) => cb() } };
    const second = loadKakaoSdk('key');
    expect(scripts).toHaveLength(1);
    g.kakao = kakao;
    for (const fn of scripts[0]!.listeners.load ?? []) fn();
    await expect(second).resolves.toBe(kakao);
  });

  it('스크립트 로드 실패 → reject 후 재시도 가능', async () => {
    const { loadKakaoSdk } = await import('./loadKakaoSdk.js');
    const first = loadKakaoSdk('key');
    scripts[0]!.onerror!();
    await expect(first).rejects.toThrow('로드 실패');
    expect(scripts).toHaveLength(0); // 실패한 태그는 지운다
    void loadKakaoSdk('key').catch(() => {});
    expect(scripts).toHaveLength(1);
  });

  it('정상 로드는 resolve되고 같은 Promise를 재사용한다', async () => {
    const { loadKakaoSdk } = await import('./loadKakaoSdk.js');
    const kakao = { maps: { load: (cb: () => void) => cb() } };
    const p = loadKakaoSdk('key');
    expect(loadKakaoSdk('key')).toBe(p);
    g.kakao = kakao;
    scripts[0]!.onload!();
    await expect(p).resolves.toBe(kakao);
    expect(scripts).toHaveLength(1);
  });
});
