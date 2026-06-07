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
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Map as MlMap,
  Camera,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';

/** 무료 OpenFreeMap liberty 벡터 스타일(키 불요). */
export const OPENFREEMAP_LIBERTY_STYLE =
  'https://tiles.openfreemap.org/styles/liberty';

const MapViewMapLibreNative = forwardRef<MapViewRef, MapViewProps>(
  function MapViewMapLibreNative(props, ref) {
    const { camera, markers, onPress, onCameraChange } = props;
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
          const pad = padding ?? 40;
          // LngLatBounds: [west, south, east, north]
          cameraRef.current?.fitBounds(
            [bounds.sw.lng, bounds.sw.lat, bounds.ne.lng, bounds.ne.lat],
            { padding: { top: pad, right: pad, bottom: pad, left: pad } },
          );
        },
      }),
      [],
    );

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
        {(markers ?? []).map((mk) => (
          <Marker key={mk.id} id={mk.id} lngLat={[mk.coord.lng, mk.coord.lat]}>
            <View style={styles.marker} />
          </Marker>
        ))}
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
});

export default MapViewMapLibreNative;
