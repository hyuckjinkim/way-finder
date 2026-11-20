# 장소(POI) 기능과 무료 API로 구현 가능한지

조사일: 2026-11-20. 출처 유형 태그: **[공식문서]**, **[devtalk 직원답변]**, **[언론]**, **[2차/블로그]**. Inferences는 인용된 사실에서만 끌어낸 추론이다. 이번 세션에서 직접 확인하지 못하고 기억에 기댄 내용은 모두 Gaps에 "미검증"으로 넣었다.

## Q1. 장소 상세 데이터(영업시간·영업중, 전화, 메뉴, 사진, 리뷰/평점)를 어떤 무료 API로 얻을 수 있나, 약관 제약은 무엇인가

### Takeaway
Kakao Local과 Naver 지역검색에는 영업시간·메뉴·사진·리뷰를 주는 필드가 없다. Kakao는 `phone`만 주고, Naver는 `telephone` 필드를 더 이상 채우지 않는다. 영업시간·평점·전화를 API로 얻을 현실적인 경로는 Google Places (New)뿐이다. 다만 해당 필드는 Enterprise SKU라 무료가 월 1,000건이고, 리뷰는 Enterprise+Atmosphere(월 1,000건), 사진 이미지는 Photos SKU(월 1,000건)라 무료 범위가 매우 좁다. Kakao는 Local API 결과를 저장하는 것을 금지하고, Google은 place_id만 무기한 저장을 허용한다.

### Cited Findings
**Kakao Local REST API [공식문서]**
- 엔드포인트는 6개뿐이다: `search/address`, `geo/coord2regioncode`, `geo/coord2address`, `geo/transcoord`, `search/keyword`, `search/category`. 공식 목록에 장소 상세나 자동완성 엔드포인트는 없다. 상세 정보는 각 결과의 `place_url`(카카오맵 상세 페이지 링크)로만 연결된다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- 장소 document 필드는 `id, place_name, category_name, category_group_code, category_group_name, phone, address_name, road_address_name, x, y, place_url, distance`이다. 영업시간·메뉴·사진·평점 필드는 없다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- 기본 쿼터(앱 단위)는 다음과 같다. 키워드·카테고리·주소 검색 각각 일 100,000건, 지도 JS SDK 일 300,000건, 카카오톡 공유 일 30,000건이고, 전체 API 합산 월 무료 3,000,000건이다. 무료 쿼터는 개발자 계정에서 처음 활성화한 앱에만 적용된다. 초과분은 키워드·카테고리 검색 건당 2원, 주소 검색 건당 0.5원, 지도 JS 건당 0.1원이다. — [Kakao 쿼터 안내](https://developers.kakao.com/docs/ko/getting-started/quota)
- "로컬 API 등을 호출하여 응답받은 결과 데이터를 별도로 저장하여 사용하는 것은 허용하지 않습니다." 실시간 호출로만 쓸 수 있다. 2024-12-01부터 신규 사용자는 카카오맵 API 사용 권한을 따로 활성화해야 한다. — [Kakao devtalk FAQ](https://devtalk.kakao.com/t/faq-api/125610) [devtalk 공지/FAQ]

**Naver 지역검색 [공식문서, NAVER API HUB 버전]**
- 참고: `developers.naver.com` 문서는 이 환경에서 가져오지 못했다(fetch 차단). 아래는 모두 NAVER API HUB(Naver Cloud) 문서 기준이며, 엔드포인트와 인증 헤더가 기존 `openapi.naver.com`과 다르다.
- 엔드포인트는 `GET https://naverapihub.apigw.ntruss.com/search/v1/local`, 인증 헤더는 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`이다. `display`는 1~5(기본 1)이고 `start`는 `1`만 명시돼 있다. 즉 페이지를 넘길 수 없어 최대 5건이다. `sort`는 `random`(정확도순) 또는 `comment`(블로그·카페 리뷰 수순)이다. — [NAVER API HUB 지역검색](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)
- 응답 필드는 `title, link, category, description, telephone, address(지번), roadAddress, mapx, mapy`(WGS84, 문자열)이다. **`telephone`은 "반환되지 않음, 하위호환용으로 유지"**된다. 문서 수정일은 2026-09-17이다. — [NAVER API HUB 지역검색](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)
- 검색 API 한도는 일 25,000건이다. — [NAVER API HUB 지역검색](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)
- API HUB는 종량제이지만 "한시적으로 무료로 제공되며, 유료 전환 시 사전에 별도 공지"한다고 한다. 월 한도는 네이버 검색 전 카테고리 합산 775,000건, 키당 초당 50건이다. 무료 기간에는 한도를 늘릴 수 없다. Developers Center에서 옮겨 오는 마이그레이션 가이드가 있다. 단, 이 페이지 메타데이터에 `stale: true`가 붙어 있다. — [NAVER API HUB 개요](https://guide.ncloud-docs.com/docs/apihub-overview)

**Google Places API (New) [공식문서, 2026-11-20 fetch 기준, 페이지에 시행일 표기 없음]**
- 필드별 SKU는 다음과 같다. `regularOpeningHours`, `currentOpeningHours`, `nationalPhoneNumber`, `rating`, `userRatingCount`, `priceLevel`, `websiteUri`는 **Enterprise**. `reviews`, `reviewSummary`, `generativeSummary`는 **Enterprise + Atmosphere**. `displayName`, `businessStatus`는 Pro. `photos`(참조 ID)는 Essentials (IDs Only)이다. — [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- 월 무료 사용량과 첫 구간 단가(1,000건당)는 아래와 같다. — [GMP Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
  - Place Details: Essentials 10,000 / $5, Pro 5,000 / $17, Enterprise 1,000 / $20, Enterprise+Atmosphere 1,000 / $25
  - Text Search·Nearby Search: Pro 5,000 / $32, Enterprise 1,000 / $35, Enterprise+Atmosphere 1,000 / $40
  - Place Photos 1,000 / $7, Autocomplete Requests 10,000 / $2.83
  - 무제한 무료: Place Details Essentials (IDs Only), Text Search Essentials (IDs Only), Autocomplete Session Usage
- 캐싱 규칙: place_id는 무기한 저장할 수 있다. 위경도는 최대 30일 연속 캐시한 뒤 삭제해야 한다. 그 밖의 콘텐츠는 서비스별 약관이 허용하는 범위에서만 캐시할 수 있고, 업체명·주소·사용자 리뷰를 복사하는 것은 금지된다. — [Places Policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- 표기(attribution) 규칙 — [Places Policies](https://developers.google.com/maps/documentation/places/web-service/policies)
  - Google 지도 위가 아닌 곳에 표시하면 "Google Maps" 로고 또는 텍스트를 붙여야 한다. 신규 구현은 "Google"이 아니라 "Google Maps"로 표기한다.
  - Places 콘텐츠는 다른 콘텐츠와 시각적으로 분리해야 한다.
  - 리뷰와 사진에는 작성자 아바타·이름·프로필 링크를 단다. 리뷰는 최소한 아바타가 필요하다.
  - `googleMapsUri`로 원본 링크를 제공한다.
  - AI 요약은 `disclosureText`를 그대로 표시한다.

**공공데이터 [공식 포털, 검색 스니펫 수준]**
- 행정안전부 '건강_약국 조회서비스'는 인허가일자·영업상태·사업장명·소재지주소를 제공한다. 영업시간은 설명에 없다. — [data.go.kr 15154822](https://data.go.kr/catalog/15154822/openapi.json)
- 서울 중구 공공심야약국 파일데이터(CSV)에는 운영요일·운영시간 열이 있다. 지역 한정이다. — [data.go.kr 15155784](https://www.data.go.kr/data/15155784/fileData.do?format=md)
- 굿닥은 "진료시간은 공공데이터를 기반으로 제공되어 실제와 다를 수 있습니다"라고 안내한다. 공공 영업시간 데이터는 신고 기준이라 부정확할 수 있다는 뜻이다. — [goodoc](https://www.goodoc.co.kr/hospitals/18821) [2차]

### Inferences
- "영업중" 배지, 영업시간, 평점을 붙이려면 Google Place Details Enterprise가 필요하다. 월 1,000건 무료이고 이후 1,000건당 $20이다. 지금 앱의 lazy Google 탭(사용자가 탭할 때만 호출)은 이 무료 한도에 맞는 올바른 설계다. 검색 결과 리스트마다 영업중 여부를 붙이면 결과 15건 × 검색 횟수로 무료분이 금방 소진된다.
- Google 비용을 줄이려면 field mask를 Enterprise 필드(hours, rating, phone)로만 제한하고 `reviews`는 빼야 한다. reviews를 넣으면 Enterprise+Atmosphere($25)가 된다. 사진은 `photos` 필드 자체는 IDs Only지만 이미지 요청이 별도 Photos SKU(월 1,000건)라, 썸네일 1장만 보여 줘도 상세 열람 1회당 Photos 1건이 추가로 든다.
- 전화번호는 Kakao `phone` 필드로 무료로 충분하다. Naver는 `telephone`을 주지 않으므로 전화번호 출처가 될 수 없다.
- Naver 지역검색은 5건 제한에 페이지 이동도 없어서 주 검색엔진으로는 맞지 않는다. 보조 용도(블로그 리뷰 수 기준 `sort=comment` 등)에 그쳐야 한다. 이미 쓰고 있는 Naver 블로그 스니펫 호출과 같은 검색 API 한도(일 25,000 / 월 775,000)를 나눠 쓰게 된다.
- 메뉴 정보는 세 API 어디에도 필드가 없다. 남는 방법은 `place_url`(카카오맵)이나 Naver `link`로 외부 상세 페이지에 딥링크하는 것뿐이다.

### Gaps
- 기존 `openapi.naver.com/v1/search/local.json` 엔드포인트와 NAVER API HUB의 관계(병행 운영인지, 종료 일정이 있는지)는 확인하지 못했다. developers.naver.com fetch가 차단됐고, API HUB 개요 페이지는 `stale: true` 표시가 있다. 기존 API에서도 `telephone`이 비어 있는지 역시 미확인이다.
- 국립중앙의료원(B552657) 약국·병원 정보 API가 요일별 영업시간 필드(`dutyTime*`)를 주는지 미검증이다. 검색 요약기가 "그렇다"고 했지만 원 명세로는 확인하지 못했다. 전국 단위로 영업시간을 주는 공공 API가 있는지는 열린 질문이다.
- Google Places 콘텐츠를 비(非)Google 지도(카카오맵) 위나 옆에 표시해도 되는지에 대해 Places Policies 페이지는 명시하지 않는다. 금지 문구도 없고 허용 문구도 없다. GMP 서비스 약관 원문은 확인하지 못했다.
- 한국 내 Google Places 데이터의 커버리지와 정확도(영업시간·평점이 채워진 비율)는 근거를 찾지 못했다.
- Google 가격표 페이지에 시행일이 없다. 2025년 3월 SKU 개편 이후 가격으로 보이지만 시행일은 미검증이다.

## Q2. 카테고리 칩(카페·편의점·음식점·주차장·주유소·병원·약국…)과 지도 범위 검색("이 지역 재검색")

### Takeaway
Kakao `search/category`는 공식 그룹코드 18개를 지원한다. `x,y,radius`(최대 20km)나 `rect`로 범위를 정할 수 있어서, 카테고리 칩과 "이 지역 재검색"을 무료 쿼터 안에서 모두 구현할 수 있다. 한 쿼리당 최대 45건이라는 상한이 핵심 제약이다.

### Cited Findings
- 카테고리 그룹코드 전체(18개): MT1 대형마트, CS2 편의점, PS3 어린이집·유치원, SC4 학교, AC5 학원, PK6 주차장, OL7 주유소·충전소, SW8 지하철역, BK9 은행, CT1 문화시설, AG2 중개업소, PO3 공공기관, AT4 관광명소, AD5 숙박, FD6 음식점, CE7 카페, HP8 병원, PM9 약국. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide) [공식문서]
- category search 파라미터: `category_group_code`(필수), `x`, `y`, `radius`(0~20,000m), `rect`(좌하단X,좌하단Y,우상단X,우상단Y), `page` 1~45, `size` 1~15(기본 15), `sort` accuracy|distance. distance 정렬과 `distance` 응답값은 x,y를 줘야 나온다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- meta의 `pageable_count`는 최대 45이고, `is_end`로 마지막 페이지인지 표시한다. 키워드 검색은 `same_name`(region, keyword, selected_region)을 함께 준다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- 지도 JS SDK의 Map 이벤트 목록에 `idle`, `bounds_changed`가 있다. `services.Places`에는 `keywordSearch`, `categorySearch`, `setMap`과 `Pagination`(nextPage, gotoPage 등)이 있다. — [Kakao Maps Web API 문서 인덱스](https://apis.map.kakao.com/web/documentation/) [공식문서, 인덱스 수준]

### Inferences
- `page`는 1~45까지 받지만 `pageable_count`가 45에서 잘리므로, size=15 기준으로 실제로는 3페이지(45건)가 상한이다. 이것은 두 사실을 합친 추론이다. 결과가 45건을 넘는 지역에서는 "더 확대해서 재검색"하라고 안내하거나, 지도 영역을 쪼개서 여러 번 호출해야 전체를 얻을 수 있다(호출 수가 늘어난다).
- "이 지역 재검색"은 Map `idle` 이벤트에서 `map.getBounds()`를 받아 `rect` 파라미터로 category/keyword 검색을 다시 하는 식으로 구현할 수 있다. 버튼은 사용자가 지도를 움직인 뒤에만 띄우고, 자동 재검색은 하지 않는 편이 쿼터를 아끼는 방법이다.
- 칩 후보 중 사용자가 보는 지도 앱의 주류 칩(카페, 편의점, 음식점, 주차장, 주유소·충전소, 병원, 약국, 은행, 숙박, 지하철역)은 모두 그룹코드 하나에 그대로 대응한다. 그룹코드에 없는 세분류(예: 화장실, ATM, 전기차충전소만 따로)는 keyword 검색으로 대체해야 한다.
- 카테고리 검색 결과에는 영업중 정보가 없으므로, Naver/Kakao 앱의 "영업중" 필터 칩은 무료로 재현할 수 없다(Q1 참고).

### Gaps
- `services.Places`의 `useMapBounds` 옵션이 있는지와 그 의미는 미검증이다(fetch에서 언급되지 않음). REST `rect`로 대체할 수 있으므로 구현을 막지는 않는다.
- Naver지도·카카오맵 앱이 칩과 "이 지역 재검색"을 실제로 어떻게 보여 주는지(위치, 자동 여부, 영업중 필터)에 대한 공식·언론 자료는 찾지 못했다.

## Q3. 즐겨찾기·저장 목록·공유·최근 본 장소 — 사용자 기대치와 계정 유무에 따른 구현 옵션

### Takeaway
Naver지도는 2022년 첫 화면에 '저장' 탭을 만들고 최대 5,000곳 저장과 리스트 공유(받은 사람에게 실시간 업데이트)를 넣었다. 저장과 공유가 핵심 기대 기능이라는 방증이다. 카카오톡 공유 JS SDK는 '위치' 기본 템플릿을 제공하고 일 30,000건이 무료다. 무계정 저장(localStorage)은 기술적으로 쉽다. 다만 Kakao의 "결과 데이터 별도 저장 금지" 조항에 해당하는지가 미해결 리스크다.

### Cited Findings
- 2022-12-13: 네이버가 지도 첫 화면에 '저장 탭'을 신설했다. 저장 가능한 장소 수를 2,000곳에서 5,000곳으로 늘렸고, 공유 버튼으로 리스트를 보내면 받은 친구가 장소정보와 이후 업데이트를 실시간으로 볼 수 있다. 친구와 리스트를 함께 관리하는 기능은 "예정"이었다. — [세계일보 2022-12-13](https://www.segye.com/newsView/20221213515529) [언론, **2022년 자료**]
- 카카오톡 공유 JS SDK 메서드: `sendDefault`, `sendCustom`, `sendScrap`, `createDefaultButton`/`createCustomButton`/`createScrapButton`. 기본 템플릿은 피드·리스트·**위치**·커머스·텍스트이다. 요구사항은 JavaScript 키, JS SDK 도메인 등록, 제품 링크(웹 도메인) 등록이다. SDK 1.43.0부터 모듈명이 `Kakao.Share`로 바뀌었다. — [카카오톡 공유 JS 가이드](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link) [공식문서]
- 카카오톡 공유 쿼터는 일 30,000건이다. 초과분은 건당 50원이며, 2026-02-02~2027-12-31에는 건당 10원(80% 할인)이다. — [Kakao 쿼터 안내](https://developers.kakao.com/docs/ko/getting-started/quota)
- Kakao Local 결과 데이터를 별도로 저장해 쓰는 것은 금지다. — [Kakao devtalk FAQ](https://devtalk.kakao.com/t/faq-api/125610)
- Google은 place_id를 무기한 저장할 수 있고, 상세는 사용자가 상호작용할 때 다시 조회하라고 권장한다. — [Places Policies](https://developers.google.com/maps/documentation/places/web-service/policies)

### Inferences
- 공유 가이드에 로그인 요구사항이 나오지 않으므로, 카카오톡 공유는 Kakao Login 없이 쓸 수 있는 것으로 보인다. 앱 링크(`?place=<kakao id>` 등)를 담은 '위치' 또는 '피드' 템플릿 하나로 충분하다.
- 약관 리스크를 가장 낮추는 즐겨찾기·최근 본 장소 설계는 Google 정책 모델을 따르는 것이다. Kakao 장소 `id`(와 사용자가 붙인 메모)만 저장하고, 열 때 실시간 재조회한다. 다만 Kakao Local에는 id로 조회하는 API가 없어서(Q1 엔드포인트 목록), id만으로는 재조회가 불가능하다. 실무적으로는 이름과 좌표를 최소한으로 저장해야 하고, 이것이 Kakao "저장 금지" 조항과 부딪칠 수 있다.
- Naver 사례(5,000곳, 리스트 공유)를 보면 사용자는 여러 개의 이름 붙은 리스트와 링크 공유를 기대한다. 무계정이면 리스트 URL 인코딩(링크에 id 목록 포함)이나 JSON 내보내기로 기기 간 이동을 대체할 수 있다.

### Gaps
- 사용자 브라우저 localStorage에 즐겨찾기를 두는 것이 Kakao의 "결과 데이터 별도 저장" 금지에 해당하는지 공식 답변을 찾지 못했다. 앱 출시 전 devtalk 문의가 필요하다. **리스크 플래그**.
- Web Share API(`navigator.share`) 지원 범위, Kakao Login 연동 비용과 절차는 이번 세션에서 미검증이다.
- "최근 본 장소", "저장 목록"이 사용자에게 얼마나 중요한지 정량 근거(설문, 사용 통계)는 찾지 못했다. 2022년 Naver 보도 1건뿐이다. **이 문서로 기능 중요도 순위를 매길 근거는 부족하다.**
- Naver 리스트 공동 관리 기능이 실제로 출시됐는지, 2026년 현재 저장 개수 한도는 얼마인지 미확인이다.

## Q4. 검색 품질 추가 기능 — 초성 검색, 오타 교정, 자동완성, 주소/지번/도로명/우편번호, 좌표 검색

### Takeaway
Kakao Local에는 자동완성 API가 없다(공식 엔드포인트 목록에 없음). 주소 검색은 지번과 도로명을 모두 지원하고 응답에 5자리 우편번호(`zone_no`)를 준다. 초성 검색과 오타 교정은 세 API 모두 문서상 근거가 없으므로, 필요하면 클라이언트 쪽(최근 검색어·즐겨찾기 대상)에서 직접 구현해야 한다. 자동완성이 꼭 필요하면 Google Autocomplete(월 10,000건 무료, 세션 사용량 무제한 무료)가 유일한 공식 옵션이다.

### Cited Findings
- Kakao 주소 검색 `search/address`: `analyze_type`은 similar(기본) 또는 exact이고, `size` 1~30, `page` 1~45이다. 응답 `address_type`은 REGION / ROAD / REGION_ADDR / ROAD_ADDR이며, `address`(지번)와 `road_address`(도로명) 객체를 함께 준다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- `road_address.zone_no`는 5자리 우편번호다. `address.zip_code`(6자리)는 deprecated이다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- 좌표→주소 `coord2address`의 `total_count`는 0 또는 1이며, "도로명 주소는 좌표에 따라 반환되지 않을 수 있습니다." 좌표→행정구역 `coord2regioncode`는 H(행정동)와 B(법정동)를 준다. `transcoord`는 WGS84, WCONGNAMUL, CONGNAMUL, WTM, TM, KTM, UTM 등을 지원한다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide)
- 공식 Local 엔드포인트 6개 중 자동완성은 없다. JS SDK `services.Places`에도 keywordSearch, categorySearch 외에 자동완성이나 상세 메서드는 없다. — [Kakao Local dev guide](http://developers.kakao.com/docs/ko/local/dev-guide); [Kakao Maps Web 문서 인덱스](https://apis.map.kakao.com/web/documentation/)
- Google Autocomplete Requests는 월 10,000건 무료, 이후 1,000건당 $2.83이다. Autocomplete Session Usage는 무제한 무료다. — [GMP Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- Google Autocomplete 정책: 사용자가 선택한 주소는 해당 거래에 한해 콘텐츠 제한에서 면제된다. 제안 목록은 면제되지 않는다. — [Places Policies](https://developers.google.com/maps/documentation/places/web-service/policies)

### Inferences
- "자동완성"은 Kakao 키워드 검색을 입력 디바운스(예: 300ms)와 함께 불러 흉내 낼 수 있다. 입력할 때마다 키워드 검색 1건이 들어가므로 일 100,000건 쿼터를 기준으로 사용자 수를 가늠해야 한다.
- 좌표 검색("37.5,127.0" 입력)은 API 없이 클라이언트 정규식으로 파싱한 뒤 `coord2address`로 주소를 붙이면 된다. 일 100,000건 무료 범위다.
- 우편번호로 검색하는 것(우편번호 → 위치)은 공식 문서에 근거가 없다. `zone_no`는 응답 필드이지 검색 키가 아니다. 따라서 "우편번호 검색"은 우편번호를 보여 주는 것까지만 확실하다.
- 초성 검색(ㅅㄷㅂ → 스타벅스)은 서버 API로는 불가능하다고 보는 것이 안전하다. 최근 검색어, 즐겨찾기, 역 이름 같은 로컬 목록에만 클라이언트 초성 매칭을 적용하는 것이 현실적인 범위다.

### Gaps
- Kakao `analyze_type=similar`나 키워드 검색이 오타를 얼마나 교정하는지, 초성 질의를 처리하는지에 대한 공식 문서는 찾지 못했다. 실제 호출 테스트가 필요하다.
- 우편번호를 쿼리로 넣었을 때 Kakao 주소 검색이 결과를 주는지 미검증이다.
- Google Autocomplete의 한국 주소·POI 품질은 근거를 찾지 못했다.

## Q5. 다수 결과용 마커 클러스터링, 베이스맵 POI 클릭

### Takeaway
Kakao 지도 JS SDK의 `clusterer` 라이브러리(`MarkerClusterer`)로 클러스터링을 바로 구현할 수 있다. 다만 결과가 최대 45건/쿼리라 검색 결과만 놓고 보면 클러스터링이 꼭 필요하지는 않을 수 있다. 베이스맵에 내장된 POI 아이콘을 클릭했을 때 장소 정보를 받는 이벤트는 공식 Map 이벤트 목록에 없다.

### Cited Findings
- MarkerClusterer는 gridSize, minClusterSize, averageCenter, minLevel, texts, calculator, styles 접근자를 갖고, 이벤트는 clusterclick, clusterover, clusterout, clusterdblclick, clusterrightclick, clustered이다. — [Kakao Maps Web 문서 인덱스](https://apis.map.kakao.com/web/documentation/) [공식문서, 인덱스 수준]
- Map 이벤트에는 click, dblclick, rightclick, mousemove, idle, bounds_changed 등이 있다. **베이스맵 POI 전용 클릭 이벤트는 목록에 없다.** Marker에는 setClickable/getClickable이 있다. — [Kakao Maps Web 문서 인덱스](https://apis.map.kakao.com/web/documentation/)
- devtalk의 POI 클릭 관련 공식 답변은 **Android SDK v2의 커스텀 POI(라벨)** 클릭 이슈에 대한 것이다(2024-07-31 질문, 2024-08-01 직원 답변: "API 문제, 신규 배포 예정, 2.11.9로 테스트, LabelClickListener 사용"). 웹 JS 베이스맵 POI와는 관계없다. — [devtalk 138725](https://devtalk.kakao.com/t/poi/138725) [devtalk 직원답변]

### Inferences
- 웹 JS에서는 베이스맵 POI 클릭으로 장소 정보를 받을 수 없을 가능성이 높다. 공식 이벤트 목록에 없다는 데서 나온 추론이다. 대안은 Map `click`의 좌표로 `coord2address`(주소)를 조회하거나, 해당 좌표 근처를 작은 `radius`로 키워드·카테고리 검색해 가장 가까운 장소를 후보로 보여 주는 것이다. 두 방법 모두 무료 쿼터 안이다.
- 카테고리 검색 45건, 키워드 검색 45건 정도면 마커 겹침은 확대 레벨이 낮을 때만 문제가 된다. 클러스터러는 "이 지역 재검색"을 여러 번 해서 결과를 누적하거나, 저장 목록 전체를 지도에 표시할 때 넣으면 된다.

### Gaps
- MarkerClusterer 생성자 옵션의 기본값과 동작 의미는 확인하지 못했다. fetch 결과가 인덱스만 반환했다.
- 웹 JS SDK에서 베이스맵 POI 클릭이 정말 불가능한지 devtalk 공식 답변을 찾지 못했다. 위 결론은 문서에 없다는 사실에 기댄 추론이다.
- Naver지도·카카오맵·Google지도 앱에서 베이스맵 POI를 탭했을 때의 UX(바로 상세 시트가 열리는지)를 비교한 자료는 찾지 못했다.
