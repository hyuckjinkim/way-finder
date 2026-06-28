/**
 * apiClient — 프록시 URL env 변수명 회귀 테스트.
 *
 * 배경(GAP1): 앱은 한때 `EXPO_PUBLIC_API_URL`만 읽었으나 문서·.env.example·app.config.ts는
 * `EXPO_PUBLIC_PROXY_BASE_URL`을 안내했다. 이름이 어긋나 키를 넣어도 앱이 데모 모드에 머무는
 * 버그를 방지하기 위해, 정식 이름을 우선 읽고 레거시 이름을 폴백으로 둔다.
 *
 * isDemoMode/API_BASE_URL은 모듈 로드 시점에 결정되므로 vi.resetModules + 동적 import로 격리한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PROXY = 'EXPO_PUBLIC_PROXY_BASE_URL';
const LEGACY = 'EXPO_PUBLIC_API_URL';

function clearEnv(): void {
  const env = process.env as Record<string, string | undefined>;
  delete env[PROXY];
  delete env[LEGACY];
}

describe('apiClient — 프록시 URL env 변수명', () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });
  afterEach(() => {
    clearEnv();
    vi.resetModules();
  });

  it('정식 이름(EXPO_PUBLIC_PROXY_BASE_URL) 설정 → 실 모드', async () => {
    (process.env as Record<string, string>)[PROXY] = 'https://proxy.example';
    vi.resetModules();
    const { isDemoMode } = await import('./apiClient.js');
    expect(isDemoMode).toBe(false);
  });

  it('레거시 이름(EXPO_PUBLIC_API_URL)만 설정 → 폴백으로 실 모드', async () => {
    (process.env as Record<string, string>)[LEGACY] = 'https://legacy.example';
    vi.resetModules();
    const { isDemoMode } = await import('./apiClient.js');
    expect(isDemoMode).toBe(false);
  });

  it('둘 다 미설정 → 데모 모드', async () => {
    vi.resetModules();
    const { isDemoMode } = await import('./apiClient.js');
    expect(isDemoMode).toBe(true);
  });

  it('정식 이름이 레거시보다 우선 — apiFetch가 PROXY URL로 호출', async () => {
    (process.env as Record<string, string>)[PROXY] = 'https://proxy.example';
    (process.env as Record<string, string>)[LEGACY] = 'https://legacy.example';
    vi.resetModules();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const { apiFetch } = await import('./apiClient.js');
    await apiFetch('/v1/ping');
    expect(fetchSpy).toHaveBeenCalledWith('https://proxy.example/v1/ping');
    fetchSpy.mockRestore();
  });
});
