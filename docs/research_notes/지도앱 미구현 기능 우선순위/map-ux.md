# Map-level UX features (Kakao Maps JS SDK + fallbacks) for wayfinder

Research date: 2026-11-20. "Verified" = read in a primary source during this session. "Inferred" = reasoning or prior knowledge with no source fetched this session.

Codebase context (verified by grep of `/mnt/d/Workspace/wayfinder`): `apps/mobile/src/map/loadKakaoSdk.ts` already lazy-loads the SDK via runtime `<script>` injection with `autoload=false` + `kakao.maps.load(cb)` and a cached Promise. `apps/mobile/app/+html.tsx` links `/manifest.webmanifest` and says "service worker 없음". No code was found for overlay map types, `navigator.share`, `Kakao.Share`, `kakaomap://`/`nmap://` deep links, `coord2Address`, `RoadviewClient`, `rightclick`, DeviceOrientation, or `beforeinstallprompt`. All of those are unimplemented.

## 1. Layers: Kakao overlay/base map types (traffic, bicycle, terrain, cadastral, roadview, skyview/hybrid)

### Takeaway
Everything asked about exists in the **Web** JS SDK and works with one call each. Base types (`ROADMAP | SKYVIEW | HYBRID`) go through `map.setMapTypeId()`. Overlays (`OVERLAY | TERRAIN | TRAFFIC | BICYCLE | BICYCLE_HYBRID | USE_DISTRICT`, plus `ROADVIEW` lines) go through `map.addOverlayMapTypeId()` / `removeOverlayMapTypeId()`. The docs say nothing about how fresh the TRAFFIC data is.

### Cited Findings
- Full `kakao.maps.MapTypeId` constant list, quoted from the Web docs: `ROADMAP`: 일반 지도, `SKYVIEW`: 스카이뷰, `HYBRID`: 하이브리드(스카이뷰 + 레이블), `ROADVIEW`: 로드뷰, `OVERLAY`: 레이블, `TRAFFIC`: 교통정보, `TERRAIN`: 지형도, `BICYCLE`: 자전거, `BICYCLE_HYBRID`: 스카이뷰를 위한 자전거 (어두운 지도에서 활용), `USE_DISTRICT`: 지적편집도 — [Kakao Maps Web API Documentation](https://apis.map.kakao.com/web/documentation/)
- "베이스 타입: ROADMAP SKYVIEW HYBRID / 오버레이 타입: OVERLAY TERRAIN TRAFFIC BICYCLE BICYCLE_HYBRID USE_DISTRICT". Base types are set with `Map.setMapTypeId`. Overlays are layered with `Map.addOverlayMapTypeId` and removed with `Map.removeOverlayMapTypeId` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `addOverlayMapTypeId(mapTypeId)`: "지도에 로드뷰, 교통정보 등의 오버레이 타입의 타일 이미지를 올린다. 로드뷰 타일 이미지를 추가할 경우 RoadviewOverlay 와 동일한 기능을 수행한다." Example: `map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Disclaimer on the cadastral layer: "지적편집도 오버레이 타입은 현행 지적 정보와 일치하지 않을 수 있으며 참고 이외의 용도로 사용하실 수 없습니다." — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Zoom ranges differ by base type. `setLevel` accepts "SKYVIEW, HYBRID 일 경우 0 ~ 14, ROADMAP 일 경우 1 ~ 14". — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Built-in controls: `new kakao.maps.MapTypeControl()` (roadmap/skyview toggle) and `new kakao.maps.ZoomControl()`, added with `map.addControl(control, kakao.maps.ControlPosition.TOPRIGHT)`. Map event `maptypeid_changed` exists — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Official samples: 교통정보 `/web/sample/addTrafficOverlay/`, 지형도 `/web/sample/addTerrainOverlay/`, 로드뷰 도로 `/web/sample/addRoadviewOverlay/`, 지도 타입 바꾸기 `/web/sample/changeOverlay1/`, `/changeOverlay2/`, controls `/web/sample/addMapControl/`, custom controls `/web/sample/addMapCustomControl/` — [Kakao sample index](https://apis.map.kakao.com/web/sample/)
- The KakaoMap **app** itself exposes these layer names through its URL scheme: `kakaomap://open?layer=skyview` "and similar `layer=` values for bike, traffic, hyperaccuratebus, airinfo, and cctv" — [KakaoMap URL Scheme (iOS v2 docs)](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/)

### Inferences
- Multiple overlay types can likely be stacked, since the add/remove API is per type. Not stated explicitly in the docs.
- Switching from SKYVIEW at level 0 back to ROADMAP needs a level clamp, because ROADMAP's minimum level is 1.
- The scheme `layer=` values approximate the KakaoMap app's layer menu: skyview, bicycle, traffic, real-time bus, air quality, CCTV.
- The minimum layer menu to ship is: base toggle (일반/스카이뷰(HYBRID)) plus overlay checkboxes (교통정보, 자전거, 지형도, 지적편집도, 로드뷰 도로). That is about 10 lines of code over the SDK, with no new dependency. In skyview, use `BICYCLE_HYBRID` instead of `BICYCLE` (per the doc's "어두운 지도에서 활용" note).
- The app-only layers (CCTV, air quality, hyper-accurate bus) have no `MapTypeId` constant in the Web SDK and cannot be replicated on web without separate data sources.
- MapLibre fallback: none of these Kakao tiles are available. Hide the layer menu, or show only a raster satellite source if one is licensed. Inferred.

### Gaps
- TRAFFIC tile **freshness / update interval**: the Web docs do not state it. The sample page is JS-rendered, so its text was not retrievable. No primary source found.
- Exact contents of the Naver Map and current KakaoMap app layer menus (late 2026) were not verified from screenshots or official help pages. Only the KakaoMap scheme `layer=` values above are sourced.

## 2. Roadview (로드뷰) in the Web SDK: API, cost, limits

### Takeaway
Roadview is fully supported on web: `Roadview`, `RoadviewClient.getNearestPanoId`, and `RoadviewOverlay`. According to a reply from Kakao's "Map" DevTalk account, quota is counted per `getNearestPanoId()` call (including null results) and per Map/Roadview object creation. `setPanoId` tile loads and `setViewpoint` are not counted. Undisclosed rate limits apply, and rapid continuous calls may be judged abuse. The Web (JavaScript) SDK free quota is 300,000/day.

### Cited Findings
- Signature: `roadviewClient.getNearestPanoId(position, radius, callback)`. "특정 좌표에서 반경 내 가장 가까운 로드뷰 파노라마 ID를 구한다." radius is in metres. The callback receives the panoId, or `null` if none. Example: `roadviewClient.getNearestPanoId(position, 50, function(panoId){ roadview.setPanoId(panoId, position); });` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `new kakao.maps.RoadviewOverlay()` draws road lines where roadview exists, via `setMap(map)` / `setMap(null)`. `addOverlayMapTypeId(MapTypeId.ROADVIEW)` is equivalent — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `kakao.maps.disableHD()` stops HD tiles on high-DPI devices, and "모바일용 로드뷰도 고화질이 아닌 일반화질로 노출된다". It must be called before creating a Map or Roadview. This is a bandwidth lever — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Samples: 로드뷰 생성 `/web/sample/basicRoadview/`, 지도 위 버튼으로 로드뷰 표시 `/web/sample/roadviewWithMapButton/`, 로드뷰와 지도 토글 `/web/sample/roadviewToggle/`, 동동이 연동 `/web/sample/moveRoadview/` — [Kakao sample index](https://apis.map.kakao.com/web/sample/)
- The official quota table lists "지도 Web(JavaScript) SDK 300,000건" per day — [Kakao quota doc](https://developers.kakao.com/docs/latest/ko/getting-started/quota) (search snippet only, not fetched)
- DevTalk thread (question 2026-07-31, reply 2026-08-03 by the "Map" account, which appears to be Kakao staff):
  - `getNearestPanoId()` counts as 1 per call, even when it returns null.
  - Quota is deducted when a Map or Roadview object is created.
  - `setPanoId()` tile and image loads are not counted separately.
  - `setViewpoint()` (pan/tilt/zoom) is not deducted.
  - A call-frequency limit exists, but its specifics are not public.
  - A pattern of one call every 600 ms during continuous movement "could be judged as abuse".
  - Commercial use needs a purpose review.
  - Once the daily quota is exhausted, calls are blocked unless a payment card or Biz Wallet balance exists, in which case they are auto-charged.
  - Covering the Kakao CI/logo with overlays is not allowed ("카카오 CI를 가려쓰는 행위는 허용하지 않습니다").

  Source: [DevTalk 150932](https://devtalk.kakao.com/t/web-sdk/150932)
- 2026 policy change (notice posted 2026-06-16, effective **2026-07-21**): Map API and Local API keep their "existing" free quota. Only the **first** app activated per developer account gets a free quota. A second app, or any usage over quota, needs Biz Wallet and usage billing. Apps activated before 2026-07-21 keep their current free quota "until further notice". The same notice adds new REST APIs (transit, walking, and bicycle routes at 1,000/day free then 10 KRW/call, static map at 1,000/day free then 2 KRW/call) — [DevTalk notice 150222](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)
- Zero-cost alternative: the web link `map.kakao.com/link/roadview/위도,경도` or `/link/roadview/장소ID` opens roadview in Kakao's own site or app — [Kakao Web guide](https://apis.map.kakao.com/web/guide/)

### Inferences
- The cheapest UX is a "로드뷰" button on a place or destination card that opens `map.kakao.com/link/roadview/lat,lng`. It needs no SDK roadview code and no quota. Embed an in-app `Roadview` panel only if users need it without leaving the app.
- For an embedded panel, call `getNearestPanoId` only on explicit user action. Calling it on every map move burns quota.

### Gaps
- No roadview-specific daily cap is published separately from the 300,000 Web SDK figure. The quota page was seen only as a search snippet.
- A search summary mentioned discounted Kakao Map pricing from 2026-02-02 to 2026-12-31, possibly reverting afterwards. The pricing page was not found or fetched, so this is unverified.
- Whether wayfinder's Kakao app was activated before or after 2026-07-21 determines its free quota. The owner must check the console.

## 3. Sharing: KakaoTalk share, Web Share API, deep links, QR

### Takeaway
Use a layered approach. First, `navigator.share({title,url})` on mobile when available, since the existing `?o=&d=&w=&mode=` URL is already shareable. Second, an explicit "카카오톡 공유" button via `Kakao.Share.sendDefault`, which needs the JS key, a registered domain, and "제품 링크 관리". Third, a copy-link fallback. Fourth, "카카오맵/네이버지도에서 열기" links using the web `/link/` URLs or app schemes.

### Cited Findings
- **KakaoTalk share (JS SDK):** `Kakao.Share.sendDefault()` sends default templates (feed, list, **location**, commerce, text) from your own button. `sendCustom()` uses a template ID built in the message template tool. `sendScrap()` scrapes a URL. `create*Button({container,...})` variants render the SDK's own button. The module was renamed to `Share` in JS SDK 1.43.0 — [Kakao Developers: 카카오톡 공유 JS](http://developers.kakao.com/docs/ko/kakaotalk-share/js-link)
- Requirements: JavaScript key, JavaScript SDK domain (web platform registration), and "제품 링크 관리" for share. Scrap needs the scraped domain registered. Images up to 5 MB, kept on Kakao servers for up to 100 days. Link objects take `mobileWebUrl` and `webUrl` — [Kakao Developers: 카카오톡 공유 JS](http://developers.kakao.com/docs/ko/kakaotalk-share/js-link)
- **Web Share API:** `navigator.share()` works only in a secure context (HTTPS) and requires **transient user activation** (a click). It is gated by the `web-share` Permissions Policy. It rejects with `AbortError` (user cancelled), `NotAllowedError`, `DataError`, `InvalidStateError`, or `TypeError`. Use `navigator.canShare()` to feature-detect. MDN marks it "Limited availability", not Baseline — [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- **KakaoMap web links** (auto-select mobile/PC Kakao Map):
  - `https://map.kakao.com/link/map/이름,위도,경도`
  - `https://map.kakao.com/link/to/이름,위도,경도`
  - `https://map.kakao.com/link/from/이름,위도,경도/to/이름,위도,경도`
  - `https://map.kakao.com/link/by/{car|traffic|walk|bicycle}/이름,위도,경도/이름,위도,경도[/…]`, up to 5 waypoints, but `traffic` (transit) accepts none
  - `/link/roadview/위도,경도`
  - `/link/search/검색어`

  Source: [Kakao Maps Web guide](https://apis.map.kakao.com/web/guide/)

### Inferences
- The KakaoTalk share SDK (`kakao.min.js` + `Kakao.init(JS_KEY)`) is a different script from the Maps SDK (`dapi.kakao.com/v2/maps/sdk.js`) and must be lazy-loaded separately. This is prior knowledge; the share page links to getting-started for installation.
- Web Share support (inferred from prior knowledge, not re-verified on caniuse this session): supported in iOS/iPadOS Safari, Chrome Android, Samsung Internet, and desktop Safari/Edge/Chrome on Windows/ChromeOS. Firefox desktop lacks it. So on desktop the floating card should show "링크 복사" plus a KakaoTalk button, and on phone it should call `navigator.share` first.
- KakaoTalk in-app browser is a common entry point in Korea. Whether `navigator.share` works inside it was not verified, so keep the copy-link fallback.
- QR: render the current share URL with a small QR lib only on desktop ("폰으로 보내기"). Defer this until asked; copy link plus KakaoTalk share covers the need (YAGNI).
- `Kakao.Share.sendDefault({objectType:'location', address, addressTitle, content:{...link:{mobileWebUrl,webUrl}}})` fits a single place. A `feed` template with the route URL fits a route. The location-template field names are from prior knowledge; that page did not list them.

### Gaps
- Exact current `kakao.min.js` version and integrity hash (getting-started page not fetched).
- KakaoTalk share daily quota (the quota page is linked from the docs but was not read).
- Per-browser Web Share table (caniuse not fetched; MDN compat table not in the extracted content).

## 4. Navigation handoff (길안내 시작 → KakaoMap / Naver Map / TMAP)

### Takeaway
A web app can't do turn-by-turn, so hand off with app schemes, each with a web fallback. KakaoMap: `kakaomap://route?sp=lat,lng&ep=lat,lng&by=car|publictransit|foot|bicycle`, falling back to `m.map.kakao.com/scheme/route?...` or `map.kakao.com/link/by/...`. Naver: `nmap://route/{walk|public|car|bicycle}?slat&slng&sname&dlat&dlng&dname&appname=` and `nmap://navigation?...` for car. TMAP is car-only, and its params are only community-documented.

### Cited Findings
- KakaoMap app scheme, from the official KakaoMapsSDK v2 doc:
  - `kakaomap://route?sp=37.39529,127.11044&ep=37.49795,127.02763&by=car`
  - With a waypoint: `kakaomap://route?sp=…&vp=…&ep=…&by=foot`
  - `by` values: `car`, `publictransit`, `foot`, `bicycle`
  - Waypoints `vp` to `vp5`; public transit doesn't support waypoints
  - Other paths: `kakaomap://look?p=lat,lng`, `place?id=`, `search?q=&p=`, `roadView?p=`
  - Mobile-web fallback: `http://m.map.kakao.com/scheme/` + the same path and query
  - If the scheme isn't recognised, the link leads to the App Store; an unsupported action is handled like `open`

  Source: [KakaoMap URL Scheme](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/)
- Coordinate order in `sp`/`ep` is **lat,lng** in all official examples (e.g. `37.39529,127.11044`) — [KakaoMap URL Scheme](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/). A DevTalk thread shows developers confusing the x/y order — [DevTalk 124593](https://devtalk.kakao.com/t/url-schema/124593) (search snippet only, not fetched)
- Known bug, May–June 2026: `m.map.kakao.com/scheme/route?...&by=publictransit` opened the **car** tab on mobile web, and on iOS Safari the bridge page's "open in KakaoMap" showed an invalid-address alert instead of going to the App Store. Kakao staff said on 2026-05-27 that it was a redirection logic issue and on 2026-06-05 that the update was complete — [DevTalk 149792](https://devtalk.kakao.com/t/url-scheme/149792)
- Naver Map app scheme. Base: `nmap://{actionPath}?{params}&appname={appname}`. `appname` is **required**; for mobile web it is the page URL. Action paths: `/route/public`, `/route/car`, `/route/walk`, `/route/bicycle`, `/navigation`. Route params: `slat`, `slng`, `sname` (optional; default is the current location), **`dlat`, `dlng` required**, `dname`, waypoints `v1lat`/`v1lng`/`v1name` to `v5`. Lat range 31.43–44.35, lng range 122.37–132.00. Example: `nmap://navigation?dlat=37.5209436&dlng=127.1230074&dname=…&appname=com.example.myapp`. Page last updated 2026-09-17 and flagged `stale: true` — [NCloud Maps URL Scheme (EN)](https://guide.ncloud-docs.com/docs/en/maps-url-scheme)
- Naver fallbacks:
  - Android mobile web: `intent://{actionPath}?{params}&appname=…#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`, which auto-redirects to Play Store if the app is absent
  - iOS mobile web: set `location.href='nmap://…'`; after about 1.5 s, if less than 2 s have elapsed, redirect to the App Store link `http://itunes.apple.com/app/id311867728?mt=8`

  Source: [NCloud Maps URL Scheme](https://guide.ncloud-docs.com/docs/maps-url-scheme)
- TMAP: no official doc found. Community posts use `tmap://route?rGoName=…&rGoX={lng}&rGoY={lat}`, where X is longitude and Y is latitude. An older 2018 variant is `tmap://?rGoName=…&rGoY=…&rGoX=…` — [velog iOS URL Scheme post](https://velog.io/@cm961115/iOS-URL-Scheme으로-지도-앱-연동하기-TMap-kakaoMap-naver지도); [Clien post](https://www.clien.net/service/board/cm_iphonien/12610699) (both search snippet only, not fetched)

### Inferences
- Mode mapping from wayfinder `mode`:

  | wayfinder `mode` | KakaoMap `by` | Kakao web `/link/by/` | Naver path | TMAP |
  |---|---|---|---|---|
  | walk | `foot` | `walk` | `/route/walk` | n/a |
  | transit | `publictransit` | `traffic` | `/route/public` | n/a |
  | car | `car` | `car` | `/route/car` or `/navigation` | `tmap://route?rGo…` (unverified) |

- Waypoint caveat: wayfinder's `w=` waypoints cannot be passed for transit to KakaoMap (official restriction). Show a "경유지는 대중교통에서 무시됨" note or drop them.
- Simplest robust handoff from a web page:
  - On desktop, link to `https://map.kakao.com/link/by/...` (no scheme needed).
  - On mobile, the official KakaoMap path is the `m.map.kakao.com/scheme/route?...` link. It is Kakao's own bridge page, which tries the app and otherwise offers install.
  - For Naver, use `intent://` on Android and the timed-redirect `nmap://` on iOS.
  - In both cases open from a direct click handler.
- Present this as a small "다른 앱으로 길안내" sheet (KakaoMap / 네이버지도 / TMAP for car only) rather than auto-launching.

### Gaps
- Naver Map **web** directions URL format (`map.naver.com/p/directions/{start}/{goal}/{waypoints}/{mode}`) is not an officially documented public API. No primary source was found this session, so treat it as unstable if used.
- Naver's cited page is flagged `stale: true`. `https://guide.ncloud-docs.com/docs/application-maps-url-scheme-vpc` (seen in search results, not fetched) is likely the current version, so re-check parameter names there before implementing.
- TMAP official scheme documentation was not found, and the parameter names are community-reported only.
- Whether `nmap://` and `kakaomap://` open from inside the KakaoTalk in-app browser is unverified.

## 5. Map interaction niceties: rotation, zoom, scale, location follow and heading, long-press, "이 지역 재검색", dark mode, PWA

### Takeaway
The Kakao Web SDK has **no map rotation, bearing, or heading API**: a case-insensitive search of the full docs page for rotat/bearing/heading/tilt matched only Roadview `pan`/`tilt` viewpoint options, never Map. so a compass or heading-up mode is not possible on the Kakao map. A "my location + heading cone" marker is still doable with a rotated CustomOverlay driven by DeviceOrientation. Zoom control, map-type control, keyboard shortcuts, click/rightclick/idle events, `getBounds`, and `coord2Address` all exist. Long-press is not a native event and has to be synthesized. There is no dark-mode map style in the Kakao SDK, so the in-SDK fallback is skyview (`HYBRID`); MapLibre can use a dark style.

### Cited Findings
- Map methods in the Web docs: `setCenter`, `getCenter`, `setLevel`, `getLevel`, `setMapTypeId`, `setBounds`, `getBounds`, `setMinLevel`, `setMaxLevel`, `panBy`, `panTo`, `jump`, `addControl`, `setDraggable`, `setZoomable`, `relayout`, `addOverlayMapTypeId`, `setKeyboardShortcuts`, `setCopyrightPosition`, `getProjection`, `setCursor`. A case-insensitive search of the 2.1 MB documentation page for `rotat|bearing|heading|tilt` matched only Roadview options ("pan: 0이 정북방향", tilt, zoom). There were no Map rotation methods, no "회전", no `scale`/ScaleControl, and no Map `styles` option (`setStyles` exists only on MarkerClusterer) — [Kakao docs](https://apis.map.kakao.com/web/documentation/) (absence verified by text search of the downloaded page)
- Map events: `center_changed`, `zoom_start`, `zoom_changed`, `bounds_changed`, `click`, `dblclick`, `rightclick`, `mousemove`, `dragstart`, `drag`, `dragend`, `idle`, `tilesloaded`, `maptypeid_changed` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Map options: `draggable`, `scrollwheel`, `disableDoubleClick`, `disableDoubleClickZoom`, `tileAnimation` (default true), `keyboardShortcuts` (default false), `speed`. `setLevel(level, {animate:{duration}, anchor})` animates only when the level difference is 2 or less — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `setBounds(bounds, paddingTop, paddingRight, paddingBottom, paddingLeft)` has a default padding of 32 on all sides. This is needed so route fit-to-bounds is not hidden under the bottom sheet or floating card — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `setCopyrightPosition(kakao.maps.CopyrightPosition.BOTTOMRIGHT, reversed)` lets the Kakao logo/copyright be moved, for example above a bottom sheet — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Reverse geocoding:
  - `geocoder.coord2Address(x, y, callback, options)` takes x = lng and y = lat. It returns 구 주소 and 도로명 주소; "도로명 주소는 좌표에 따라서 표출되지 않을 수 있다."
  - `coord2RegionCode(x, y, cb)` returns 행정동/법정동.
  - Both require `libraries=services`.

  Source: [Kakao docs](https://apis.map.kakao.com/web/documentation/); [Kakao Web guide](https://apis.map.kakao.com/web/guide/)
- Samples: 클릭 이벤트 `/web/sample/addMapClickEvent/`, 클릭한 위치에 마커 `/web/sample/addMapClickEventWithMarker/`, geolocation 마커 `/web/sample/geolocationMarker/`, 키워드 검색 `/web/sample/keywordBasic/` — [Kakao sample index](https://apis.map.kakao.com/web/sample/)
- "Search this area": `new kakao.maps.services.Places([map])`. Search options include `bounds` and `useMapBounds` ("지정한 Map 객체의 영역을 사용할지의 여부. 참일 경우, bounds 속성은 무시된다. 기본값은 false") and `useMapCenter`. `categorySearch` is area-based by default and needs `x,y`/`rect`/`location`/`bounds` or `useMapBounds` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- Pixel to LatLng: `map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x, y))`, where "화면 좌표(pixel)에 해당하는 지도 좌표를 반환한다. 해당 화면 좌표는 지도 엘리먼트의 좌상단을 기준으로 한 좌표이다." The inverse is `containerPointFromCoords(latlng)` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)

### Inferences
- **Long-press → 출발/도착 설정:** Kakao has no `longpress` event. On desktop use `rightclick`, which is a native event. On touch devices, start a timer of about 500 ms on `touchstart` on the map container, cancel it on `touchmove`/`touchend` or on Kakao `dragstart`/`zoom_start`, then convert the pixel to LatLng with `map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(x,y))`. Then call `coord2Address(latlng.getLng(), latlng.getLat(), cb)` and show a small sheet: "여기를 출발지로 / 도착지로 / 경유지로".
- **"이 지역 재검색":** show the button on `idle` after a user `dragend`/`zoom_changed` when the center has moved more than X% of the viewport since the last search. On tap, re-run with `places.keywordSearch(q, cb, {bounds: map.getBounds()})`, or construct `Places(map)` with `useMapBounds: true`. Don't auto-search on every `idle`; it wastes quota.
- **Current-location follow:** use `navigator.geolocation.watchPosition` and `map.panTo` while following, and drop out of follow mode on user `dragstart`. Heading: `DeviceOrientationEvent` (`webkitCompassHeading` on iOS, which needs `DeviceOrientationEvent.requestPermission()` from a click) rotates a CSS-transformed CustomOverlay arrow. The map itself stays north-up.
- **Scale bar:** the docs have no `scale` API at all. A built-in scale indicator next to the logo may render by default (prior use, unverified). If not, a custom scale needs meters-per-pixel computed via `containerPointFromCoords`.
- Keep the Kakao logo/copyright visible above the bottom sheet (`setCopyrightPosition`). DevTalk 150932 says covering the Kakao CI with overlays is not allowed.
- **Dark mode:** no Kakao map style API exists (verified absence above). Options are a CSS `filter: invert(1) hue-rotate(180deg)` hack on tile panes (inferred; it breaks marker and roadview colors and Kakao ToS compliance is unknown, so not recommended), or skyview `HYBRID`. On MapLibre, use a dark vector style.
- **PWA/offline:** a manifest already exists and there is no service worker. Kakao tiles are served by Kakao, and caching them offline is likely against their terms (not verified). Offline should be limited to the app shell plus the last route JSON. An install prompt via `beforeinstallprompt` works on Chromium only; iOS needs "홈 화면에 추가" instructions (inferred).

### Gaps
- Naver/Kakao web map dark mode availability as of late 2026: not researched, no source.
- Kakao terms on tile caching and CSS filtering of tiles: not found.
- Whether Kakao Web SDK supports pinch-rotate at all: confirmed absent from the API docs, but not tested in a browser.

## 6. Accessibility & performance on mobile map web apps (lazy SDK, tiles, gesture conflicts)

### Takeaway
The SDK lazy-loading is already done correctly in wayfinder. The remaining levers are `libraries=` minimisation, `disableHD()` on low-end devices, `relayout()` after sheet or container resizes, `setBounds` padding equal to the sheet or card height, and disabling map drag/zoom while a sheet drag is in progress. Keyboard shortcuts are off by default and should be enabled on desktop.

### Cited Findings
- `kakao.maps.load(callback)` with `autoload=false` is the documented way to inject the SDK dynamically — [Kakao docs](https://apis.map.kakao.com/web/documentation/). wayfinder already does this in `apps/mobile/src/map/loadKakaoSdk.ts` (verified in code).
- Libraries are opt-in: `libraries=services,clusterer,drawing`. Load only what's used, e.g. `services` for geocoder and places — [Kakao Web guide](https://apis.map.kakao.com/web/guide/)
- The SDK only works on registered JS SDK domains. Register `localhost:<port>` for dev — [Kakao Web guide](https://apis.map.kakao.com/web/guide/)
- `kakao.maps.disableHD()` must be called before creating a Map or Roadview. It disables HD tiles on high-DPI devices — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `relayout()` must be called after the map container's size changes. The docs' example resizes the container and then calls `map.relayout()` — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `setDraggable(false)` / `setZoomable(false)` block touch-drag and pinch/wheel zoom programmatically. Programmatic zoom still works — [Kakao docs](https://apis.map.kakao.com/web/documentation/)
- `setKeyboardShortcuts(true)` / option `keyboardShortcuts` (default false) enable arrow and +/- keys — [Kakao docs](https://apis.map.kakao.com/web/documentation/)

### Inferences
- Gesture conflict: during a bottom-sheet drag, call `map.setDraggable(false)` and restore it on release. Give the sheet `touch-action: none` on its handle and `overscroll-behavior: contain` on its scroll body, so a sheet scroll doesn't pan the map or pull-to-refresh the page.
- After snapping the sheet or opening the desktop card, call `map.relayout()` only if the container itself resized. If the sheet overlays the map, use `setBounds(bounds, top, right, sheetHeight+16, left)` instead.
- A11y: SDK controls are images. Wrap custom controls (layer menu, my-location, 재검색) as real `<button>` elements with `aria-label` and keyboard focus. Enable `keyboardShortcuts` on desktop and give the map container `role="application"` plus `aria-label`. Provide the route as a text step list in the sheet, since the map itself is not screen-reader accessible. The 44×44 px touch target guidance is general WCAG/HIG knowledge, not sourced this session.
- Performance: lazy-load roadview and KakaoTalk share scripts only on first use. Each `getNearestPanoId` and `coord2Address` call costs quota, so debounce long-press and 재검색.

### Gaps
- No Kakao-specific accessibility guidance was found. The items above are general best practice (inferred).
- Tile HTTP caching headers from Kakao tile servers were not inspected.
