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
import type { CameraState } from '@wayfinder/shared';
import { DEFAULT_CAMERA } from '../services/LocationService.js';

export interface AppState {
  /** 현재 지도 카메라 */
  camera: CameraState;
  /** 선택된 장소 id (null = 미선택) */
  selectedPlaceId: string | null;
  /** 검색어 */
  searchQuery: string;
  /** 구글 탭 활성 여부 — true일 때만 구글 데이터 fetch */
  isGoogleTabActive: boolean;
}

export interface AppActions {
  setCamera(camera: CameraState): void;
  selectPlace(id: string | null): void;
  setSearchQuery(query: string): void;
  setGoogleTabActive(active: boolean): void;
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  // 초기 상태
  camera: DEFAULT_CAMERA,
  selectedPlaceId: null,
  searchQuery: '',
  isGoogleTabActive: false,

  // 액션
  setCamera: (camera) => set({ camera }),
  selectPlace: (id) => set({ selectedPlaceId: id, isGoogleTabActive: false }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setGoogleTabActive: (active) => set({ isGoogleTabActive: active }),
}));
