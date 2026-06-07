/**
 * Kakao MapView — 네이티브 구현 (B2).
 *
 * `@react-native-kakao/map` 2.2.7의 `KakaoMapView`를 래핑한다.
 * 완료 기준 = typecheck + config plugin 배선 (Mac/실기기 부재 → 디바이스 동작 미검증, §7).
 *
 * 라이브러리 호환성 메모(§7 "유지보수 정체 가능성"):
 * - v2.2.7 `KakaoMapRef`는 빈 인터페이스(`{}`)라 명령형 핸들이 없다 → flyTo/fitBounds는
 *   controlled `camera` prop을 로컬 상태로 구동해 구현한다.
 * - v2.2.7은 마커/폴리라인 하위 컴포넌트를 export하지 않는다 → 네이티브 마커 렌더는
 *   이 버전에서 불가(웹은 정상). 마커는 props로 받되 네이티브에선 무시(typecheck만).
 * - SDK 초기화는 `KakaoMap.initializeKakaoMapSDK(appKey)` 필요(앱 부트스트랩 책임).
 *
 * 웹 번들 격리(B4): 이 파일은 .web이 아니므로 웹 번들에 포함되지 않는다.
 */
import { forwardRef, useImperativeHandle, useState } from 'react';
import KakaoMapView from '@react-native-kakao/map';
import type { MapViewProps, MapViewRef, CameraState } from '@wayfinder/shared';

/**
 * Kakao `Camera` 형태(v2.2.7 `KakaoMapProps.camera`). 라이브러리가 이 타입을
 * named export하지 않으므로 우리가 쓰는 필드만 로컬 정의한다.
 */
interface KakaoCamera {
  lat: number;
  lng: number;
  zoomLevel?: number;
}

/** 표준 zoom → Kakao zoomLevel(1~14, 반대 방향) 근사 변환. */
function zoomToKakaoLevel(zoom: number): number {
  return Math.min(14, Math.max(1, Math.round(22 - zoom)));
}

function toKakaoCamera(camera: CameraState): KakaoCamera {
  return {
    lat: camera.center.lat,
    lng: camera.center.lng,
    zoomLevel: zoomToKakaoLevel(camera.zoom),
  };
}

const MapViewKakaoNative = forwardRef<MapViewRef, MapViewProps>(
  function MapViewKakaoNative(props, ref) {
    const { camera } = props;
    // controlled camera를 로컬 상태로 보관 — 명령형 flyTo/fitBounds가 이를 갱신.
    const [activeCamera, setActiveCamera] = useState<CameraState>(camera);

    useImperativeHandle(
      ref,
      () => ({
        flyTo(center, zoom) {
          setActiveCamera((prev) => ({
            center,
            zoom: typeof zoom === 'number' ? zoom : prev.zoom,
          }));
        },
        fitBounds(bounds) {
          // v2.2.7엔 setBounds 명령형 API가 없어 bbox 중심으로 이동(근사).
          setActiveCamera({
            center: {
              lat: (bounds.sw.lat + bounds.ne.lat) / 2,
              lng: (bounds.sw.lng + bounds.ne.lng) / 2,
            },
            zoom: 11,
          });
        },
      }),
      [],
    );

    // 외부 camera prop 또는 명령형 갱신 중 최신값을 사용.
    const effectiveCamera =
      camera.center.lat === activeCamera.center.lat &&
      camera.center.lng === activeCamera.center.lng &&
      camera.zoom === activeCamera.zoom
        ? camera
        : activeCamera;

    return (
      <KakaoMapView
        style={{ flex: 1 }}
        camera={toKakaoCamera(effectiveCamera)}
      />
    );
  },
);

export default MapViewKakaoNative;
