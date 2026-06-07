/**
 * Metro 설정 (E1) — pnpm 모노레포 + WSL2 대응.
 *
 * - watchFolders: 레포 루트를 감시해 `@wayfinder/shared` 워크스페이스 소스를 번들에 포함.
 * - nodeModulesPaths: 프로젝트 → 레포 루트 순으로 모듈 해석 (pnpm hoisted 레이아웃).
 * - WSL2(/mnt/d drvfs)는 inotify 미지원 → dev 서버 파일 감시에 폴링 사용.
 *   (`expo export`는 일회성 번들이라 폴링 무관하나, `expo start` dev 서버를 위해 설정.)
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 모노레포: 레포 루트까지 감시하고 양쪽 node_modules에서 해석.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm hoisted 레이아웃에서 심볼릭 링크를 따라가지 않도록 비계층적 조회.
config.resolver.disableHierarchicalLookup = true;

// WSL2 drvfs: inotify 미지원 → dev 서버 폴링.
if (process.env.WATCHPACK_POLLING === 'true' || process.env.CHOKIDAR_USEPOLLING === 'true') {
  config.watcher = {
    ...config.watcher,
    healthCheck: { enabled: true },
    watchman: false,
  };
  config.server = {
    ...config.server,
    forwardClientLogs: true,
  };
}

module.exports = config;
