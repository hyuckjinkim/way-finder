/**
 * MapLibre MapView — 웹 구현 (B3).
 *
 * `maplibre-gl`로 글로벌 지도를 렌더한다. 무료 OpenFreeMap liberty 스타일 사용(키 0개).
 * `MapViewProps`/`MapViewRef` 계약을 만족한다(flyTo, fitBounds).
 *
 * 웹 번들 격리(B4): 네이티브 모듈(@maplibre/maplibre-react-native)을 import하지 않는다.
 * 좌표 순서 주의: maplibre-gl은 [lng, lat] 순.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import maplibregl, { type Map as MlMap, type Marker as MlMarker } from 'maplibre-gl';
import type { MapViewProps, MapViewRef, MapMarker } from '@wayfinder/shared';

/** 무료 OpenFreeMap liberty 벡터 스타일(키 불요). */
export const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MapViewMapLibreWeb = forwardRef<MapViewRef, MapViewProps>(
  function MapViewMapLibreWeb(props, ref) {
    const { camera, markers, onPress, onCameraChange } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MlMap | null>(null);
    const markerObjsRef = useRef<MlMarker[]>([]);

    const onPressRef = useRef(onPress);
    const onCameraChangeRef = useRef(onCameraChange);
    onPressRef.current = onPress;
    onCameraChangeRef.current = onCameraChange;

    useImperativeHandle(
      ref,
      () => ({
        flyTo(center, zoom) {
          mapRef.current?.flyTo({
            center: [center.lng, center.lat],
            zoom,
          });
        },
        fitBounds(bounds, padding) {
          mapRef.current?.fitBounds(
            [
              [bounds.sw.lng, bounds.sw.lat],
              [bounds.ne.lng, bounds.ne.lat],
            ],
            { padding: padding ?? 40 },
          );
        },
      }),
      [],
    );

    // 지도 1회 초기화.
    useEffect(() => {
      if (!containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_LIBERTY_STYLE,
        center: [camera.center.lng, camera.center.lat],
        zoom: camera.zoom,
      });
      mapRef.current = map;

      map.on('click', (e) => {
        onPressRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      map.on('moveend', () => {
        const c = map.getCenter();
        onCameraChangeRef.current?.({
          center: { lat: c.lat, lng: c.lng },
          zoom: map.getZoom(),
        });
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
      // 초기화는 1회만. camera 변경은 별도 effect가 명령형 반영.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 외부 camera prop 변경 반영(controlled).
    useEffect(() => {
      mapRef.current?.jumpTo({
        center: [camera.center.lng, camera.center.lat],
        zoom: camera.zoom,
      });
    }, [camera.center.lat, camera.center.lng, camera.zoom]);

    // 마커 동기화: 기존 제거 후 재생성.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      for (const m of markerObjsRef.current) m.remove();
      markerObjsRef.current = (markers ?? []).map((mk: MapMarker) =>
        new maplibregl.Marker()
          .setLngLat([mk.coord.lng, mk.coord.lat])
          .addTo(map),
      );
    }, [markers]);

    return (
      <View
        // @ts-expect-error react-native-web의 View ref는 DOM 엘리먼트(HTMLDivElement)다.
        ref={containerRef}
        style={styles.map}
      />
    );
  },
);

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default MapViewMapLibreWeb;
