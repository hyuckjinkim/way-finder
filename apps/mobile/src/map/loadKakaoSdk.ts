/**
 * Kakao Maps JS SDK 동적 로더 (B2 — 웹 전용).
 *
 * Kakao Maps JS SDK는 npm 패키지가 아니라 `dapi.kakao.com`의 스크립트로만 배포된다.
 * 따라서 `<script>`를 런타임에 주입해 로드한다(appkey는 env 경유, 키 없으면 거부).
 *
 * - `autoload=false`로 받아 `kakao.maps.load(cb)`로 명시적 초기화한다.
 * - 한 번 로드되면 캐시된 Promise를 재사용한다(중복 주입 방지).
 * - 키가 없으면 reject — 호출부(MapView.kakao.web)가 placeholder를 렌더한다.
 *
 * 이 모듈은 **웹에서만** import된다(네이티브는 SDK가 다름). 브라우저 전역(document/window)
 * 에 의존하므로 RN 네이티브 번들에 들어가지 않도록 .web 구현에서만 참조할 것.
 */

/** Kakao SDK 전역 타입(최소 표면 — 우리가 쓰는 것만). */
export interface KakaoMapsNamespace {
  maps: {
    load(callback: () => void): void;
    Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMapInstance;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    LatLngBounds: new () => KakaoLatLngBounds;
    Marker: new (options: {
      position: KakaoLatLng;
      title?: string;
      map?: KakaoMapInstance;
    }) => KakaoMarker;
    Polyline: new (options: {
      path: KakaoLatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: 'solid' | 'shortdash' | 'shortdot' | 'dash' | 'dot';
      zIndex?: number;
      map?: KakaoMapInstance;
    }) => KakaoPolyline;
    CustomOverlay: new (options: {
      position: KakaoLatLng;
      /** HTML 문자열 또는 엘리먼트. */
      content: string | HTMLElement;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      map?: KakaoMapInstance;
    }) => KakaoOverlay;
    event: {
      addListener(
        target: KakaoMapInstance,
        type: string,
        handler: (event: KakaoMouseEvent) => void,
      ): void;
    };
  };
}

/** Kakao 지도 클릭 이벤트(필요한 필드만). */
export interface KakaoMouseEvent {
  latLng: KakaoLatLng;
}

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}

export interface KakaoMapOptions {
  center: KakaoLatLng;
  level: number;
}

export interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  getCenter(): KakaoLatLng;
  getLevel(): number;
  panTo(latlng: KakaoLatLng): void;
  /**
   * 여백(px)은 top/right/bottom/left 순서의 위치 인자 (Insets 한 개 객체가 아님).
   * 생략하면 0.
   */
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void;
  relayout(): void;
}

export interface KakaoMarker {
  setMap(map: KakaoMapInstance | null): void;
}

export interface KakaoOverlay {
  setMap(map: KakaoMapInstance | null): void;
}

export interface KakaoPolyline {
  setMap(map: KakaoMapInstance | null): void;
}

/**
 * 표준 web mercator zoom(클수록 확대)과 Kakao level(1=최대 확대, 클수록 축소)의
 * 근사 변환. 두 축은 반대 방향이라 변환이 필요하다: level ≈ 22 - zoom, 1~14 클램프.
 */
export function zoomToKakaoLevel(zoom: number): number {
  const level = Math.round(22 - zoom);
  return Math.min(14, Math.max(1, level));
}

/** Kakao level → 표준 zoom 역변환(카메라 상태 보고용). */
export function kakaoLevelToZoom(level: number): number {
  return 22 - level;
}

const SDK_BASE = 'https://dapi.kakao.com/v2/maps/sdk.js';

/** app/+html.tsx가 선로드하는 SDK 스크립트 태그 id (있으면 재사용). */
export const KAKAO_SDK_TAG_ID = 'kakao-sdk';
// 선로드 태그가 이 시간 안에 load되지 않으면 직접 주입으로 폴백.
const EARLY_TAG_TIMEOUT_MS = 10_000;

/** SDK URL — +html.tsx 선로드와 동적 주입이 항상 같은 URL을 쓰도록 단일화. */
export function kakaoSdkUrl(appKey: string): string {
  return `${SDK_BASE}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
}

let sdkPromise: Promise<KakaoMapsNamespace> | null = null;

/** window.kakao 접근(타입 안전). */
function getKakaoGlobal(): KakaoMapsNamespace | undefined {
  return (globalThis as { kakao?: KakaoMapsNamespace }).kakao;
}

/**
 * Kakao Maps SDK를 동적 주입으로 로드한다.
 *
 * @param appKey Kakao JavaScript 앱 키. 빈 문자열이면 reject.
 * @returns 초기화된 `kakao` 전역 네임스페이스
 */
export function loadKakaoSdk(appKey: string): Promise<KakaoMapsNamespace> {
  if (!appKey) {
    return Promise.reject(new Error('Kakao JS 키 미설정 — 데모 placeholder 렌더'));
  }

  const existing = getKakaoGlobal();
  if (existing?.maps?.Map) {
    return Promise.resolve(existing);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Kakao SDK는 브라우저 환경에서만 로드 가능'));
      return;
    }

    const onScriptLoaded = () => {
      const kakao = getKakaoGlobal();
      if (!kakao) {
        reject(new Error('Kakao SDK 로드 후 전역(kakao) 부재'));
        return;
      }
      kakao.maps.load(() => resolve(kakao));
    };

    const inject = () => {
      const script = document.createElement('script');
      script.src = kakaoSdkUrl(appKey);
      script.async = true;
      script.onload = onScriptLoaded;
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('Kakao SDK 스크립트 로드 실패'));
      };
      document.head.appendChild(script);
    };

    // +html.tsx 선로드 태그가 있으면 재사용: 이미 로드됐으면 즉시, 아니면 load 대기.
    // 에러·타임아웃이면 직접 주입(중복 호출은 settled 가드).
    const early = document.getElementById(KAKAO_SDK_TAG_ID);
    if (!early) {
      inject();
      return;
    }
    if (getKakaoGlobal()) {
      onScriptLoaded();
      return;
    }
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => settle(inject), EARLY_TAG_TIMEOUT_MS);
    early.addEventListener('load', () => settle(onScriptLoaded));
    early.addEventListener('error', () => settle(inject));
  });

  return sdkPromise;
}
