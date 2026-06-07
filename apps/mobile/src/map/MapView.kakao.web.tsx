/**
 * Kakao MapView — 웹 구현 (B2).
 *
 * Kakao Maps JS SDK를 동적 주입(loadKakaoSdk)으로 로드해 지도를 렌더한다.
 * `MapViewProps`/`MapViewRef` 계약을 만족한다(flyTo=panTo, fitBounds=setBounds).
 * 키 미설정/로드 실패 시 안내 placeholder를 렌더한다(데모 모드).
 *
 * 웹 번들 격리(B4): 네이티브 맵 모듈(@react-native-kakao/map)을 import하지 않는다.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import type { MapViewProps, MapViewRef, MapMarker } from '@wayfinder/shared';
import {
  loadKakaoSdk,
  zoomToKakaoLevel,
  kakaoLevelToZoom,
  type KakaoMapsNamespace,
  type KakaoMapInstance,
  type KakaoMarker,
} from './loadKakaoSdk.js';

function readKakaoJsKey(): string {
  const extra = Constants.expoConfig?.extra as { kakaoJsKey?: string } | undefined;
  return extra?.kakaoJsKey ?? '';
}

const MapViewKakaoWeb = forwardRef<MapViewRef, MapViewProps>(
  function MapViewKakaoWeb(props, ref) {
    const { camera, markers, onPress, onCameraChange } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const kakaoRef = useRef<KakaoMapsNamespace | null>(null);
    const mapRef = useRef<KakaoMapInstance | null>(null);
    const markerObjsRef = useRef<KakaoMarker[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'no-key' | 'error'>(
      'loading',
    );

    // 콜백을 ref에 보관해 이벤트 리스너 재바인딩 없이 최신 핸들러 호출.
    const onPressRef = useRef(onPress);
    const onCameraChangeRef = useRef(onCameraChange);
    onPressRef.current = onPress;
    onCameraChangeRef.current = onCameraChange;

    useImperativeHandle(
      ref,
      () => ({
        flyTo(center, zoom) {
          const kakao = kakaoRef.current;
          const map = mapRef.current;
          if (!kakao || !map) return;
          map.panTo(new kakao.maps.LatLng(center.lat, center.lng));
          if (typeof zoom === 'number') {
            map.setLevel(zoomToKakaoLevel(zoom));
          }
        },
        fitBounds(bounds) {
          const kakao = kakaoRef.current;
          const map = mapRef.current;
          if (!kakao || !map) return;
          const b = new kakao.maps.LatLngBounds();
          b.extend(new kakao.maps.LatLng(bounds.sw.lat, bounds.sw.lng));
          b.extend(new kakao.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
          map.setBounds(b);
        },
      }),
      [],
    );

    // SDK 로드 + 지도 1회 초기화.
    useEffect(() => {
      let cancelled = false;
      const key = readKakaoJsKey();
      if (!key) {
        setStatus('no-key');
        return;
      }

      loadKakaoSdk(key)
        .then((kakao) => {
          if (cancelled || !containerRef.current) return;
          kakaoRef.current = kakao;
          const map = new kakao.maps.Map(containerRef.current, {
            center: new kakao.maps.LatLng(camera.center.lat, camera.center.lng),
            level: zoomToKakaoLevel(camera.zoom),
          });
          mapRef.current = map;

          kakao.maps.event.addListener(map, 'click', (event) => {
            const ll = event.latLng;
            onPressRef.current?.({ lat: ll.getLat(), lng: ll.getLng() });
          });
          const emitCamera = () => {
            const c = map.getCenter();
            onCameraChangeRef.current?.({
              center: { lat: c.getLat(), lng: c.getLng() },
              zoom: kakaoLevelToZoom(map.getLevel()),
            });
          };
          kakao.maps.event.addListener(map, 'center_changed', emitCamera);
          kakao.maps.event.addListener(map, 'zoom_changed', emitCamera);

          setStatus('ready');
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });

      return () => {
        cancelled = true;
      };
      // 초기화는 1회만. camera 변경은 아래 별도 effect가 명령형으로 반영.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 외부 camera prop 변경을 지도에 반영(controlled).
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (!kakao || !map) return;
      map.setCenter(new kakao.maps.LatLng(camera.center.lat, camera.center.lng));
      map.setLevel(zoomToKakaoLevel(camera.zoom));
    }, [camera.center.lat, camera.center.lng, camera.zoom]);

    // 마커 동기화: 기존 제거 후 재생성(P1 마커 수가 적어 단순 재생성으로 충분).
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (!kakao || !map) return;
      for (const m of markerObjsRef.current) m.setMap(null);
      markerObjsRef.current = (markers ?? []).map((mk: MapMarker) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(mk.coord.lat, mk.coord.lng),
          title: mk.title,
          map,
        });
        return marker;
      });
    }, [markers, status]);

    if (status === 'no-key' || status === 'error') {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.label}>
            Kakao 지도 (웹) —{' '}
            {status === 'no-key' ? '데모 모드' : '로드 실패'}
          </Text>
          <Text style={styles.coord}>
            {status === 'no-key'
              ? 'EXPO_PUBLIC_KAKAO_JS_KEY 미설정 — placeholder'
              : 'SDK 로드 실패'}
          </Text>
          <Text style={styles.coord}>
            {camera.center.lat.toFixed(4)}, {camera.center.lng.toFixed(4)} · z
            {camera.zoom}
          </Text>
        </View>
      );
    }

    // react-native-web에서 View는 div로 렌더된다. ref로 실제 DOM 엘리먼트를 얻어
    // Kakao SDK 컨테이너로 사용한다.
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
  placeholder: {
    flex: 1,
    backgroundColor: '#eef2f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    color: '#445',
  },
  coord: {
    fontSize: 12,
    color: '#889',
    marginTop: 4,
  },
});

export default MapViewKakaoWeb;
