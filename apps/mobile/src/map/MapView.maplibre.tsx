/**
 * MapLibre MapView — 네이티브 구현 (B3).
 *
 * `@maplibre/maplibre-react-native`로 글로벌 지도를 렌더한다.
 * 무료 OpenFreeMap liberty 스타일(키 0개). `MapViewProps`/`MapViewRef` 계약 만족.
 * 완료 기준 = typecheck (Mac/실기기 부재 → 디바이스 동작 미검증, §7).
 *
 * 웹 번들 격리(B4): 이 파일은 .web이 아니므로 웹 번들에 포함되지 않는다.
 * 좌표 순서 주의: maplibre RN의 LngLat은 [lng, lat] 순.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Map as MlMap,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';
import {
  fitKey,
  markerSpec,
  normalizeInsets,
  polylineStyle,
  withUserMarker,
} from './mapHelpers.js';

/** 무료 OpenFreeMap liberty 벡터 스타일(키 불요). */
export const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MapViewMapLibreNative = forwardRef<MapViewRef, MapViewProps>(
  function MapViewMapLibreNative(props, ref) {
    const { camera, markers, polylines, userLocation, fitTo, onPress, onCameraChange } = props;
    const cameraRef = useRef<CameraRef>(null);

    useImperativeHandle(
      ref,
      () => ({
        flyTo(center, zoom) {
          cameraRef.current?.flyTo({
            center: [center.lng, center.lat],
            zoom,
          });
        },
        fitBounds(bounds, padding) {
          // LngLatBounds: [west, south, east, north]
          cameraRef.current?.fitBounds(
            [bounds.sw.lng, bounds.sw.lat, bounds.ne.lng, bounds.ne.lat],
            { padding: normalizeInsets(padding) },
          );
        },
      }),
      [],
    );

    // fitTo: 값이 바뀔 때 적용 (Camera의 center/zoom prop보다 뒤에 실행되도록 effect로).
    const fitToKey = fitKey(fitTo);
    useEffect(() => {
      if (!fitTo) return;
      const { sw, ne } = fitTo.bounds;
      cameraRef.current?.fitBounds([sw.lng, sw.lat, ne.lng, ne.lat], {
        padding: normalizeInsets(fitTo.padding),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToKey]);

    return (
      <MlMap
        style={{ flex: 1 }}
        mapStyle={OPENFREEMAP_LIBERTY_STYLE}
        onPress={(event) => {
          const press = event.nativeEvent;
          if ('lngLat' in press) {
            const [lng, lat] = press.lngLat;
            onPress?.({ lat, lng });
          }
        }}
        onRegionDidChange={(event) => {
          const { center, zoom } = event.nativeEvent;
          const [lng, lat] = center;
          onCameraChange?.({ center: { lat, lng }, zoom });
        }}
      >
        <Camera
          ref={cameraRef}
          center={[camera.center.lng, camera.center.lat]}
          zoom={camera.zoom}
        />
        {(polylines ?? []).map((pl, i) => {
          const st = polylineStyle(pl);
          const layout = { 'line-join': 'round', 'line-cap': st.dashed ? 'butt' : 'round' } as const;
          return (
            <GeoJSONSource
              key={`${i}-${pl.id}`}
              id={`wf-pl-${i}-${pl.id}`}
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: pl.coords.map((c) => [c.lng, c.lat]),
                },
              }}
            >
              <Layer
                id={`wf-pl-${i}-${pl.id}-outline`}
                type="line"
                layout={layout}
                paint={{ 'line-color': '#ffffff', 'line-width': st.outlineWidth, 'line-opacity': 0.9 }}
              />
              <Layer
                id={`wf-pl-${i}-${pl.id}-line`}
                type="line"
                layout={layout}
                paint={{
                  'line-color': st.color,
                  'line-width': st.width,
                  'line-opacity': 0.9,
                  ...(st.dashed ? { 'line-dasharray': [2, 2] } : {}),
                }}
              />
            </GeoJSONSource>
          );
        })}
        {withUserMarker(markers, userLocation).map((mk) => {
          const spec = markerSpec(mk.kind, mk.color);
          const dot = spec
            ? {
                width: spec.size + spec.borderWidth * 2,
                height: spec.size + spec.borderWidth * 2,
                borderRadius: spec.size,
                backgroundColor: spec.background,
                borderColor: spec.borderColor,
                borderWidth: spec.borderWidth,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              }
            : styles.marker;
          return (
            <Marker key={mk.id} id={mk.id} lngLat={[mk.coord.lng, mk.coord.lat]}>
              <View style={dot}>
                {spec?.label ? <Text style={styles.label}>{spec.label}</Text> : null}
              </View>
            </Marker>
          );
        })}
      </MlMap>
    );
  },
);

const styles = StyleSheet.create({
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#d33',
    borderWidth: 2,
    borderColor: '#fff',
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default MapViewMapLibreNative;
