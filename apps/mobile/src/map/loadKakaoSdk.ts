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
      map?: KakaoMapInstance;
    }) => KakaoPolyline;
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
  setBounds(bounds: KakaoLatLngBounds): void;
  relayout(): void;
}

export interface KakaoMarker {
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

    const script = document.createElement('script');
    script.src = `${SDK_BASE}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.onload = () => {
      const kakao = getKakaoGlobal();
      if (!kakao) {
        reject(new Error('Kakao SDK 로드 후 전역(kakao) 부재'));
        return;
      }
      kakao.maps.load(() => resolve(kakao));
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Kakao SDK 스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}
