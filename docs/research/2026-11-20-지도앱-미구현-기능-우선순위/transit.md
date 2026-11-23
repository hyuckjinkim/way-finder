# Advanced public-transit features for wayfinder: what Korean map apps offer and which free APIs can power them

Research date: 2026-11-20. "Verified" = read from an official doc page in this session. "Snippet" = known only from a search-result summary; the page was not read in full. "Probe" = direct HTTP request made from this research sandbox (dummy keys, error responses), not documentation. "Inferred" = my reasoning, not a source.

**Most important finding:** ODsay's free **Basic** plan is **30 calls/day** (verified, terms effective 2026-09-21). That is very likely (inferred) why the app hits 429 "Daily quota exceeded" — [ODsay totalPolicy](https://lab.odsay.com/doc/totalPolicy). Kakao launched a **public-transit route REST API on 2026-07-21 with 1,000 free calls/day** — [Kakao DevTalk 150222](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222). It is the strongest free fallback or replacement (see sections 2 and 5).

## 1. Real-time arrival (bus + subway): endpoints, quotas, keys, coverage, CORS, latency

### Takeaway
Free real-time arrival data exists for Seoul subway, Seoul bus, Gyeonggi bus and the rest of the country (TAGO). Quotas run from 1,000 to 10,000 calls/day per development key, and keys are auto-approved. Seoul's endpoints are `http://`-only, so an HTTPS web app must go through the existing proxy (`services/proxy`). ODsay has no realtime endpoint of its own. Its guide says to join ODsay stop IDs to these public APIs.

### Cited Findings
**Seoul subway: 서울시 지하철 실시간 도착정보 (swopenAPI)**
- Dataset OA-12764: "서울시 교통정보과[TOPIS]에서 제공하는 정보를 이용한 지하철 실시간 도착정보 조회 API". Refresh is "실시간", metadata updated 2026.11.19, and station-name lookup quirks are listed (e.g. 응암 → 응암순환(상선), 천호 → 천호(풍납토성)) — [data.seoul.go.kr OA-12764](https://data.seoul.go.kr/dataList/OA-12764/F/1/datasetView.do)
- A bulk all-stations variant also exists: "서울시 지하철 실시간 도착정보(일괄)", OA-15799, about 3,186 rows, refreshed in real time — [data.seoul.go.kr OA-15799](https://data.seoul.go.kr/dataList/OA-15799/A/1/datasetView.do)
- Quota (verified): "실시간 지하철 오픈API의 경우 하루에 최대 1,000건 요청할 수 있습니다." The realtime subway key is a separate application ("실시간 지하철 인증키 신청") from the general key. The limit can be lifted by registering a 활용사례 (gallery entry) with the key — [서울 열린데이터광장 이용안내](https://data.seoul.go.kr/together/guide/useGuide.do)
- Coverage: only station sections inside Seoul city ("서울시 이외의 역구간은 미제공"). The response field `recptnDt` is the generation time, so clients should correct for the difference between now and `recptnDt` — search snippet of [OA-12764](https://data.seoul.go.kr/dataList/OA-12764/S/1/datasetView.do) (not re-read in full)
- A notice titled "지하철 실시간 도착정보 API 서비스 일시 중단 안내" exists on the portal's 홍보마당. I saw the title only, with no dates — [열린데이터광장 홍보마당](https://data.seoul.go.kr/dataList/33/S/2/datasetView.do). Probe: on 2026-11-20 the sample-key endpoint `http://swopenapi.seoul.go.kr/api/subway/sample/json/realtimeStationArrival/0/5/서울` returned HTTP 200 with `INFO-000`, total 19, so the service was live at that time.
- Probe (CORS/HTTPS): the response carries `Access-Control-Allow-Origin: *`, but the `https://` URL timed out after 12 s. Only `http://` works, which a browser blocks from an HTTPS page as mixed content.

**Seoul bus: 서울특별시_버스도착정보조회 서비스 (data.go.kr 15000314)**
- Endpoint `http://ws.bus.go.kr/api/rest/arrive/getArrInfoByRouteAll`. Free, development account **1,000/day**, auto-approved for both development and operation, operation traffic raised on 활용사례 registration, XML only, guide dated 20250814, page updated 2025-12-02 — [data.go.kr 15000314](https://www.data.go.kr/data/15000314/openapi.do)
- ODsay's realtime integration guide: for Seoul, call `getStationByUid` (정류소정보조회 서비스) with ODsay's `arsID`, stripping the hyphen (`19-182` → `19182`). The sample response has `arrmsg1` "5분11초후[1번째 전]" and `arrmsg2` — [ODsay 실시간 도착정보 연동 가이드](https://lab.odsay.com/guide/guide)
- Probe: `http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid` returned `Access-Control-Allow-Origin: *` with a 401 for the dummy key, and `https://` timed out. This is the same HTTP-only problem as the subway API.

**Gyeonggi bus: 경기도_버스도착정보 조회 서비스 (data.go.kr 15080346, v2)**
- Base URL `https://apis.data.go.kr/6410000/busarrivalservice/v2`. REST, JSON+XML, free, development **1,000/day**, auto-approved, updated 2025-05-12. Provides arrivals per stop (정류소 ID) and per route (노선 ID) — [data.go.kr 15080346](https://www.data.go.kr/data/15080346/openapi.do)
- ODsay mapping: use `localStationID` from ODsay 대중교통 정류장 검색 as Gyeonggi's `stationId` — [ODsay guide](https://lab.odsay.com/guide/guide)

**Nationwide: 국토교통부_(TAGO)_버스도착정보 (data.go.kr 15098530)**
- Endpoint `https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList` with `cityCode` (from the 도시코드 목록 조회 operation) and `nodeId`. Free, **development 10,000/day**, auto-approved, REST JSON+XML, updated 2023-07-12 — [data.go.kr 15098530](https://www.data.go.kr/data/15098530/openapi.do)
- ODsay mapping: TAGO covers "그 외 18개 지역", using `localStationID` as `nodeId`. Busan has its own BIMS API (`bstopid` = `localStationID`) — [ODsay guide](https://lab.odsay.com/guide/guide)
- (Snippet, source page unidentified) Changwon's own bus-arrival API reportedly ends 2027-01-01, with users told to move to TAGO. This came from a search summary, and the originating data.go.kr page was not identified.
- Probe: the apis.data.go.kr gateway reflected the request Origin (`Access-Control-Allow-Origin: https://example.com`) on a 403 key error, and it serves HTTPS.

**ODsay's own realtime endpoints**
- The ODsay LAB navigation still contains anchors `#realtimeStation` and `#realtimeRoute`. In the raw page source, the code that renders these sections is **commented out** (`/*case 'realtimeRoute' ... case 'realtimeStation' ...*/`), and the reference text has no section for either — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)

### Inferences
- All arrival calls should go through `services/proxy`. Two reasons: the Seoul endpoints are `http://`-only, and the data.go.kr / Seoul keys should not ship in browser JS. A short server-side cache (about 15–30 s per stop) keeps a single key well inside 1,000/day for light use. Seoul's 1,000/day for realtime subway runs out quickly without one.
- Regional dispatch for bus arrival: Seoul uses arsID → ws.bus.go.kr, Gyeonggi uses localStationID → GBIS v2, Busan uses BIMS, and everything else uses TAGO. That covers the whole country with free keys.
- ODsay `realtimeStation`/`realtimeRoute` look discontinued or hidden. Do not design around them.

### Gaps
- Real-world latency or freshness (seconds) of any of these APIs: no source found.
- Gyeonggi v2 operation names under `/busarrivalservice/v2` (only the base URL was captured).
- How to look up stop IDs (arsID/stationId/nodeId) directly from the public bus APIs, without ODsay `searchStation`, was not researched.
- I did not fetch the quota of the Seoul `getStationByUid` product (정류소정보조회 서비스). Do not assume it is 1,000/day; that figure is for `getArrInfoByRouteAll` (15000314).
- The dates and scope of the Seoul subway "일시 중단" notice are unknown.
- Non-Seoul subway lines (Incheon, Gyeonggi metro sections, Busan and others) have no realtime source in this research.

## 2. ODsay: other endpoints, time options, free quota, paid tiers, and what 429 means

### Takeaway
The free Basic plan is **30 calls/day**, for individuals, students and startups of 5 people or fewer. Paid options are Standard (100,000/day, contact for price), Premium (more than 100,000/day) and Flex, a postpaid plan at **25 KRW per call** (new in the 2026-09-21 terms). `searchPubTransPathT` has **no departure-time parameter**. Time-based routing exists only in `maasRP` (`SearchTime`) and `subwayPathSchedule` (departure/arrival/첫차/막차 modes).

### Cited Findings
- Plan table (raw HTML cell verified: `<td>Basic</td> … <td>30 / 일</td> … 무료 / 기간 제한 없음`): Basic (개인/학생/스타트업) **30/일**, free, no term limit. Standard **100,000/일**, Korean only, 가격문의. Premium **100,000 초과/일**, multilingual, 가격문의. Flex 100,000/일, 후불형. Basic is limited to individuals, students and startups of 5 or fewer, and ineligible users are cut off and billed retroactively. Per-second limits exist, but "정확한 수치는 제공되지 않습니다." Over-quota users are notified by email/SMS and may be restricted — [ODsay 운영정책 (totalPolicy)](https://lab.odsay.com/doc/totalPolicy)
- Postpaid pay-as-you-go: "API 호출 건당 25원(부가가치세 별도)". Billable calls are those with a normal response (200 OK). Server 5xx is not billed, but user-side 4xx and parameter errors **are** billed. A monthly billing cap can be set in My Page. Terms effective "2026년 9월 21일" — [ODsay totalPolicy](https://lab.odsay.com/doc/totalPolicy)
- The base plans are for "API 단일호출" uses such as origin–destination search. Bulk route computation needs a separate "대용량 대중교통 API" contract — [ODsay totalPolicy](https://lab.odsay.com/doc/totalPolicy)
- Older rule (release note dated 2018-02-02, may be outdated): 500/401/403 errors and token-issue calls were not counted toward the daily call count — [ODsay Release Note v1](https://lab.odsay.com/guide/releaseNoteV1)
- FAQ: daily call limits differ by service type — [ODsay FAQ](https://lab.odsay.com/community/faq)
- Endpoint URL paths confirmed in the reference page as `https://api.odsay.com/v1/api/<name>`: airServiceTime, boundarySearch, busLaneDetail, busStationInfo, expressBusTerminals, expressServiceTime, intercityBusTerminals, intercityServiceTime, **loadLane**, **maasRP** (multimodal), pointBusStation, pointSearch, searchBikePathV2, searchBusLane, searchByCompany, searchCID, searchInterBusSchedule, **searchPubTransIsochrone**, searchPubTransPath, searchPubTransPathR, **searchPubTransPathT**, **searchStation**, **searchSubwaySchedule**, **searchWalkIsochrone**, **searchWalkPathV2**, subway (노선도), **subwayPath**, **subwayPathSchedule**, subwayStationInfo, subwayTimeTable, subwayTransitInfo, trainServiceTime, trainTerminals. No `realtimeStation`/`realtimeRoute` URL appears — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- `searchPubTransPathT` (v1.8) parameters: `SX, SY, EX, EY`, `OPT` (0 추천경로, 1 타입별정렬), `SearchType` (0 = in-city, with inter-city fallback), `SearchPathType` (**0 모두, 1 지하철, 2 버스**), plus `lang` and `output`. **There is no time parameter** — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- Multilingual output (`lang` ≠ 0): the guide says "현재 다국어 서비스는 유료로 제공" — [ODsay guide](https://lab.odsay.com/guide/guide); the policy table's Basic row says "다국어 제공" — [ODsay totalPolicy](https://lab.odsay.com/doc/totalPolicy). The two sources conflict, and this is unresolved.
- `maasRP` (multimodal): `SearchTime` **required** (`yyyyMMddHHmm`), `SearchMethod` (1 도보, 2 대중교통, 3 대중교통+자전거, 4 자전거). The response includes `totalTime`, `totalPayment`, `totalIntervalTime` (평균 배차간격), `checkIntervalTimeOverYn` (whether any line's headway exceeds a threshold) and `mapObj` — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- `subwayPathSchedule`: `SID`, `EID`, optional `MID`, **`MODE` 1 출발시간 기준 / 2 도착시간 기준 / 3 첫차 / 4 막차**, `DAY` (1 평일, 2 토, 3 일/공휴일), `TIME` (default now) — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- `searchSubwaySchedule` / subwayTimeTable: `stationID`, `wayCode` (1 상행, 2 하행), `showExpressTime`, `sepExpressTime`. Returns up/down timetables with `departureTime`, `subwayClass` (일반/급행/특급) and destination — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- Probe: `api.odsay.com` sends `Access-Control-Allow-Origin: *` and returns `[ApiKeyAuthFailed]` with HTTP 200 for a bad key. A browser can call it directly.

### Inferences
- 429 "Daily quota exceeded" almost certainly means the 30/day Basic cap was hit. 30/day cannot cover even one developer's testing if every search also calls `loadLane` once per path. Note that the 429 status code itself does not appear in the docs I fetched.
- Practical options: (a) cache ODsay responses in the proxy by rounded O/D plus a time bucket; (b) switch to Flex at 25 KRW/call. Each search is one `searchPubTransPathT` call plus `loadLane` calls (one per drawn path), so 1,000 searches/day ≥ 2,000 calls ≈ 50,000+ KRW/day ≈ 1.5M+ KRW/month before VAT. This is a lower bound, and it grows if every alternative's `loadLane` is fetched.; (c) make Kakao's transit API (1,000/day free) the primary router and keep ODsay for features only it has (loadLane polylines, timetables, 막차).
- For 출발시각/도착시각, ODsay's options are `maasRP` (departure time only) and `subwayPathSchedule` (subway only, including arrive-by and last train). There is no arrive-by mode for bus+subway journeys.

### Gaps
- Whether `loadLane` and the other helper calls each count as one call toward the 30/day: not documented in what I read.
- Whether `maasRP` and `subwayPathSchedule` are available on Basic or only on paid plans: not stated.
- Standard and Premium monthly prices are "가격문의" and not published.
- The exact error body and HTTP status ODsay returns on quota exhaustion are not documented. The 429 meaning above is inferred.

## 3. 출발/도착 시각 selection and 막차 warnings: how apps present them and which APIs support them

### Takeaway
Naver Map lets users change the departure time ("나중에 출발") and recomputes ETAs. That is documented only by a third-party blog, and I found no official source for Naver's or Kakao's 막차 or arrive-by UX. On the API side, time-specific routing is available from ODsay `maasRP` (depart-at), ODsay `subwayPathSchedule` (depart-at, arrive-by, first train, last train; subway only) and TMAP `searchDttm` (flags whether each leg is still running at a given time). Kakao's new transit API documents no time parameter.

### Cited Findings
- (Snippet) Naver Map mobile: tap '나중에 출발' at the bottom of the directions screen, change the departure time, and the ETA is recalculated. On PC, an arrow next to the 출발 시간 text sets date and time. This is a third-party blog, not official — [funissu.com](https://funissu.com/?p=15568)
- (Snippet; news report, not Naver press) June 2026: Naver's real-time walking guidance shows the transit line to board and its ETA. Android first, iOS to follow — [MTN news 2026-06-19](https://news.mtn.co.kr/news-detail/2026061916192041933)
- (Snippet) The Naver Map App Store listing mentions 실시간 도착정보 and 승하차 안내 — [App Store](https://apps.apple.com/KR/app/id311867728)
- TMAP transit `searchDttm` (`yyyymmddhhmi`, "타임머신 기능"): "사용자가 설정한 시각에 이동수단의 운행여부를 안내하는 정보". Per leg and per alternative lane, `service` is 1 운행중 or 0 운행종료 — [TMAP 대중교통 API docs](https://transit.tmapmobility.com/docs/routes)
- ODsay `subwayPathSchedule` MODE 2 (arrive-by), 3 (첫차) and 4 (막차); `maasRP` `SearchTime` (depart-at) — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- Kakao `GET https://dapi.kakao.com/v2/routing/publictraffic`: the docs list only coordinates, names and coordinate-system params, with no time, sort or mode-filter parameter. This comes from a summarized fetch of the docs page — [Kakao Developers 카카오맵 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api)

### Inferences
- The cheapest 막차 warning for wayfinder: once routes are found after about 22:00, call ODsay `subwayPathSchedule` with MODE=4 for the subway legs, or use TMAP `searchDttm`/`service=0`, and show a "막차 이후 운행 종료" badge. Bus last-run times could come from ODsay `busLaneDetail` (it was not read here; verify it exposes 첫차/막차).
- "도착시각 기준" for mixed bus+subway trips has no free API. An approximation is to search with `maasRP` at several departure times and pick the latest that still arrives in time, at extra quota cost.

### Gaps
- No official Naver or Kakao help page or release note found on how they show 막차 warnings, arrive-by search, or the time picker.
- Whether ODsay `busLaneDetail` includes first/last bus times was not verified.

## 4. Route comparison UX: sorting, filters, congestion data

### Takeaway
Sorting by 최소시간, 최소환승 or 최소도보 can be done client-side with fields ODsay already returns. Filtering to subway-only or bus-only is a native ODsay parameter (`SearchPathType`). Free congestion data exists only as **quarterly statistical** subway data from 서울교통공사, lines 1–8, in 30-minute slots. Real-time or predicted congestion is available from TMAP's congestion APIs, whose price was not confirmed.

### Cited Findings
- ODsay `searchPubTransPathT` per-path summary fields: `totalTime` (총 소요시간), `totalWalk` (총 도보 이동 거리), `busTransitCount`, `subwayTransitCount`, `totalDistance`, plus `payment`. `OPT` offers only 0 추천 or 1 타입별 sorting. `SearchPathType` 1 = subway only, 2 = bus only — [ODsay API Reference](https://lab.odsay.com/guide/releaseReference)
- TMAP transit response per itinerary: `totalTime`, `transferCount`, `totalWalkDistance`, `totalWalkTime`, `fare.regular.totalFare`, `routeColor`, `pathType` (1 지하철, 2 버스, 3 버스+지하철, …), with up to 10 results (`count`) — [TMAP 대중교통 API docs](https://transit.tmapmobility.com/docs/routes)
- Kakao transit response: `type` (BUS, SUBWAY or BUS_AND_SUBWAY), `totalTime`, `transfers`, `fare`, `totalDistance`, and counts `bus`, `subway`, `busAndSubway`. Kakao notes that vehicle type names (간선, 지선, …) may change, so they should not be hard-coded — [Kakao Developers REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api)
- 서울교통공사_지하철혼잡도정보 (data.go.kr 15071311): free file data (CSV, also served as an auto-generated API), lines 1–8, built from transit-card data with optimal-path estimation, **updated quarterly**, next release 2027-01-27, page updated 2026-11-03 — [data.go.kr 15071311](https://www.data.go.kr/data/15071311/fileData.do)
- The TMAP transit API family lists "진입 역 기준 열차 혼잡도", "진입 역 기준 칸 혼잡도" and "진입 역 기준 칸별 하차 비율" alongside the route API. I saw the names only and did not read the specs — [TMAP 이용절차](https://transit.tmapmobility.com/guide/procedure)
- (Snippet) Kakao (Daum Maps) added a mobile transit 경로비교 (route comparison) feature, an older press release — [Kakao corp](https://www.kakaocorp.com/page/detail/7336?lang=ENG)
- Kakao DevTalk answer, 2026-10-06: "실시간 성 정보는 오픈API로 제공하고 있지 않습니다." Real-time bus arrival, bus position and congestion are not available from Kakao's open APIs — [Kakao DevTalk](https://devtalk.kakao.com/t/api/151941)

### Inferences
- Implement sort tabs (추천/최소시간/최소환승/최소도보) as a pure client-side sort over the already-fetched alternatives, where transfers = `busTransitCount + subwayTransitCount`. This costs no extra API calls. Bus-only and subway-only filters can be applied client-side on `pathType`/`subPath.trafficType` instead of re-querying, which saves the scarce ODsay quota.
- Congestion: a static lookup table from the 서울교통공사 CSV (station × direction × 30-min slot) is enough for a "평소 혼잡" hint on lines 1–8 at no cost. It is statistical, not real-time.

### Gaps
- No official source found for how Naver and Kakao label and present sort orders and filters, or for their congestion UI.
- TMAP congestion API pricing, coverage and update frequency were not verified.
- No free real-time subway or bus congestion API was found. The SK/TMAP congestion APIs may be paid.

## 5. Alternatives to ODsay when the quota is exhausted

### Takeaway
**Kakao's transit route REST API** (launched 2026-07-21) is the best free alternative: 1,000 calls/day free for the account's first Kakao-Map-activated app, then 10 KRW/call. It returns per-step paths, fares and transfers, but has no time, realtime or sort options. TMAP transit (SK Open API) is richer (time flag, 10 results, congestion family), but I could not confirm its free tier. I found no sources on Google Routes transit coverage in Korea or on Naver Cloud transit.

### Cited Findings
- Kakao notice, 2026-06-16, effective **2026-07-21**: four new open APIs (대중교통 경로 조회, 도보 경로 조회, 자전거 경로 조회, 정적 지도 조회). The review process is abolished: activate the Kakao Map API in app management. Free quota goes only to the **first** app per developer account that activates Kakao Map. Transit route: **1,000/day free, then 10 KRW/call** (static map 2 KRW). Apps that activated before 2026-07-21 keep their existing quotas — [Kakao DevTalk notice 150222](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)
- The Kakao quota page confirms daily quotas: 대중교통 경로 조회 1,000건, 도보 경로 조회 1,000건; pricing 대중교통 경로 조회 10원/건. It also notes "카카오맵 API는 개발자 계정 기준 첫 번째로 활성화한 앱에만 무료 쿼터를 제공" — [Kakao Developers 쿼터](https://developers.kakao.com/docs/latest/ko/getting-started/quota)
- Kakao endpoint `GET https://dapi.kakao.com/v2/routing/publictraffic`, header `Authorization: KakaoAK {REST_API_KEY}`, params `start_x, start_y, end_x, end_y, s_name, e_name, input_coord, output_coord`. The response includes `steps[].path.points` polylines and a `landingURL` to Kakao Map — [Kakao Developers REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api)
- Probe: `dapi.kakao.com/v2/routing/publictraffic` without a key returned 401 and **no** `Access-Control-Allow-Origin` header. Call it through the proxy, which also keeps the REST key secret.
- TMAP transit: `POST https://apis.openapi.sk.com/transit/routes` with header `appKey`; body `startX, startY, endX, endY, count (1–10), lang (0/1), format, searchDttm`. Modes WALK, BUS, SUBWAY, EXPRESSBUS, TRAIN, AIRPLANE, FERRY. Each leg has `passShape.linestring`, `passStopList`, `routeColor` and `service`. A key comes from "SK OPEN API 상품 구매 (앱 키 발급)" — [TMAP 대중교통 API docs](https://transit.tmapmobility.com/docs/routes); [TMAP 이용절차](https://transit.tmapmobility.com/guide/procedure)
- TMAP free tier: one 2023 personal blog says "tmap에서 하루 10건 무료" (old and unofficial; reported via search summary only) — see search results for "SK open API TMAP 대중교통 무료" (blog: [hanawithdata.tistory.com](https://hanawithdata.tistory.com/m/entry/requestspost-%EB%A1%9C-tmap-API-%EC%97%90-%EC%9C%84%EC%B9%98%EC%A0%95%EB%B3%B4-POST%ED%95%B4%EC%84%9C-%EA%B2%B0%EA%B3%BC-%EB%B0%9B%EC%95%84%EC%98%A4%EA%B8%B0))
- (Snippet) Google Routes API supports `travelMode: "TRANSIT"` in general, and `transitFare` is returned only when fares are known for all steps — [Google Routes transit-route](https://developers.google.com/maps/documentation/routes/transit-route?hl=ko). Whether Korea is covered could not be read, because the coverage table is JS-rendered — [Routes API coverage](https://developers.google.com/maps/documentation/routes/coverage)

### Inferences
- A sensible plan for wayfinder:
  - Primary router: Kakao `publictraffic` (1,000/day free, via proxy).
  - ODsay (30/day) only for things Kakao lacks: `loadLane` line-colored polylines (Kakao already returns `path.points`, so this may be unnecessary), `subwayPathSchedule` for 막차/arrive-by, and timetables.
  - Real-time arrivals from the public-data APIs in section 1.
  - Cache aggressively in the proxy.
- Kakao returns stop **names only** (`stops[].name`), not arsID/localStationID. To fetch realtime arrivals for a Kakao route, each boarding stop must be resolved to a public-API stop ID, for example via ODsay `searchStation`. That draws on the same 30/day ODsay quota, so it needs caching or a public-API stop lookup instead. Joining across providers by name or coordinates is a non-trivial integration risk.
- Watch Kakao's terms: the free quota is per developer account (first app only), so separate staging and production apps would make the second one paid.

### Gaps
- **Naver Cloud Maps Directions**: no source was read in this session on whether it offers transit routing.
- **Google Routes TRANSIT in South Korea**: the coverage table could not be read, and no live test was run (it needs a billed key).
- TMAP transit current free quota and price: unverified. The only data point is a 2023 blog.
- Kakao DevTalk threads exist titled "대중교통 경로 조회 API가 외부 REST 호출에서 code -10을 반환합니다" ([150841](https://devtalk.kakao.com/t/api-rest-code-10/150841)) and "카카오맵 API 심사 폐지 공지(150222) 이후에도 활성화가 안 되고 '추가 기능 신청' 안내가 뜹니다" (linked from the [150222 notice](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)). I saw the titles only, and their resolution is unknown. Possible launch-period rough edges for the recommended primary router.
- Kakao transit API coverage (regions) and inter-city support: the separate "지원 범위" page was not read.
- **Which features users value most** (for example survey data on realtime arrival vs 막차 vs congestion): no survey or official usage data found in this research.
