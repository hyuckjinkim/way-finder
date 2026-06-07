/**
 * <MapView> 통합 디스패처 — 네이티브 (B4, F5 stub을 덮어씀 · 소유권 핸드오프 M2).
 *
 * RegionProvider(`useRegionRenderer`)로 카메라에 따라 한국(Kakao)/글로벌(MapLibre)
 * 구현체를 분기한다. flyTo/fitBounds는 활성 구현체 ref로 위임한다.
 *
 * 이 네이티브 엔트리는 Kakao/MapLibre **네이티브** 구현을 import한다.
 * 웹 번들 격리 불변식(B4): 웹 플랫폼에서는 Metro가 `MapView.web.tsx`를 우선 해석하므로
 * 이 파일(및 그 네이티브 import)은 웹 번들에 절대 포함되지 않는다.
 */
import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';
import { useRegionRenderer } from './RegionProvider.js';
import MapViewKakao from './MapView.kakao.js';
import MapViewMapLibre from './MapView.maplibre.js';

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(
  props,
  ref,
) {
  const renderer = useRegionRenderer(props.camera);
  const implRef = useRef<MapViewRef>(null);

  // 활성 구현체 ref로 명령형 호출을 위임. 렌더러 전환 후엔 새 구현체로 향한다.
  useImperativeHandle(
    ref,
    () => ({
      flyTo(center, zoom) {
        implRef.current?.flyTo(center, zoom);
      },
      fitBounds(bounds, padding) {
        implRef.current?.fitBounds(bounds, padding);
      },
    }),
    [],
  );

  return renderer === 'korea' ? (
    <MapViewKakao ref={implRef} {...props} />
  ) : (
    <MapViewMapLibre ref={implRef} {...props} />
  );
});

export default MapView;
