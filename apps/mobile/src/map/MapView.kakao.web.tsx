/**
 * Kakao MapView — 웹 구현 (B2).
 *
 * Kakao Maps JS SDK를 동적 주입(loadKakaoSdk)으로 로드해 지도를 렌더한다.
 * `MapViewProps`/`MapViewRef` 계약을 만족한다(flyTo=panTo, fitBounds=setBounds).
 * 키 미설정/로드 실패(타임아웃 포함) 시 `onUnavailable`을 호출한다 — 웹 디스패처가 MapLibre로 전환.
 * 핸들러가 없으면 안내 placeholder를 렌더한다.
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
import type { MapViewProps, MapViewRef, MapLayers, BBox, Insets, LatLng } from '@wayfinder/shared';
import {
  loadKakaoSdk,
  zoomToKakaoLevel,
  kakaoLevelToZoom,
  type KakaoMapsNamespace,
  type KakaoMapInstance,
} from './loadKakaoSdk.js';
import {
  fitKey,
  markerHtml,
  markerSpec,
  normalizeInsets,
  polylineStyle,
  withUserMarker,
} from './mapHelpers.js';
import { attachLongPress, dedupeLongPress, type LongPressHandle } from './longPress.js';

/** 지도 준비 전에 들어온 명령형 요청 — 가장 최근 것 하나만 보관해 ready 후 적용. */
type PendingRequest =
  | { type: 'fly'; center: LatLng; zoom?: number }
  | { type: 'fit'; bounds: BBox; padding?: number | Insets };

/** 지도에서 떼어낼 수 있는 오버레이(마커/폴리라인/커스텀 오버레이 공통). */
interface Removable {
  setMap(map: KakaoMapInstance | null): void;
}

function fitMap(
  kakao: KakaoMapsNamespace,
  map: KakaoMapInstance,
  bounds: BBox,
  padding?: number | Insets,
) {
  const b = new kakao.maps.LatLngBounds();
  b.extend(new kakao.maps.LatLng(bounds.sw.lat, bounds.sw.lng));
  b.extend(new kakao.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
  const p = normalizeInsets(padding);
  map.relayout(); // 컨테이너 크기가 막 바뀌었어도(폰 시트 여백) 실제 크기로 맞춘다
  map.setBounds(b, p.top, p.right, p.bottom, p.left);
}

function flyMap(kakao: KakaoMapsNamespace, map: KakaoMapInstance, center: LatLng, zoom?: number) {
  map.panTo(new kakao.maps.LatLng(center.lat, center.lng));
  if (typeof zoom === 'number') map.setLevel(zoomToKakaoLevel(zoom));
}

/** 레이어 토글 반영(F7): 위성=HYBRID 베이스, 교통·자전거=오버레이(위성 위 자전거는 BICYCLE_HYBRID). */
function applyLayers(kakao: KakaoMapsNamespace, map: KakaoMapInstance, layers: MapLayers = {}) {
  const T = kakao.maps.MapTypeId;
  map.setMapTypeId(layers.satellite ? T.HYBRID : T.ROADMAP);
  for (const id of [T.TRAFFIC, T.BICYCLE, T.BICYCLE_HYBRID]) map.removeOverlayMapTypeId(id);
  if (layers.traffic) map.addOverlayMapTypeId(T.TRAFFIC);
  if (layers.bicycle) map.addOverlayMapTypeId(layers.satellite ? T.BICYCLE_HYBRID : T.BICYCLE);
}

function readKakaoJsKey(): string {
  const extra = Constants.expoConfig?.extra as { kakaoJsKey?: string } | undefined;
  return extra?.kakaoJsKey ?? '';
}

/** 웹 디스패처 전용 확장 — 공용 MapViewProps는 건드리지 않는다. */
export type MapViewKakaoWebProps = MapViewProps & { onUnavailable?: () => void };

const MapViewKakaoWeb = forwardRef<MapViewRef, MapViewKakaoWebProps>(
  function MapViewKakaoWeb(props, ref) {
    const { camera, markers, polylines, userLocation, fitTo, layers, onUnavailable } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const kakaoRef = useRef<KakaoMapsNamespace | null>(null);
    const mapRef = useRef<KakaoMapInstance | null>(null);
    const markerObjsRef = useRef<Removable[]>([]);
    const polylineObjsRef = useRef<Removable[]>([]);
    const pendingRef = useRef<PendingRequest | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'no-key' | 'error'>(
      'loading',
    );

    // 콜백을 ref에 보관해 이벤트 리스너 재바인딩 없이 최신 핸들러 호출.
    const propsRef = useRef(props);
    propsRef.current = props;
    const longPressRef = useRef<LongPressHandle | null>(null);
    const resizeObsRef = useRef<ResizeObserver | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        flyTo(center, zoom) {
          const kakao = kakaoRef.current;
          const map = mapRef.current;
          if (!kakao || !map) {
            pendingRef.current = { type: 'fly', center, zoom };
            return;
          }
          flyMap(kakao, map, center, zoom);
        },
        fitBounds(bounds, padding) {
          const kakao = kakaoRef.current;
          const map = mapRef.current;
          if (!kakao || !map) {
            pendingRef.current = { type: 'fit', bounds, padding };
            return;
          }
          fitMap(kakao, map, bounds, padding);
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
            propsRef.current.onPress?.({ lat: ll.getLat(), lng: ll.getLng() });
          });
          // 길게 누르기(F6): 데스크톱 우클릭 + 터치 500ms. 지도 드래그·줌이 시작되면 취소.
          const container = containerRef.current;
          const longPress = dedupeLongPress((ll: { getLat(): number; getLng(): number }) =>
            propsRef.current.onLongPress?.({ lat: ll.getLat(), lng: ll.getLng() }),
          );
          kakao.maps.event.addListener(map, 'rightclick', (event) => longPress(event.latLng));
          container.addEventListener('contextmenu', (e) => e.preventDefault());
          longPressRef.current = attachLongPress(container, (x, y) =>
            longPress(map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x, y))),
          );
          kakao.maps.event.addListener(map, 'dragstart', () => longPressRef.current?.cancel());
          kakao.maps.event.addListener(map, 'zoom_start', () => longPressRef.current?.cancel());
          // 폰 시트가 열리며 컨테이너 높이가 바뀌면 다시 잰다(카카오는 스스로 안 함).
          if (typeof ResizeObserver !== 'undefined') {
            resizeObsRef.current = new ResizeObserver(() => map.relayout());
            resizeObsRef.current.observe(container);
          }

          const emitCamera = () => {
            const c = map.getCenter();
            propsRef.current.onCameraChange?.({
              center: { lat: c.getLat(), lng: c.getLng() },
              zoom: kakaoLevelToZoom(map.getLevel()),
            });
            const b = map.getBounds();
            const sw = b.getSouthWest();
            const ne = b.getNorthEast();
            propsRef.current.onBoundsChange?.({
              sw: { lat: sw.getLat(), lng: sw.getLng() },
              ne: { lat: ne.getLat(), lng: ne.getLng() },
            });
          };
          // 'idle' = 이동/줌이 끝난 뒤 한 번. center_changed/zoom_changed는 프로그램 이동 중
          // 중간 상태(새 center + 옛 level)를 보고해, 부모가 camera를 되돌려 쓰는 경합을 만든다.
          kakao.maps.event.addListener(map, 'idle', emitCamera);
          emitCamera(); // 처음 영역 — 지도를 한 번도 안 옮기고 칩을 눌러도 보이는 영역으로 검색

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

    // 외부 camera prop 변경을 지도에 반영(controlled). status를 deps에 둬 SDK가 늦게 준비돼도
    // 그 사이 바뀐 camera가 ready 직후 적용된다. 이미 그 위치면 건너뛴다(진행 중 이동 취소 방지).
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (status !== 'ready' || !kakao || !map) return;
      const level = zoomToKakaoLevel(camera.zoom);
      const c = map.getCenter();
      const sameCenter =
        Math.abs(c.getLat() - camera.center.lat) < 1e-7 &&
        Math.abs(c.getLng() - camera.center.lng) < 1e-7;
      if (sameCenter && map.getLevel() === level) return;
      map.setCenter(new kakao.maps.LatLng(camera.center.lat, camera.center.lng));
      map.setLevel(level);
    }, [camera.center.lat, camera.center.lng, camera.zoom, status]);

    // 마커 동기화: 값(JSON)이 바뀔 때만 기존 제거 후 재생성(부모가 매 렌더 새 배열을 넘겨도 깜빡이지 않음).
    // place는 기본 핀, 그 외 kind는 CustomOverlay + inline HTML.
    const markersKey = JSON.stringify(withUserMarker(markers, userLocation));
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (status !== 'ready' || !kakao || !map) return;
      for (const m of markerObjsRef.current) m.setMap(null);
      markerObjsRef.current = withUserMarker(markers, userLocation).map((mk) => {
        const position = new kakao.maps.LatLng(mk.coord.lat, mk.coord.lng);
        const spec = markerSpec(mk.kind, mk.color);
        if (!spec) {
          const marker = new kakao.maps.Marker({ position, title: mk.title, map });
          kakao.maps.event.addListener(marker, 'click', () => propsRef.current.onMarkerPress?.(mk.id));
          return marker;
        }
        return new kakao.maps.CustomOverlay({
          position,
          content: markerHtml(spec),
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 3,
          map,
        });
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markersKey, status]);

    // 폴리라인 동기화: 흰 외곽선(zIndex 1, +3px)을 본선(zIndex 2) 아래에 깐다.
    const polylinesKey = JSON.stringify(polylines ?? []);
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (status !== 'ready' || !kakao || !map) return;
      for (const p of polylineObjsRef.current) p.setMap(null);
      polylineObjsRef.current = (polylines ?? []).flatMap((pl) => {
        const path = pl.coords.map((c) => new kakao.maps.LatLng(c.lat, c.lng));
        const st = polylineStyle(pl);
        const strokeStyle = st.dashed ? 'shortdash' : 'solid';
        return [
          new kakao.maps.Polyline({
            path, map, zIndex: 1, strokeColor: '#ffffff', strokeWeight: st.outlineWidth,
            strokeOpacity: 0.9, strokeStyle,
          }),
          new kakao.maps.Polyline({
            path, map, zIndex: 2, strokeColor: st.color, strokeWeight: st.width,
            strokeOpacity: 0.9, strokeStyle,
          }),
        ];
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polylinesKey, status]);

    // 레이어(F7): 값이 바뀔 때만.
    const layersKey = JSON.stringify(layers ?? {});
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (status !== 'ready' || !kakao || !map) return;
      applyLayers(kakao, map, layers);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layersKey, status]);

    // fitTo: ready 후·값(bounds+padding)이 바뀔 때 적용. camera effect보다 뒤에 선언돼 ready 시 camera보다 우선.
    const fitToKey = fitKey(fitTo);
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (status !== 'ready' || !kakao || !map || !fitTo) return;
      fitMap(kakao, map, fitTo.bounds, fitTo.padding);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitToKey, status]);

    // ready 전에 들어온 명령형 flyTo/fitBounds는 마지막 것만 ready 직후 적용(prop effect들보다 뒤).
    useEffect(() => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      const pending = pendingRef.current;
      if (status !== 'ready' || !kakao || !map || !pending) return;
      pendingRef.current = null;
      if (pending.type === 'fit') fitMap(kakao, map, pending.bounds, pending.padding);
      else flyMap(kakao, map, pending.center, pending.zoom);
    }, [status]);

    // 카카오를 못 쓰면 상위(웹 디스패처)에 알려 다른 렌더러로 전환시킨다.
    const unavailable = status === 'no-key' || status === 'error';
    useEffect(() => {
      if (unavailable) onUnavailable?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unavailable]);

    // 언마운트 정리.
    useEffect(
      () => () => {
        longPressRef.current?.detach();
        resizeObsRef.current?.disconnect();
        for (const o of [...markerObjsRef.current, ...polylineObjsRef.current]) o.setMap(null);
        markerObjsRef.current = [];
        polylineObjsRef.current = [];
      },
      [],
    );

    if (unavailable) {
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
