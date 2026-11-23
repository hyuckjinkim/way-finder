# map-compare — 지도 디테일 비교 PoC

- 목적: 같은 장소에서 MapLibre(OSM)와 카카오맵의 POI·건물·라벨 밀도를 나란히 보고 지도 엔진을 고른다.
- 결론: 한국 지도 품질은 카카오가 크게 앞선다 → **하이브리드**(한국=Kakao SDK, 글로벌·폴백=MapLibre)로 정함. 근거: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` §지도 렌더링.
- 상태: 끝남(2026-06-07). 앱 코드는 이 폴더를 쓰지 않는다. 비교용 `index.html` 은 2026-11-24 지웠다(결론은 위에 있다).
