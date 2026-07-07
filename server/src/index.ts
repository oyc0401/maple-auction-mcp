import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './bridge.js';
import { createServer } from './mcp.js';

const bridge = new Bridge();
const server = createServer(bridge);
await server.connect(new StdioServerTransport());
// stdio 종료 시 정리
process.stdin.on('close', () => {
  void bridge.close().finally(() => process.exit(0));
});
