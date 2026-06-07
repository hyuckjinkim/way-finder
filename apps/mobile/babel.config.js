/**
 * Babel 설정 (E1).
 *
 * babel-preset-expo만 사용한다. reanimated 플러그인은 모든 파일을 변환하며
 * E1 stub export에 불필요하므로 의도적으로 추가하지 않는다 — reanimated를 실제로
 * import하는 스트림(E2/C3)이 필요 시 `react-native-reanimated/plugin`을 추가한다.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
