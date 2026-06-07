/**
 * <MapView> 웹 stub (F5 — Foundation 소유).
 *
 * 네이티브 stub과 동일한 MapViewProps/MapViewRef 계약을 만족하는 no-op stub이다.
 * react-native-web을 통해 동일한 RN 컴포넌트를 사용하므로 웹 export에서 그대로 마운트된다.
 *
 * 웹 번들 격리 불변식(B4): 이 `.web.tsx` 경로는 네이티브 맵 모듈
 * (@maplibre/maplibre-react-native, @react-native-kakao/map)을 절대 import하지 않는다.
 * (현 stub은 어떤 맵 SDK도 import하지 않음.)
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MapViewProps, MapViewRef } from '@wayfinder/shared';

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(
  props,
  ref,
) {
  useImperativeHandle(
    ref,
    () => ({
      flyTo() {
        // no-op stub
      },
      fitBounds() {
        // no-op stub
      },
    }),
    [],
  );

  const { center, zoom } = props.camera;

  return (
    <View style={styles.placeholder}>
      <Text style={styles.label}>MapView (web stub)</Text>
      <Text style={styles.coord}>
        {center.lat.toFixed(4)}, {center.lng.toFixed(4)} · z{zoom}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
  },
  coord: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});

export default MapView;
