import { afterEach, describe, expect, it, vi } from 'vitest';
import { koreaTransitRoute } from './koreaTransit.js';
import type { OdsayPath } from './odsayTransit.js';

const A = { lat: 37.5, lng: 127.0 };
const B = { lat: 37.6, lng: 127.1 };

function path(payment: number, mapObj?: string, code = 2, busType = 11): OdsayPath {
  return {
    pathType: 3,
    info: { totalTime: 30, payment, ...(mapObj ? { mapObj } : {}) },
    subPath: [
      { trafficType: 3, sectionTime: 3, distance: 200 },
      {
        trafficType: 1, sectionTime: 20, distance: 9000,
        lane: [{ name: '수도권 2호선', subwayCode: code }],
        startName: '구로디지털단지', endName: '강남',
        startX: 127.0, startY: 37.5, endX: 127.05, endY: 37.55,
      },
      {
        trafficType: 2, sectionTime: 7, distance: 2000,
        lane: [{ busNo: '402', type: busType }],
        startX: 127.05, startY: 37.55, endX: 127.1, endY: 37.6,
      },
    ],
  };
}

// 실 loadLane 응답 형태(result.lane[].section[].graphPos[{x,y}]) — lane 순서 = 대중교통 subPath 순서.
const LANE_BODY = {
  result: {
    lane: [
      { class: 2, type: 2, section: [{ graphPos: [{ x: 127.0, y: 37.5 }, { x: 127.02, y: 37.52 }] }, { graphPos: [{ x: 127.05, y: 37.55 }] }] },
      { class: 1, type: 11, section: [{ graphPos: [{ x: 127.05, y: 37.55 }, { x: 127.07, y: 37.57 }, { x: 127.1, y: 37.6 }] }] },
    ],
  },
};

function mockFetch(laneResponder: () => Response | Promise<Response>, paths: OdsayPath[]) {
  const fn = vi.fn(async (url: string) =>
    url.includes('loadLane') ? laneResponder() : new Response(JSON.stringify({ result: { path: paths } })),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}
const ok = (b: unknown) => new Response(JSON.stringify(b));
const req = (stops = [A, B]) => ({ stops, mode: 'transit' as const });

afterEach(() => vi.unstubAllGlobals());

describe('koreaTransitRoute', () => {
  it('sets lineColor (subway code, bus type), unknown -> undefined, and fare', async () => {
    mockFetch(() => ok({}), [path(1550, undefined, 2, 11), path(1250, undefined, 999, 999)]);
    const r = await koreaTransitRoute(req(), 'k');
    expect(r.fare).toBe(1550);
    expect(r.legs.map((l) => l.transit?.lineColor)).toEqual([undefined, '#00A84D', '#3D5BAB']);
    expect(r.legs[1]?.transit).toMatchObject({ fromStop: '구로디지털단지', toStop: '강남' });
    expect(r.alternatives?.[0]?.legs.map((l) => l.transit?.lineColor)).toEqual([undefined, undefined, undefined]);
    expect(r.alternatives?.[0]?.fare).toBe(1250);
  });

  it('caps alternatives at 4 and makes exactly 1 search + 1 loadLane call', async () => {
    const fn = mockFetch(() => ok(LANE_BODY), Array.from({ length: 8 }, (_, i) => path(1000 + i, i === 0 ? '12:2:1:5@34:1:2:6' : undefined)));
    const r = await koreaTransitRoute(req(), 'k');
    expect(r.alternatives).toHaveLength(4);
    expect(fn).toHaveBeenCalledTimes(2);
    const laneUrl = fn.mock.calls[1]![0];
    expect(laneUrl).toContain('loadLane?lang=0&mapObject=0:0@12:2:1:5@34:1:2:6&apiKey=k');
  });

  it('replaces transit coords with loadLane graphPos, leaves walk legs', async () => {
    mockFetch(() => ok(LANE_BODY), [path(1550, '12:2:1:5@34:1:2:6')]);
    const r = await koreaTransitRoute(req(), 'k');
    expect(r.alternatives).toBeUndefined();
    expect(r.legs[1]!.coords).toEqual([
      { lat: 37.5, lng: 127.0 }, { lat: 37.52, lng: 127.02 }, { lat: 37.55, lng: 127.05 },
    ]);
    expect(r.legs[2]!.coords).toHaveLength(3);
    expect(r.legs[0]!.coords).toHaveLength(2);
  });

  it.each([
    ['http error', () => new Response('x', { status: 500 })],
    ['error body', () => ok({ error: { code: '-8' } })],
    ['lane count mismatch', () => ok({ result: { lane: [LANE_BODY.result.lane[0]] } })],
    ['network failure', () => Promise.reject(new Error('net'))],
  ])('keeps original coords on loadLane %s', async (_n, lane) => {
    mockFetch(lane, [path(1550, '12:2:1:5@34:1:2:6')]);
    const r = await koreaTransitRoute(req(), 'k');
    expect(r.legs[1]!.coords).toEqual([{ lat: 37.5, lng: 127.0 }, { lat: 37.55, lng: 127.05 }]);
    expect(r.fare).toBe(1550);
  });

  it('waypoint chaining: no alternatives, no loadLane, fare summed', async () => {
    const fn = mockFetch(() => ok(LANE_BODY), [path(1000, 'm'), path(1000)]);
    const C = { lat: 37.7, lng: 127.2 };
    const r = await koreaTransitRoute(req([A, B, C]), 'k');
    expect(r.alternatives).toBeUndefined();
    expect(r.fare).toBe(2000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
