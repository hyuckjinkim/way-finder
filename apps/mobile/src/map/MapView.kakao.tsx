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
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import KakaoMapView from '@react-native-kakao/map';
import type { MapViewProps, MapViewRef, CameraState, BBox } from '@wayfinder/shared';
import { approxZoomForBounds, fitKey } from './mapHelpers.js';

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

/** bbox 중심 + 근사 zoom (v2.2.7엔 setBounds가 없다 — padding은 무시). */
function cameraForBounds(bounds: BBox): CameraState {
  return {
    center: {
      lat: (bounds.sw.lat + bounds.ne.lat) / 2,
      lng: (bounds.sw.lng + bounds.ne.lng) / 2,
    },
    zoom: approxZoomForBounds(bounds),
  };
}

const MapViewKakaoNative = forwardRef<MapViewRef, MapViewProps>(
  function MapViewKakaoNative(props, ref) {
    const { camera, fitTo } = props;
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
          setActiveCamera(cameraForBounds(bounds));
        },
      }),
      [],
    );

    // 외부 camera prop이 값으로 바뀌면 로컬 상태를 덮어쓴다(이전엔 오래된 명령형 상태가 이겨
    // camera prop 변경이 지도에 반영되지 않았다). fitTo는 뒤에 선언돼 같은 커밋에선 camera보다 우선.
    const { lat, lng } = camera.center;
    const { zoom } = camera;
    useEffect(() => {
      setActiveCamera({ center: { lat, lng }, zoom });
    }, [lat, lng, zoom]);

    const fitToKey = fitKey(fitTo);
    useEffect(() => {
      if (fitTo) setActiveCamera(cameraForBounds(fitTo.bounds));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToKey]);

    return (
      <KakaoMapView
        style={{ flex: 1 }}
        camera={toKakaoCamera(activeCamera)}
      />
    );
  },
);

export default MapViewKakaoNative;
