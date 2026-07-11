import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './bridge.js';
import { NexonBridge } from './nexon.js';
import { createServer } from './mcp.js';

// --api-key <key> / --api-key=<key> → NEXON_DEVELOPER_KEY.
// MCP 설정에서 `npx maple-auction-mcp --api-key YOUR_NEXON_API_KEY`처럼 넣는 설치 인터페이스.
// 명시 인자가 env보다 우선한다. 키가 없어도 검색은 정상 — item_damage/user_equip만 발급 안내를 반환.
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--api-key' && process.argv[i + 1]) process.env.NEXON_DEVELOPER_KEY = process.argv[++i];
  else if (arg.startsWith('--api-key=')) process.env.NEXON_DEVELOPER_KEY = arg.slice('--api-key='.length);
}

const bridge = new NexonBridge(new Bridge());
const server = createServer(bridge);
await server.connect(new StdioServerTransport());
// stdio 종료 시 정리
process.stdin.on('close', () => {
  void bridge.close().finally(() => process.exit(0));
});
