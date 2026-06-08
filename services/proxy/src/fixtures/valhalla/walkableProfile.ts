/**
 * P4 F4 — Valhalla 골든 픽스처 (라이브 컨테이너 실 캡처).
 *
 * 걷기좋은 프로필 (walkway/sidewalk 선호 — 곱셈 비용 <1.0).
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
              "cost": 31.93,
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
              "verbal_post_transition_instruction": "Continue for 20 meters.",
              "street_names": [
                "세종대로20길"
              ],
              "bearing_before": 360,
              "bearing_after": 270,
              "time": 14.117,
              "length": 0.02,
              "cost": 19.117,
              "begin_shape_index": 9,
              "end_shape_index": 10,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto the walkway.",
              "verbal_transition_alert_instruction": "Turn right onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto the walkway.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "bearing_before": 270,
              "bearing_after": 1,
              "time": 166.47,
              "length": 0.232,
              "cost": 89.235,
              "begin_shape_index": 10,
              "end_shape_index": 16,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto the walkway.",
              "verbal_transition_alert_instruction": "Turn right onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto the walkway.",
              "verbal_post_transition_instruction": "Continue for 30 meters.",
              "bearing_before": 32,
              "bearing_after": 95,
              "time": 20.47,
              "length": 0.029,
              "cost": 10.235,
              "begin_shape_index": 16,
              "end_shape_index": 17,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left.",
              "verbal_transition_alert_instruction": "Turn left.",
              "verbal_succinct_transition_instruction": "Turn left. Then Continue on the walkway.",
              "verbal_pre_transition_instruction": "Turn left. Then Continue on the walkway.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "bearing_before": 95,
              "bearing_after": 1,
              "time": 3.529,
              "length": 0.005,
              "cost": 3.529,
              "begin_shape_index": 17,
              "end_shape_index": 18,
              "verbal_multi_cue": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 8,
              "instruction": "Continue on the walkway.",
              "verbal_transition_alert_instruction": "Continue on the walkway.",
              "verbal_pre_transition_instruction": "Continue on the walkway.",
              "verbal_post_transition_instruction": "Continue for 400 meters.",
              "bearing_before": 1,
              "bearing_after": 0,
              "time": 257.705,
              "length": 0.358,
              "cost": 131.352,
              "begin_shape_index": 18,
              "end_shape_index": 30,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto the walkway.",
              "verbal_transition_alert_instruction": "Turn left onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto the walkway.",
              "verbal_post_transition_instruction": "Continue for 30 meters.",
              "bearing_before": 97,
              "bearing_after": 5,
              "time": 17.647,
              "length": 0.025,
              "cost": 8.823,
              "begin_shape_index": 30,
              "end_shape_index": 33,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto the walkway.",
              "verbal_transition_alert_instruction": "Turn right onto the walkway.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto the walkway.",
              "verbal_post_transition_instruction": "Continue for 800 meters.",
              "bearing_before": 6,
              "bearing_after": 100,
              "time": 571.058,
              "length": 0.809,
              "cost": 285.529,
              "begin_shape_index": 33,
              "end_shape_index": 79,
              "rough": true,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 40,
              "instruction": "Take the stairs.",
              "verbal_transition_alert_instruction": "Take the stairs.",
              "verbal_pre_transition_instruction": "Take the stairs.",
              "verbal_post_transition_instruction": "Continue for 20 meters.",
              "street_names": [
                "수표교 진출입 계단 9번"
              ],
              "bearing_before": 89,
              "bearing_after": 359,
              "time": 12.705,
              "length": 0.018,
              "cost": 42.705,
              "begin_shape_index": 79,
              "end_shape_index": 80,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 10,
              "instruction": "Turn right onto 청계천로.",
              "verbal_transition_alert_instruction": "Turn right onto 청계천로.",
              "verbal_succinct_transition_instruction": "Turn right.",
              "verbal_pre_transition_instruction": "Turn right onto 청계천로.",
              "verbal_post_transition_instruction": "Continue for 100 meters.",
              "street_names": [
                "청계천로"
              ],
              "bearing_before": 359,
              "bearing_after": 83,
              "time": 91.764,
              "length": 0.13,
              "cost": 96.764,
              "begin_shape_index": 80,
              "end_shape_index": 83,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 돈화문로.",
              "verbal_transition_alert_instruction": "Turn left onto 돈화문로.",
              "verbal_succinct_transition_instruction": "Turn left.",
              "verbal_pre_transition_instruction": "Turn left onto 돈화문로.",
              "verbal_post_transition_instruction": "Continue for 200 meters.",
              "street_names": [
                "돈화문로"
              ],
              "bearing_before": 83,
              "bearing_after": 351,
              "time": 146.823,
              "length": 0.208,
              "cost": 151.823,
              "begin_shape_index": 83,
              "end_shape_index": 92,
              "travel_mode": "pedestrian",
              "travel_type": "foot"
            },
            {
              "type": 15,
              "instruction": "Turn left onto 종로/6.",
              "verbal_transition_alert_instruction": "Turn left onto 종로.",
              "verbal_succinct_transition_instruction": "Turn left. Then You will arrive at your destination.",
              "verbal_pre_transition_instruction": "Turn left onto 종로, 6. Then You will arrive at your destination.",
              "verbal_post_transition_instruction": "Continue for less than 10 meters.",
              "street_names": [
                "종로",
                "6"
              ],
              "bearing_before": 350,
              "bearing_after": 265,
              "time": 4.207,
              "length": 0.005,
              "cost": 9.207,
              "begin_shape_index": 92,
              "end_shape_index": 93,
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
              "begin_shape_index": 93,
              "end_shape_index": 93,
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
            "min_lon": 126.977343,
            "max_lat": 37.570405,
            "max_lon": 126.992375,
            "time": 1370.362,
            "length": 1.931,
            "cost": 880.255
          },
          "shape": "i|zsfAoubeqF@jCFfJuJNAx@yCBuJHiA?sA@mB?@jMcAAeKEkk@|@gEEcm@DuO_Lh@yS_BAo@?_AM?{ExAih@?y@H{S^kXTkFzAm^BkAJwCtHyfBc@CoGk@kCS~Cud@tB}XRuIp@yMNaB^}EnL}bA|Gqj@lOi}AdBc[L{M?I?I@IAE?q@?K@GAM@I?a@?wEJgOVad@AoA?W?c@A[?]CuB?YA_@?c@Ac@CcDQce@?y@AkA?mAAkAA{BM{CiB{ULiIBoCU}f@eIBqAqY}Ag`@gBs^ua@zEuI\\{Q\\{OX_HJiQj@iAJgAHuA^HdC"
        }
      ],
      "summary": {
        "has_time_restrictions": false,
        "has_toll": false,
        "has_highway": false,
        "has_ferry": false,
        "min_lat": 37.566416,
        "min_lon": 126.977343,
        "max_lat": 37.570405,
        "max_lon": 126.992375,
        "time": 1370.362,
        "length": 1.931,
        "cost": 880.255
      },
      "status_message": "Found route between points",
      "status": 0,
      "units": "kilometers",
      "language": "en-US"
    }
  } as const;
