/**
 * 카카오 대중교통(dapi.kakao.com/v2/routing/publictraffic) 실 응답 픽스처 — 2026-11-20 실측
 * (구로디지털단지 → 강남, 상위 4개 경로만, path.points·stops는 앞2+끝1로 축약).
 * WALKING step은 환승 도보만 존재(출발·도착 도보는 응답에 없음).
 */
import type { KakaoTransitResponse } from '../normalize/kakaoTransit.js';
import { KakaoTransitQuota } from '../quota/transitQuota.js';

export const KAKAO_TRANSIT_RAW: KakaoTransitResponse = {
  "status": "OK",
  "properties": {
    "total": 15,
    "bus": 6,
    "subway": 3,
    "busAndSubway": 6,
    "landingURL": "https://map.kakao.com/link/by/traffic/%EC%B6%9C%EB%B0%9C,37.485200,126.901400/%EB%8F%84%EC%B0%A9,37.497900,127.027600"
  },
  "routes": [
    {
      "properties": {
        "type": "SUBWAY",
        "totalDistance": 13489,
        "totalTime": 2083,
        "transfers": 0,
        "fare": {
          "value": 1650
        }
      },
      "steps": [
        {
          "properties": {
            "guidance": "2호선 (구로디지털단지 > 강남)",
            "type": "SUBWAY",
            "distance": 12900,
            "time": 1350,
            "stops": [
              {
                "name": "구로디지털단지"
              },
              {
                "name": "신대방"
              },
              {
                "name": "강남"
              }
            ],
            "vehicles": [
              {
                "name": "2호선",
                "type": "일반"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.90147308,
                37.48526069
              ],
              [
                126.9017327,
                37.48518742
              ],
              [
                127.02800028,
                37.49808544
              ]
            ]
          }
        }
      ]
    },
    {
      "properties": {
        "type": "SUBWAY",
        "totalDistance": 17252,
        "totalTime": 3219,
        "transfers": 1,
        "fare": {
          "value": 2350
        }
      },
      "steps": [
        {
          "properties": {
            "guidance": "7호선 (대림(구로구청) > 논현)",
            "type": "SUBWAY",
            "distance": 14100,
            "time": 1540,
            "stops": [
              {
                "name": "대림(구로구청)"
              },
              {
                "name": "신풍"
              },
              {
                "name": "논현"
              }
            ],
            "vehicles": [
              {
                "name": "7호선",
                "type": "일반"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.89672282,
                37.49284311
              ],
              [
                126.89684392,
                37.4929198
              ],
              [
                127.02165318,
                37.51120175
              ]
            ]
          }
        },
        {
          "properties": {
            "guidance": "논현논현역 환승",
            "type": "WALKING",
            "distance": 100,
            "time": 121,
            "stops": [
              {
                "name": "논현"
              },
              {
                "name": "논현"
              }
            ]
          },
          "path": {
            "points": [
              [
                127.02164753,
                37.51119809
              ],
              [
                127.02160794,
                37.51118571
              ],
              [
                127.0216777,
                37.51041421
              ]
            ]
          }
        },
        {
          "properties": {
            "guidance": "신분당선 (논현 > 강남)",
            "type": "SUBWAY",
            "distance": 1700,
            "time": 210,
            "stops": [
              {
                "name": "논현"
              },
              {
                "name": "신논현"
              },
              {
                "name": "강남"
              }
            ],
            "vehicles": [
              {
                "name": "신분당선",
                "type": "일반"
              }
            ]
          },
          "path": {
            "points": [
              [
                127.02167893,
                37.5104128
              ],
              [
                127.02200603,
                37.50971728
              ],
              [
                127.02818532,
                37.49677724
              ]
            ]
          }
        }
      ]
    },
    {
      "properties": {
        "type": "BUS_AND_SUBWAY",
        "totalDistance": 14946,
        "totalTime": 3557,
        "transfers": 1,
        "fare": {
          "value": 1650
        }
      },
      "steps": [
        {
          "properties": {
            "guidance": "지선 5531외 1대 (구로디지털단지역(중) > 노량진수산시장.CTS기독교TV)",
            "type": "BUS",
            "distance": 5304,
            "time": 1297,
            "stops": [
              {
                "name": "구로디지털단지역(중)"
              },
              {
                "name": "동작상떼빌아파트(중)"
              },
              {
                "name": "노량진수산시장.CTS기독교TV"
              }
            ],
            "vehicles": [
              {
                "name": "5531",
                "type": "지선"
              },
              {
                "name": "150",
                "type": "간선"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.90256937,
                37.48412126
              ],
              [
                126.90258457,
                37.48411339
              ],
              [
                126.93840322,
                37.51339372
              ]
            ]
          }
        },
        {
          "properties": {
            "guidance": "노량진노량진역까지 도보로 이동 (6번 출구)",
            "type": "WALKING",
            "distance": 244,
            "time": 312,
            "stops": [
              {
                "name": "노량진수산시장.CTS기독교TV"
              },
              {
                "name": "노량진"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.9384004,
                37.51338809
              ],
              [
                126.93866513,
                37.51340174
              ],
              [
                126.94088866,
                37.51358561
              ]
            ]
          }
        },
        {
          "properties": {
            "guidance": "9호선 (노량진 > 신논현)",
            "type": "SUBWAY",
            "distance": 8100,
            "time": 640,
            "stops": [
              {
                "name": "노량진"
              },
              {
                "name": "동작(현충원)"
              },
              {
                "name": "신논현"
              }
            ],
            "vehicles": [
              {
                "name": "9호선",
                "type": "급행"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.94089325,
                37.51358562
              ],
              [
                126.94198701,
                37.51365317
              ],
              [
                127.02549204,
                37.50481117
              ]
            ]
          }
        }
      ]
    },
    {
      "properties": {
        "type": "BUS",
        "totalDistance": 15808,
        "totalTime": 4345,
        "transfers": 1,
        "fare": {
          "value": 1700
        }
      },
      "steps": [
        {
          "properties": {
            "guidance": "지선 5531외 1대 (구로디지털단지역(중) > 노량진역)",
            "type": "BUS",
            "distance": 5794,
            "time": 1410,
            "stops": [
              {
                "name": "구로디지털단지역(중)"
              },
              {
                "name": "동작상떼빌아파트(중)"
              },
              {
                "name": "노량진역"
              }
            ],
            "vehicles": [
              {
                "name": "5531",
                "type": "지선"
              },
              {
                "name": "150",
                "type": "간선"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.90256937,
                37.48412126
              ],
              [
                126.90258457,
                37.48411339
              ],
              [
                126.94380961,
                37.51373486
              ]
            ]
          }
        },
        {
          "properties": {
            "guidance": "간선 640 (노량진역 > 강남역9번출구)",
            "type": "BUS",
            "distance": 9459,
            "time": 2332,
            "stops": [
              {
                "name": "노량진역"
              },
              {
                "name": "노들역"
              },
              {
                "name": "강남역9번출구"
              }
            ],
            "vehicles": [
              {
                "name": "640",
                "type": "간선"
              }
            ]
          },
          "path": {
            "points": [
              [
                126.94380961,
                37.51373486
              ],
              [
                126.94381336,
                37.51368165
              ],
              [
                127.02657369,
                37.49779209
              ]
            ]
          }
        }
      ]
    }
  ]
};

export const KAKAO_TRANSIT_NO_RESULTS: KakaoTransitResponse = { status: 'NO_RESULTS', properties: { total: 0, bus: 0, subway: 0, busAndSubway: 0 }, routes: [] };

/** 테스트용 카운터 바인딩 — 실제 KakaoTransitQuota 클래스를 Map 저장소로 돌린다. */
export function fakeQuotaNamespace(storage = new Map<string, unknown>(), now?: () => number): DurableObjectNamespace {
  const obj = new KakaoTransitQuota(
    {
      storage: {
        get: async (k: string) => storage.get(k),
        put: async (k: string, v: unknown) => void storage.set(k, v),
      },
    } as unknown as DurableObjectState,
    {},
    now,
  );
  return {
    idFromName: () => ({}),
    get: () => ({ fetch: (url: string, init?: RequestInit) => obj.fetch(new Request(url, init)) }),
  } as unknown as DurableObjectNamespace;
}
