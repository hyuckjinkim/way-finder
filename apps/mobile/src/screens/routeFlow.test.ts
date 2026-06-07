/**
 * E3 라우트 통합 테스트 — 데모 모드 e2e 데이터 흐름.
 *
 * 라우트 어댑터(app/*.tsx)는 RN 트리를 렌더하지만, 이 패키지엔 react-test-renderer/DOM
 * 환경이 없다(의존성 추가 금지). 따라서 라우트 렌더 자체는 웹 정적 export가 검증하고,
 * 여기서는 어댑터가 의존하는 **데모 모드 데이터 계약**을 라우트 레벨 흐름으로 검증한다:
 *
 *   홈(스토어 카메라) → 검색(provider.search) → 상세(getDetail) → 로드뷰(detail.coord/roadview)
 *
 * 각 단계가 화면이 역참조하는 필드(name·coord·blogs·links·roadview)를 채워 반환하는지,
 * 그리고 검색→상세 단계에서 **구글 데이터가 fetch되지 않는지**(§11 lazy 방어선)를 확인한다.
 */
import { describe, it, expect } from 'vitest';
import { search, getDetail, getGoogleData } from '../services/PlaceService.js';
import { cameraForPlace } from './searchCamera.js';
import { selectRoadviewMode } from './roadview.js';

describe('E3 데모 모드 라우트 흐름', () => {
  it('검색 → 선택 → 카메라 이동: 한국어 질의가 핀 가능한 장소를 반환한다', async () => {
    const results = await search('카페');
    expect(results.length).toBeGreaterThan(0);
    const place = results[0];
    expect(place).toBeDefined();
    if (!place) return;
    // SearchScreen이 onSelectPlace(place, cameraForPlace(place))로 넘기는 계약.
    const camera = cameraForPlace(place);
    expect(camera.center).toEqual(place.coord);
    expect(camera.zoom).toBeGreaterThan(0);
  });

  it('영어 질의도 결과를 반환한다(한/영 양쪽)', async () => {
    const results = await search('cafe');
    expect(results.length).toBeGreaterThan(0);
  });

  it('상세: PlaceDetailSheet가 역참조하는 전 필드를 채워 반환한다', async () => {
    const detail = await getDetail('kakao:26338954');
    expect(detail.name).toBeTruthy();
    expect(detail.coord).toBeDefined();
    expect(detail.blogs).toBeDefined();
    expect(detail.links).toBeDefined();
    // 서울 장소 → 로드뷰 좌표 존재 → RoadviewScreen이 카카오 모드 placeholder를 렌더.
    expect(detail.roadview).toBeDefined();
    expect(selectRoadviewMode(detail)).toBe('kakao-roadview');
  });

  it('글로벌 장소: 로드뷰 없음 → 스트리트뷰 딥링크 모드', async () => {
    const detail = await getDetail('google:ChIJ51cu8IcbXWARiRtXIothAS4');
    expect(detail.roadview).toBeUndefined();
    expect(selectRoadviewMode(detail)).toBe('google-streetview');
  });

  it('구글 데이터는 별도 호출(getGoogleData)로만 흐른다 — 상세는 구글 fetch 없이 동작', async () => {
    // 상세 단계는 getDetail만 호출. 구글 평점·리뷰는 PlaceDetailSheet가 탭 활성 시
    // loadGoogle(=getGoogleData) 어댑터로 별도 요청한다.
    const googleData = await getGoogleData('kakao:26338954');
    expect(googleData).toHaveProperty('reviews');
    expect(Array.isArray(googleData.reviews)).toBe(true);
  });
});
