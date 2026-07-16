import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './auction/bridge.js';
import { AuctionBridge, MapleAuctionApi } from './auction/api.js';
import { createServer } from './mcp.js';
import {
  loadCharacterSnapshot,
  refreshCharacterSnapshot,
} from './characterSnapshot.js';

// --api-key <key> / --api-key=<key> → NEXON_DEVELOPER_KEY.
// MCP 설정에서 `npx maple-auction-mcp --api-key YOUR_NEXON_API_KEY`처럼 넣는 설치 인터페이스.
// 명시 인자가 env보다 우선한다. 키가 없어도 검색은 정상이며 최종 데미지 계산만 생략된다.
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--api-key' && process.argv[i + 1]) process.env.NEXON_DEVELOPER_KEY = process.argv[++i];
  else if (arg.startsWith('--api-key=')) process.env.NEXON_DEVELOPER_KEY = arg.slice('--api-key='.length);
}

const auctionApi = new MapleAuctionApi(new AuctionBridge(new Bridge()));
const server = createServer(
  auctionApi,
  loadCharacterSnapshot,
  refreshCharacterSnapshot
);
await server.connect(new StdioServerTransport());
// stdio 종료 시 정리
process.stdin.on('close', () => {
  void auctionApi.close().finally(() => process.exit(0));
});
