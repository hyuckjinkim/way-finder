/**
 * MapLibre MapView — 웹 구현 (B3).
 *
 * `maplibre-gl`로 글로벌 지도를 렌더한다. 무료 OpenFreeMap liberty 스타일 사용(키 0개).
 * `MapViewProps`/`MapViewRef` 계약을 만족한다(flyTo, fitBounds). `layers`(카카오 전용 타일)는 무시한다.
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
import { View, Text, StyleSheet } from 'react-native';
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
import { attachLongPress, dedupeLongPress } from './longPress.js';

/** 무료 OpenFreeMap liberty 벡터 스타일(키 불요). */
export const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MapViewMapLibreWeb = forwardRef<MapViewRef, MapViewProps>(
  function MapViewMapLibreWeb(props, ref) {
    const { camera, markers, polylines, userLocation, fitTo } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MlMap | null>(null);
    const markerObjsRef = useRef<MlMarker[]>([]);
    const polylineIdsRef = useRef<string[]>([]);
    // 스타일 로드 완료 후에야 source/layer를 추가할 수 있다.
    const [styleReady, setStyleReady] = useState(false);
    // 첫 타일이 오기 전(스타일·타일 전부 실패) 에러는 지도가 비어 보이므로 안내. 이후 개별 타일 실패는 로그만.
    const [loadFailed, setLoadFailed] = useState(false);

    const propsRef = useRef(props);
    propsRef.current = props;

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
      // 'load'는 타일이 전부 실패해도 올 수 있어, 타일 1장이라도 받은 뒤에야 배너를 걷는다.
      let gotTile = false;
      map.on('sourcedata', (e) => {
        if (gotTile || !e.tile) return;
        gotTile = true;
        setLoadFailed(false);
      });
      map.on('error', (e) => {
        console.warn('[map] maplibre error:', e.error?.message ?? e);
        if (!gotTile) setLoadFailed(true);
      });
      map.on('click', (e) => {
        propsRef.current.onPress?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      // 길게 누르기(F6): 우클릭(contextmenu) + 터치 500ms. 지도 이동이 시작되면 취소.
      const longPress = dedupeLongPress((ll: { lat: number; lng: number }) =>
        propsRef.current.onLongPress?.({ lat: ll.lat, lng: ll.lng }),
      );
      map.on('contextmenu', (e) => {
        e.preventDefault();
        longPress(e.lngLat);
      });
      const touchPress = attachLongPress(containerRef.current, (x, y) => longPress(map.unproject([x, y])));
      map.on('movestart', touchPress.cancel);
      const emitCamera = () => {
        const c = map.getCenter();
        propsRef.current.onCameraChange?.({
          center: { lat: c.lat, lng: c.lng },
          zoom: map.getZoom(),
        });
        const b = map.getBounds();
        propsRef.current.onBoundsChange?.({
          sw: { lat: b.getSouth(), lng: b.getWest() },
          ne: { lat: b.getNorth(), lng: b.getEast() },
        });
      };
      map.on('moveend', emitCamera);
      map.on('load', emitCamera);

      return () => {
        touchPress.detach();
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
        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation(); // 지도 click(onPress)으로 새지 않게
          propsRef.current.onMarkerPress?.(mk.id);
        });
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
      mapRef.current?.resize(); // 컨테이너 크기가 막 바뀌었어도(폰 시트 여백) 실제 크기로
      mapRef.current?.fitBounds(
        [[sw.lng, sw.lat], [ne.lng, ne.lat]],
        { padding: normalizeInsets(fitTo.padding), animate: false },
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToKey]);

    return (
      <View style={styles.map}>
        <View
          // @ts-expect-error react-native-web의 View ref는 DOM 엘리먼트(HTMLDivElement)다.
          ref={containerRef}
          style={styles.map}
        />
        {loadFailed && (
          <View style={styles.errorBanner} pointerEvents="none">
            <Text style={styles.errorText}>지도를 불러오지 못했습니다. 네트워크를 확인해 주세요.</Text>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(30,30,40,0.85)',
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default MapViewMapLibreWeb;
