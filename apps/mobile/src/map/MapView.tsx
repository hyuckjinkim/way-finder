/**
 * <MapView> 네이티브 stub (F5 — Foundation 소유).
 *
 * @wayfinder/shared의 MapViewProps/MapViewRef 계약을 만족하는 no-op stub이다.
 * 회색 placeholder + 카메라 상태 텍스트만 렌더한다.
 *
 * 소유권 핸드오프(M2): 스트림 C(C1)는 이 고정 경로(`src/map/MapView`)만 import하고
 * 절대 이 파일을 생성/수정하지 않는다. 스트림 B(B4)가 이 파일을 실제 디스패처
 * 구현으로 **덮어쓴다**(동일 경로).
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
      <Text style={styles.label}>MapView (stub)</Text>
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
