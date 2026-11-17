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
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import maplibregl, { type Map as MlMap, type Marker as MlMarker } from 'maplibre-gl';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';
import {
  fitKey,
  markerHtml,
  markerSpec,
  normalizeInsets,
  polylineStyle,
  withUserMarker,
} from './mapHelpers.js';

/** 무료 OpenFreeMap liberty 벡터 스타일(키 불요). */
export const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MapViewMapLibreWeb = forwardRef<MapViewRef, MapViewProps>(
  function MapViewMapLibreWeb(props, ref) {
    const { camera, markers, polylines, userLocation, fitTo, onPress, onCameraChange } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MlMap | null>(null);
    const markerObjsRef = useRef<MlMarker[]>([]);
    const polylineIdsRef = useRef<string[]>([]);
    // 스타일 로드 완료 후에야 source/layer를 추가할 수 있다.
    const [styleReady, setStyleReady] = useState(false);

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
            { padding: normalizeInsets(padding) },
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

      map.on('load', () => setStyleReady(true));
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

    // 마커 동기화: 값(JSON)이 바뀔 때만 재생성. place=기본 핀, 그 외 kind=커스텀 DOM 엘리먼트.
    const markersKey = JSON.stringify(withUserMarker(markers, userLocation));
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      for (const m of markerObjsRef.current) m.remove();
      markerObjsRef.current = withUserMarker(markers, userLocation).map((mk) => {
        const spec = markerSpec(mk.kind, mk.color);
        let marker: MlMarker;
        if (spec) {
          const element = document.createElement('div');
          element.innerHTML = markerHtml(spec);
          marker = new maplibregl.Marker({ element: element.firstElementChild as HTMLElement });
        } else {
          marker = new maplibregl.Marker();
        }
        return marker.setLngLat([mk.coord.lng, mk.coord.lat]).addTo(map);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markersKey]);

    // 폴리라인 동기화: GeoJSON source 하나당 흰 외곽선 + 본선 line layer.
    const polylinesKey = JSON.stringify(polylines ?? []);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleReady) return;
      for (const id of polylineIdsRef.current) {
        if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
        if (map.getLayer(`${id}-outline`)) map.removeLayer(`${id}-outline`);
        if (map.getSource(id)) map.removeSource(id);
      }
      polylineIdsRef.current = (polylines ?? []).map((pl, i) => {
        const id = `wf-pl-${i}-${pl.id}`;
        const st = polylineStyle(pl);
        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: pl.coords.map((c) => [c.lng, c.lat]) },
          },
        });
        const layout = { 'line-join': 'round', 'line-cap': st.dashed ? 'butt' : 'round' } as const;
        map.addLayer({
          id: `${id}-outline`, type: 'line', source: id, layout,
          paint: { 'line-color': '#ffffff', 'line-width': st.outlineWidth, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: `${id}-line`, type: 'line', source: id, layout,
          paint: {
            'line-color': st.color,
            'line-width': st.width,
            'line-opacity': 0.9,
            ...(st.dashed ? { 'line-dasharray': [2, 2] } : {}),
          },
        });
        return id;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polylinesKey, styleReady]);

    // fitTo: 값이 바뀔 때 적용. camera effect보다 뒤에 선언돼 마운트 시 camera보다 우선.
    const fitToKey = fitKey(fitTo);
    useEffect(() => {
      if (!fitTo) return;
      const { sw, ne } = fitTo.bounds;
      mapRef.current?.fitBounds(
        [[sw.lng, sw.lat], [ne.lng, ne.lat]],
        { padding: normalizeInsets(fitTo.padding), animate: false },
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToKey]);

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
