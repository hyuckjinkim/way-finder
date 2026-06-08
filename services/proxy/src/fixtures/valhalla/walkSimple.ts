/**
 * P4 F4 — Valhalla 골든 픽스처 (라이브 컨테이너 실 캡처).
 *
 * 도보 단순 (시청→종로, 단일 leg). preference 미지정/fastest.
 * 캡처: ghcr.io/valhalla/valhalla:latest + 수도권(서울+경기) bbox 타일.
 * **실 응답** — shape는 encoded polyline precision 6 (A1 정규화기 입력).
 * 타일 재빌드 시 재캡처 필요 (services/valhalla/capture-fixtures.sh).
 */
export const WALK_SIMPLE_RAW = {
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
              "cost": 80.138,
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
              "verbal_post_transition_instruction": "Continue for 70 meters.",
              "street_names": [
                "무교로"
              ],
              "bearing_before": 94,
              "bearing_after": 3,
              "time": 51.529,
              "length": 0.073,
              "cost": 56.529,
              "begin_shape_index": 10,
              "end_shape_index": 12,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 남대문로9길.",
              "verbal_transition_alert_instruction": "Turn right onto 남대문로9길.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 남대문로9길.",
              "verbal_post_transition_instruction": "Continue for 50 meters.",
              "street_names": [
                "남대문로9길"
              ],
              "bearing_before": 4,
              "bearing_after": 93,
              "time": 36.705,
              "length": 0.052,
              "cost": 41.705,
              "begin_shape_index": 12,
              "end_shape_index": 13,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 을지로1길.",
              "verbal_transition_alert_instruction": "Turn left onto 을지로1길.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 을지로1길.",
              "verbal_post_transition_instruction": "Continue for 50 meters.",
              "street_names": [
                "을지로1길"
              ],
              "bearing_before": 93,
              "bearing_after": 1,
              "time": 36.705,
              "length": 0.052,
              "cost": 41.705,
              "begin_shape_index": 13,
              "end_shape_index": 14,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right.",
              "verbal_transition_alert_instruction": "Turn right.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right.",
              "verbal_post_transition_instruction": "Continue for 60 meters.",
              "bearing_before": 1,
              "bearing_after": 91,
              "time": 43.058,
              "length": 0.061,
              "cost": 48.058,
              "begin_shape_index": 14,
              "end_shape_index": 16,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 8,
              "instruction": "Continue on the walkway.",
              "verbal_transition_alert_instruction": "Continue on the walkway.",
              "verbal_pre_transition_instruction": "Continue on the walkway. Then Turn left onto 다동길.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "bearing_before": 93,
              "bearing_after": 98,
              "time": 6.352,
              "length": 0.009,
              "cost": 6.352,
              "begin_shape_index": 16,
              "end_shape_index": 17,
              "rough": true,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 다동길.",
              "verbal_transition_alert_instruction": "Turn left onto 다동길.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 다동길.",
              "verbal_post_transition_instruction": "Continue for 40 meters.",
              "street_names": [
                "다동길"
              ],
              "bearing_before": 98,
              "bearing_after": 8,
              "time": 30.352,
              "length": 0.043,
              "cost": 35.352,
              "begin_shape_index": 17,
              "end_shape_index": 18,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right to stay on 다동길.",
              "verbal_transition_alert_instruction": "Turn right to stay on 다동길.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right to stay on 다동길.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "street_names": [
                "다동길"
              ],
              "bearing_before": 8,
              "bearing_after": 70,
              "time": 131.588,
              "length": 0.185,
              "cost": 131.588,
              "begin_shape_index": 18,
              "end_shape_index": 23,
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
              "time": 136.0,
              "length": 0.187,
              "cost": 156.0,
              "begin_shape_index": 23,
              "end_shape_index": 33,
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
              "begin_shape_index": 33,
              "end_shape_index": 54,
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
              "begin_shape_index": 54,
              "end_shape_index": 54,
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
            "time": 1150.225,
            "length": 1.619,
            "cost": 1200.225
          },
          "shape": "i|zsfAoubeqFOyV~AsGd@mB\\eBLsAb@yD`BuNZuCJy@LeGkFKm`@_Bh@{c@e\\KDiJd@s^ToEaWcCaKwi@yDij@Io@s@gHDc^_d@Qq@CaBeBuBMs@EiNQeCOyFg@uSaBgGi@kN_IoF}DyCkGiBuBKkh@E_BZ_Yt@ipAiAoQQit@H{\\CmOOwKBwSOyVkAwx@[yO{DgfAk@aRmAsn@S}G"
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
        "time": 1150.225,
        "length": 1.619,
        "cost": 1200.225
      },
      "status_message": "Found route between points",
      "status": 0,
      "units": "kilometers",
      "language": "en-US"
    }
  } as const;
