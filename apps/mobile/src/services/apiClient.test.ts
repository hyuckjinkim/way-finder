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

// 회귀: `(process.env as any).EXPO_PUBLIC_X`는 babel 인라이너가 못 찾아 웹 번들에 값이 빠진다
// (배포 웹이 데모 모드로 돌던 원인, 2026-11-18). 앱 소스에 캐스트 래핑 env 접근이 없어야 한다.
describe('EXPO_PUBLIC env 접근 — 맨 점 표기만 (웹 인라인 조건)', () => {
  it('src/·app/에 (process.env as …) 패턴 없음', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules' && !name.startsWith('.')) walk(p); continue; }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        if (/\(\s*process\.env\s+as\b/.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(join(__dirname, '..')); // src/
    walk(join(__dirname, '../../app'));
    expect(offenders).toEqual([]);
  });
});
