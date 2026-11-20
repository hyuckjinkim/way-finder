/**
 * <MapView> 통합 디스패처 — 웹 (B4, F5 stub을 덮어씀 · 소유권 핸드오프 M2).
 *
 * RegionProvider(`useRegionRenderer`)로 카메라에 따라 한국(Kakao 웹)/글로벌(MapLibre 웹)
 * 구현체를 분기한다. flyTo/fitBounds는 활성 구현체 ref로 위임한다.
 *
 * 카카오가 안 되면(키 없음·SDK 로드 실패/타임아웃) 이 마운트 동안 MapLibre 웹으로 전환한다 — 같은 props·ref.
 *
 * **웹 번들 격리 불변식(B4)**: 이 파일은 `.web` 구현체(`MapView.kakao.web`,
 * `MapView.maplibre.web`)만 import한다. 네이티브 맵 모듈
 * (`@react-native-kakao/map`, `@maplibre/maplibre-react-native`)이 transitively라도
 * 웹 번들에 유입되지 않도록, 네이티브 디스패처(`MapView.tsx`)나 네이티브 구현
 * (`MapView.kakao.tsx`, `MapView.maplibre.tsx`)을 절대 import하지 않는다.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';
import { useRegionRenderer } from './RegionProvider.js';
import MapViewKakaoWeb from './MapView.kakao.web.js';
import MapViewMapLibreWeb from './MapView.maplibre.web.js';

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(
  props,
  ref,
) {
  const renderer = useRegionRenderer(props.camera);
  const implRef = useRef<MapViewRef>(null);
  // ponytail: 한 번 실패하면 이 마운트 동안 MapLibre 고정 — 재시도는 다음 마운트(로더가 캐시를 비움).
  const [kakaoFailed, setKakaoFailed] = useState(false);
  // 마지막 명령형 카메라 요청 — 카카오 로딩 중 받은 요청이 전환 시 사라지지 않게 MapLibre에 재생.
  const lastCmdRef = useRef<((m: MapViewRef) => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(center, zoom) {
        lastCmdRef.current = (m) => m.flyTo(center, zoom);
        implRef.current?.flyTo(center, zoom);
      },
      fitBounds(bounds, padding) {
        lastCmdRef.current = (m) => m.fitBounds(bounds, padding);
        implRef.current?.fitBounds(bounds, padding);
      },
    }),
    [],
  );

  useEffect(() => {
    if (kakaoFailed && implRef.current) lastCmdRef.current?.(implRef.current);
  }, [kakaoFailed]);

  return renderer === 'korea' && !kakaoFailed ? (
    <MapViewKakaoWeb ref={implRef} {...props} onUnavailable={() => setKakaoFailed(true)} />
  ) : (
    <MapViewMapLibreWeb ref={implRef} {...props} />
  );
});

export default MapView;
