import { describe, it, expect } from 'vitest';
import { deviceFromUA, handoffPlan, kakaoAppUrl, naverAppUrl, naverIntentUrl, NAVER_WEB, type HandoffArgs } from './appHandoff.js';

const args = (over: Partial<HandoffArgs> = {}): HandoffArgs => ({
  origin: { label: '강남 역', coord: { lat: 37.4979, lng: 127.0276 } },
  destination: { label: 'A&B 카페', coord: { lat: 37.5665, lng: 126.978 } },
  waypoints: [],
  mode: 'transit',
  appname: 'wayfinder.example',
  ...over,
});

describe('kakaoAppUrl', () => {
  it('sp/ep는 lat,lng, by는 앱 모드명', () => {
    expect(kakaoAppUrl(args())).toBe('kakaomap://route?sp=37.4979,127.0276&ep=37.5665,126.978&by=publictransit');
    expect(kakaoAppUrl(args({ mode: 'walk' }))).toContain('by=foot');
    expect(kakaoAppUrl(args({ mode: 'bike' }))).toContain('by=bicycle');
  });
  it('경유지는 비대중교통만 vp, vp2…', () => {
    const w = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }];
    expect(kakaoAppUrl(args({ mode: 'car', waypoints: w }))).toContain('&vp=1,2&vp2=3,4&ep=');
    expect(kakaoAppUrl(args({ waypoints: w }))).not.toContain('vp');
  });
});

describe('naverAppUrl', () => {
  it('경로·이름 인코딩(공백은 %20, & 이스케이프)·appname', () => {
    const url = naverAppUrl(args());
    expect(url.startsWith('nmap://route/public?slat=37.4979&slng=127.0276&sname=%EA%B0%95%EB%82%A8%20%EC%97%AD')).toBe(true);
    expect(url).toContain('dname=A%26B%20%EC%B9%B4%ED%8E%98');
    expect(url.endsWith('&appname=wayfinder.example')).toBe(true);
    expect(decodeURIComponent(url)).toContain('A&B 카페');
  });
  it('경유지 v1lat/v1lng, 모드 경로', () => {
    const url = naverAppUrl(args({ mode: 'walk', waypoints: [{ lat: 1, lng: 2 }] }));
    expect(url).toMatch(/^nmap:\/\/route\/walk\?/);
    expect(url).toContain('&v1lat=1&v1lng=2&dlat=');
  });
  it('안드로이드 intent 형식', () => {
    const intent = naverIntentUrl('nmap://route/car?dlat=1');
    expect(intent).toBe(
      'intent://route/car?dlat=1#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end',
    );
  });
});

describe('handoffPlan', () => {
  it('데스크톱은 웹 링크 바로', () => {
    expect(handoffPlan('kakao', 'desktop', args()).primary).toMatch(/^https:\/\/map\.kakao\.com\/link\/by\/traffic\//);
    expect(handoffPlan('naver', 'desktop', args())).toEqual({ primary: NAVER_WEB });
  });
  it('모바일 카카오: 스킴 + 웹 폴백', () => {
    const p = handoffPlan('kakao', 'ios', args());
    expect(p.primary).toMatch(/^kakaomap:\/\//);
    expect(p.fallback).toMatch(/^https:\/\/map\.kakao\.com\//);
  });
  it('네이버: 안드로이드 intent(폴백 없음), iOS 스킴 + 웹 폴백', () => {
    expect(handoffPlan('naver', 'android', args())).toEqual({ primary: expect.stringMatching(/^intent:\/\/route\/public\?/) });
    expect(handoffPlan('naver', 'ios', args())).toEqual({ primary: expect.stringMatching(/^nmap:/), fallback: NAVER_WEB });
  });
  it('deviceFromUA', () => {
    expect(deviceFromUA('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(deviceFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(deviceFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });
});
