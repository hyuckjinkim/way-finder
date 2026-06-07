/**
 * P4 F4 — Valhalla 골든 픽스처 (라이브 컨테이너 실 캡처).
 *
 * 걷기좋은 프로필 (walkway/sidewalk 가중).
 * 캡처: ghcr.io/valhalla/valhalla:latest + 수도권(서울+경기) bbox 타일.
 * **실 응답** — shape는 encoded polyline precision 6 (A1 정규화기 입력).
 * 타일 재빌드 시 재캡처 필요 (services/valhalla/capture-fixtures.sh).
 */
export const WALKABLE_PROFILE_RAW = {
    "trip": {
      "locations": [
        {
          "type": "break",
          "lat": 37.5663,
          "lon": 126.9779,
          "side_of_street": "right",
          "original_index": 0
        },
        {
          "type": "break",
          "lat": 37.5704,
          "lon": 126.9921,
          "original_index": 1
        }
      ],
      "legs": [
        {
          "maneuvers": [
            {
              "type": 2,
              "instruction": "Walk east on the walkway.",
              "verbal_succinct_transition_instruction": "Walk east.",
              "verbal_pre_transition_instruction": "Walk east on the walkway.",
              "verbal_post_transition_instruction": "Continue for 100 meters.",
              "bearing_after": 89,
              "time": 80.138,
              "length": 0.113,
              "cost": 151.806,
              "begin_shape_index": 0,
              "end_shape_index": 10,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 무교로.",
              "verbal_transition_alert_instruction": "Turn left onto 무교로.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 무교로.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "street_names": [
                "무교로"
              ],
              "bearing_before": 94,
              "bearing_after": 3,
              "time": 129.176,
              "length": 0.183,
              "cost": 134.176,
              "begin_shape_index": 10,
              "end_shape_index": 15,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 다동길.",
              "verbal_transition_alert_instruction": "Turn right onto 다동길.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 다동길.",
              "verbal_post_transition_instruction": "Continue for 300 meters.",
              "street_names": [
                "다동길"
              ],
              "bearing_before": 3,
              "bearing_after": 90,
              "time": 222.235,
              "length": 0.312,
              "cost": 227.235,
              "begin_shape_index": 15,
              "end_shape_index": 22,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 남대문로.",
              "verbal_transition_alert_instruction": "Turn left onto 남대문로.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 남대문로.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "street_names": [
                "남대문로"
              ],
              "bearing_before": 90,
              "bearing_after": 1,
              "time": 135.999,
              "length": 0.187,
              "cost": 156.0,
              "begin_shape_index": 22,
              "end_shape_index": 32,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 종로/6.",
              "verbal_transition_alert_instruction": "Turn right onto 종로.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 종로, 6.",
              "verbal_post_transition_instruction": "Continue for 800 meters.",
              "street_names": [
                "종로",
                "6"
              ],
              "bearing_before": 7,
              "bearing_after": 89,
              "time": 597.792,
              "length": 0.844,
              "cost": 602.792,
              "begin_shape_index": 32,
              "end_shape_index": 53,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 4,
              "instruction": "You have arrived at your destination.",
              "verbal_transition_alert_instruction": "You will arrive at your destination.",
              "verbal_pre_transition_instruction": "You have arrived at your destination.",
              "bearing_before": 85,
              "time": 0.0,
              "length": 0.0,
              "cost": 0.0,
              "begin_shape_index": 53,
              "end_shape_index": 53,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            }
          ],
          "summary": {
            "has_time_restrictions": false,
            "has_toll": false,
            "has_highway": false,
            "has_ferry": false,
            "min_lat": 37.566246,
            "min_lon": 126.977896,
            "max_lat": 37.5704,
            "max_lon": 126.992099,
            "time": 1165.343,
            "length": 1.639,
            "cost": 1272.011
          },
          "shape": "i|zsfAoubeqFOyV~AsGd@mB\\eBLsAb@yD`BuNZuCJy@LeGkFKm`@_BeECo`@w@uTm@Ceb@rJis@aKwi@yDij@Io@s@gHDc^_d@Qq@CaBeBuBMs@EiNQeCOyFg@uSaBgGi@kN_IoF}DyCkGiBuBKkh@E_BZ_Yt@ipAiAoQQit@H{\\CmOOwKBwSOyVkAwx@[yO{DgfAk@aRmAsn@S}G"
        }
      ],
      "summary": {
        "has_time_restrictions": false,
        "has_toll": false,
        "has_highway": false,
        "has_ferry": false,
        "min_lat": 37.566246,
        "min_lon": 126.977896,
        "max_lat": 37.5704,
        "max_lon": 126.992099,
        "time": 1165.343,
        "length": 1.639,
        "cost": 1272.011
      },
      "status_message": "Found route between points",
      "status": 0,
      "units": "kilometers",
      "language": "en-US"
    }
  } as const;
