/**
 * <MapView> 통합 디스패처 — 웹 (B4, F5 stub을 덮어씀 · 소유권 핸드오프 M2).
 *
 * RegionProvider(`useRegionRenderer`)로 카메라에 따라 한국(Kakao 웹)/글로벌(MapLibre 웹)
 * 구현체를 분기한다. flyTo/fitBounds는 활성 구현체 ref로 위임한다.
 *
 * **웹 번들 격리 불변식(B4)**: 이 파일은 `.web` 구현체(`MapView.kakao.web`,
 * `MapView.maplibre.web`)만 import한다. 네이티브 맵 모듈
 * (`@react-native-kakao/map`, `@maplibre/maplibre-react-native`)이 transitively라도
 * 웹 번들에 유입되지 않도록, 네이티브 디스패처(`MapView.tsx`)나 네이티브 구현
 * (`MapView.kakao.tsx`, `MapView.maplibre.tsx`)을 절대 import하지 않는다.
 */
import {
  forwardRef,
  useImperativeHandle,
  useRef,
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
    <MapViewKakaoWeb ref={implRef} {...props} />
  ) : (
    <MapViewMapLibreWeb ref={implRef} {...props} />
  );
});

export default MapView;
