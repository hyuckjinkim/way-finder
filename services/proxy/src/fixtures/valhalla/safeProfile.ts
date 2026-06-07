/**
 * P4 F4 — Valhalla 골든 픽스처 (라이브 컨테이너 실 캡처).
 *
 * 안전 프로필 (use_lit+alley/driveway 회피 — 소요 증가).
 * 캡처: ghcr.io/valhalla/valhalla:latest + 수도권(서울+경기) bbox 타일.
 * **실 응답** — shape는 encoded polyline precision 6 (A1 정규화기 입력).
 * 타일 재빌드 시 재캡처 필요 (services/valhalla/capture-fixtures.sh).
 */
export const SAFE_PROFILE_RAW = {
    "trip": {
      "locations": [
        {
          "type": "break",
          "lat": 37.5663,
          "lon": 126.9779,
          "side_of_street": "left",
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
              "type": 3,
              "instruction": "Walk west on the walkway.",
              "verbal_succinct_transition_instruction": "Walk west.",
              "verbal_pre_transition_instruction": "Walk west on the walkway.",
              "verbal_post_transition_instruction": "Continue for 90 meters.",
              "bearing_after": 269,
              "time": 63.861,
              "length": 0.09,
              "cost": 362.656,
              "begin_shape_index": 0,
              "end_shape_index": 9,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 세종대로20길.",
              "verbal_transition_alert_instruction": "Turn left onto 세종대로20길.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 세종대로20길.",
              "verbal_post_transition_instruction": "Continue for 30 meters.",
              "street_names": [
                "세종대로20길"
              ],
              "bearing_before": 360,
              "bearing_after": 270,
              "time": 21.882,
              "length": 0.031,
              "cost": 180.058,
              "begin_shape_index": 9,
              "end_shape_index": 12,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 세종대로/31.",
              "verbal_transition_alert_instruction": "Turn right onto 세종대로.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 세종대로, 31.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "street_names": [
                "세종대로",
                "31"
              ],
              "bearing_before": 271,
              "bearing_after": 359,
              "time": 147.529,
              "length": 0.209,
              "cost": 152.529,
              "begin_shape_index": 12,
              "end_shape_index": 16,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 24,
              "instruction": "Keep left to stay on 세종대로/31.",
              "verbal_transition_alert_instruction": "Keep left to stay on 세종대로.",
              "verbal_pre_transition_instruction": "Keep left to stay on 세종대로, 31.",
              "verbal_post_transition_instruction": "Continue for 400 meters.",
              "street_names": [
                "세종대로",
                "31"
              ],
              "bearing_before": 359,
              "bearing_after": 360,
              "time": 302.411,
              "length": 0.427,
              "cost": 554.529,
              "begin_shape_index": 16,
              "end_shape_index": 32,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto the walkway.",
              "verbal_transition_alert_instruction": "Turn right onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn right. Then Turn left onto 세종대로.",
              "verbal_pre_transition_instruction": "Turn right onto the walkway. Then Turn left onto 세종대로.",
              "verbal_post_transition_instruction": "Continue for 10 meters.",
              "bearing_before": 359,
              "bearing_after": 90,
              "time": 8.47,
              "length": 0.012,
              "cost": 72.764,
              "begin_shape_index": 32,
              "end_shape_index": 33,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 세종대로/48/31.",
              "verbal_transition_alert_instruction": "Turn left onto 세종대로.",
              "verbal_succinct_transition_instruction": "Turn left. Then Turn right onto 삼봉로.",
              "verbal_pre_transition_instruction": "Turn left onto 세종대로, 48. Then Turn right onto 삼봉로.",
              "verbal_post_transition_instruction": "Continue for 20 meters.",
              "street_names": [
                "세종대로",
                "48",
                "31"
              ],
              "bearing_before": 90,
              "bearing_after": 358,
              "time": 10.588,
              "length": 0.015,
              "cost": 15.588,
              "begin_shape_index": 33,
              "end_shape_index": 34,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 삼봉로.",
              "verbal_transition_alert_instruction": "Turn right onto 삼봉로.",
              "verbal_succinct_transition_instruction": "Turn right. Then Turn left.",
              "verbal_pre_transition_instruction": "Turn right onto 삼봉로. Then Turn left.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "street_names": [
                "삼봉로"
              ],
              "bearing_before": 358,
              "bearing_after": 91,
              "time": 4.235,
              "length": 0.006,
              "cost": 38.882,
              "begin_shape_index": 34,
              "end_shape_index": 35,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left.",
              "verbal_transition_alert_instruction": "Turn left.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "bearing_before": 91,
              "bearing_after": 359,
              "time": 121.411,
              "length": 0.172,
              "cost": 126.411,
              "begin_shape_index": 35,
              "end_shape_index": 40,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 8,
              "instruction": "Continue on the walkway.",
              "verbal_transition_alert_instruction": "Continue on the walkway.",
              "verbal_pre_transition_instruction": "Continue on the walkway. Then Turn right onto 사직로8길.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "bearing_before": 358,
              "bearing_after": 358,
              "time": 3.529,
              "length": 0.005,
              "cost": 3.529,
              "begin_shape_index": 40,
              "end_shape_index": 41,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 사직로8길.",
              "verbal_transition_alert_instruction": "Turn right onto 사직로8길.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 사직로8길.",
              "verbal_post_transition_instruction": "Continue for 90 meters.",
              "street_names": [
                "사직로8길"
              ],
              "bearing_before": 358,
              "bearing_after": 88,
              "time": 64.235,
              "length": 0.091,
              "cost": 513.882,
              "begin_shape_index": 41,
              "end_shape_index": 46,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 종로1길.",
              "verbal_transition_alert_instruction": "Turn left onto 종로1길.",
              "verbal_succinct_transition_instruction": "Turn left. Then Turn left to stay on 종로1길.",
              "verbal_pre_transition_instruction": "Turn left onto 종로1길. Then Turn left to stay on 종로1길.",
              "verbal_post_transition_instruction": "Continue for 10 meters.",
              "street_names": [
                "종로1길"
              ],
              "bearing_before": 88,
              "bearing_after": 38,
              "time": 9.882,
              "length": 0.014,
              "cost": 163.117,
              "begin_shape_index": 46,
              "end_shape_index": 51,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left to stay on 종로1길.",
              "verbal_transition_alert_instruction": "Turn left to stay on 종로1길.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left to stay on 종로1길.",
              "verbal_post_transition_instruction": "Continue for 100 meters.",
              "street_names": [
                "종로1길"
              ],
              "bearing_before": 83,
              "bearing_after": 18,
              "time": 93.176,
              "length": 0.132,
              "cost": 93.176,
              "begin_shape_index": 51,
              "end_shape_index": 56,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 17,
              "instruction": "Stay straight to take the ramp.",
              "verbal_transition_alert_instruction": "Stay straight to take the ramp.",
              "verbal_pre_transition_instruction": "Stay straight to take the ramp.",
              "street_names": [
                "종로1길"
              ],
              "bearing_before": 38,
              "bearing_after": 46,
              "time": 14.117,
              "length": 0.02,
              "cost": 112.941,
              "begin_shape_index": 56,
              "end_shape_index": 57,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 24,
              "instruction": "Keep left to take 종로1길.",
              "verbal_transition_alert_instruction": "Keep left to take 종로1길.",
              "verbal_pre_transition_instruction": "Keep left to take 종로1길.",
              "street_names": [
                "종로1길"
              ],
              "bearing_before": 46,
              "bearing_after": 30,
              "time": 18.352,
              "length": 0.026,
              "cost": 146.823,
              "begin_shape_index": 57,
              "end_shape_index": 59,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 율곡로/50.",
              "verbal_transition_alert_instruction": "Turn right onto 율곡로.",
              "verbal_succinct_transition_instruction": "Turn right. Then Turn left onto the walkway.",
              "verbal_pre_transition_instruction": "Turn right onto 율곡로, 50. Then Turn left onto the walkway.",
              "verbal_post_transition_instruction": "Continue for 20 meters.",
              "street_names": [
                "율곡로",
                "50"
              ],
              "bearing_before": 27,
              "bearing_after": 76,
              "time": 11.294,
              "length": 0.016,
              "cost": 16.294,
              "begin_shape_index": 59,
              "end_shape_index": 61,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto the walkway.",
              "verbal_transition_alert_instruction": "Turn left onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn left. Then Turn right onto 율곡로.",
              "verbal_pre_transition_instruction": "Turn left onto the walkway. Then Turn right onto 율곡로.",
              "verbal_post_transition_instruction": "Continue for 20 meters.",
              "bearing_before": 76,
              "bearing_after": 3,
              "time": 10.588,
              "length": 0.015,
              "cost": 89.705,
              "begin_shape_index": 61,
              "end_shape_index": 62,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 율곡로.",
              "verbal_transition_alert_instruction": "Turn right onto 율곡로.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 율곡로.",
              "verbal_post_transition_instruction": "Continue for 1 kilometer.",
              "street_names": [
                "율곡로"
              ],
              "bearing_before": 3,
              "bearing_after": 80,
              "time": 684.588,
              "length": 0.966,
              "cost": 689.588,
              "begin_shape_index": 62,
              "end_shape_index": 101,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 돈화문로.",
              "verbal_transition_alert_instruction": "Turn right onto 돈화문로.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 돈화문로.",
              "verbal_post_transition_instruction": "Continue for 800 meters.",
              "street_names": [
                "돈화문로"
              ],
              "bearing_before": 84,
              "bearing_after": 164,
              "time": 565.176,
              "length": 0.795,
              "cost": 4498.411,
              "begin_shape_index": 101,
              "end_shape_index": 126,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 종로/6.",
              "verbal_transition_alert_instruction": "Turn right onto 종로.",
              "verbal_succinct_transition_instruction": "Turn right. Then You will arrive at your destination.",
              "verbal_pre_transition_instruction": "Turn right onto 종로, 6. Then You will arrive at your destination.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "street_names": [
                "종로",
                "6"
              ],
              "bearing_before": 176,
              "bearing_after": 265,
              "time": 4.207,
              "length": 0.005,
              "cost": 38.658,
              "begin_shape_index": 126,
              "end_shape_index": 127,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 4,
              "instruction": "You have arrived at your destination.",
              "verbal_transition_alert_instruction": "You will arrive at your destination.",
              "verbal_pre_transition_instruction": "You have arrived at your destination.",
              "bearing_before": 265,
              "time": 0.0,
              "length": 0.0,
              "cost": 0.0,
              "begin_shape_index": 127,
              "end_shape_index": 127,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            }
          ],
          "summary": {
            "has_time_restrictions": false,
            "has_toll": false,
            "has_highway": false,
            "has_ferry": false,
            "min_lat": 37.566416,
            "min_lon": 126.977064,
            "max_lat": 37.577372,
            "max_lon": 126.992167,
            "time": 2159.539,
            "length": 3.049,
            "cost": 7869.55
          },
          "shape": "i|zsfAoubeqF@jCFfJuJNAx@yCBuJHiA?sA@mB?@jMAtBAlCkNDsg@LeF?ku@Ts_@F{KB{KFaJ@kB@uDIFhHyBIyAGkAEsCMuBIwCKwx@_DiPN_w@n@?sGoGJ@eCgXJm]^CoCsLZuV\\_BBYsIOqY{B{LEkFCaDm@Mi@[_@k@Su@E{@oAIcVmK{KoIaImHmMcM}FgIcEgDoEgBUwCq@oEmGOu@sKA{ADaBKeJ`A_d@rDwh@bAuNrHqw@^_UMsFc@_EsCyQqAkHcBuNcCwIsEaRw@yCwHsWcToh@kIgXeEyJoBcFiCwH}Mu`@kBgHuByIaAgDk@}Cg@eIOoLg@oXMo`@CcKByOGqIFuPPwBBaVK{CxMiDfBS|@QzV_FdNsC~LgCp`@_HpQoD|t@_O`BWdQoDtToEhN}Cpm@_NjFeAhGwA~a@aJzf@uKdb@iIzCQhLeAzAIdAIb@?X?HdC"
        }
      ],
      "summary": {
        "has_time_restrictions": false,
        "has_toll": false,
        "has_highway": false,
        "has_ferry": false,
        "min_lat": 37.566416,
        "min_lon": 126.977064,
        "max_lat": 37.577372,
        "max_lon": 126.992167,
        "time": 2159.539,
        "length": 3.049,
        "cost": 7869.55
      },
      "status_message": "Found route between points",
      "status": 0,
      "units": "kilometers",
      "language": "en-US"
    }
  } as const;
