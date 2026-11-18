/**
 * D4 — Zustand 스토어.
 *
 * 앱 전역 상태:
 * - camera: 현재 지도 카메라 상태 (center + zoom)
 * - selectedPlaceId: 선택된 장소 id (바텀시트 표시 대상)
 * - searchQuery: 현재 검색어
 * - isGoogleTabActive: 구글 탭 활성 여부 (lazy fetch 게이트)
 *
 * 화면 컴포넌트를 import하지 않는다 — 훅/서비스만 export.
 */
import { create } from 'zustand';
import type { CameraState, LatLng } from '@wayfinder/shared';
import { DEFAULT_CAMERA } from '../services/LocationService.js';

/** 지도에 핀으로 표시할 선택 장소(검색·장소 상세 라우트가 기록, 홈이 소비). */
export interface SelectedPlace {
  id: string;
  name: string;
  coord: LatLng;
}

export interface AppState {
  /** 현재 지도 카메라 */
  camera: CameraState;
  /** 선택된 장소 id (null = 미선택) */
  selectedPlaceId: string | null;
  /** 선택된 장소(핀·카메라 맞춤 대상). selectedPlaceId와 항상 같은 id. */
  selectedPlace: SelectedPlace | null;
  /** focusPlace 호출 횟수 — 같은 장소를 다시 골라도 홈이 다시 화면에 맞추게 하는 신호. */
  focusSeq: number;
  /** 내 위치(GPS) — 알려지면 지도에 파란 점. */
  userLocation: LatLng | null;
  /** 검색어 */
  searchQuery: string;
  /** 구글 탭 활성 여부 — true일 때만 구글 데이터 fetch */
  isGoogleTabActive: boolean;
}

export interface AppActions {
  setCamera(camera: CameraState): void;
  selectPlace(id: string | null): void;
  /** 선택 장소만 기록/해제(카메라·맞춤 신호 없음). */
  setSelectedPlace(place: SelectedPlace | null): void;
  /** 장소를 선택하고 카메라를 옮기며 홈에 '화면에 맞춰라' 신호를 보낸다. */
  focusPlace(place: SelectedPlace, camera: CameraState): void;
  setUserLocation(coord: LatLng | null): void;
  setSearchQuery(query: string): void;
  setGoogleTabActive(active: boolean): void;
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  // 초기 상태
  camera: DEFAULT_CAMERA,
  selectedPlaceId: null,
  selectedPlace: null,
  focusSeq: 0,
  userLocation: null,
  searchQuery: '',
  isGoogleTabActive: false,

  // 액션
  setCamera: (camera) => set({ camera }),
  selectPlace: (id) => set({ selectedPlaceId: id, selectedPlace: null, isGoogleTabActive: false }),
  setSelectedPlace: (place) =>
    set({ selectedPlace: place, selectedPlaceId: place?.id ?? null, isGoogleTabActive: false }),
  focusPlace: (place, camera) =>
    set((s) => ({
      selectedPlace: place,
      selectedPlaceId: place.id,
      camera,
      focusSeq: s.focusSeq + 1,
      isGoogleTabActive: false,
    })),
  setUserLocation: (coord) => set({ userLocation: coord }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setGoogleTabActive: (active) => set({ isGoogleTabActive: active }),
}));
