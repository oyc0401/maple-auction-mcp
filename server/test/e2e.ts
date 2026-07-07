// 실행 전제: 크롬 실행 중 + 확장 로드됨 + 넥슨 로그인됨 + pnpm build 완료
// 실행: pnpm --filter maple-auction-mcp exec tsx test/e2e.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'e2e', version: '0.0.0' });
await client.connect(
  new StdioClientTransport({ command: 'node', args: [new URL('../dist/index.js', import.meta.url).pathname] })
);

function text(r: any): string {
  return r.content[0].text;
}

// 확장이 WS에 붙을 시간을 준다 (확장 재접속 주기 최대 30초)
console.log('확장 연결 대기 중 (최대 35초)...');
let status = '';
for (let i = 0; i < 35; i++) {
  status = text(await client.callTool({ name: 'get_status', arguments: {} }));
  if (status.includes('"connected": true')) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log('[get_status]', status);
if (!status.includes('"connected": true')) {
  console.error('FAIL: 확장이 연결되지 않았습니다.');
  process.exit(1);
}

const search = text(await client.callTool({ name: 'search_items', arguments: { keyword: '아케인셰이드 가즈', category: 'WEAPON' } }));
console.log('[search_items]', search.slice(0, 600));
const searchKey = JSON.parse(search).searchKey;
if (!searchKey) {
  console.error('FAIL: searchKey 없음');
  process.exit(1);
}

const page2 = text(await client.callTool({ name: 'get_page', arguments: { searchKey, page: 2 } }));
console.log('[get_page]', page2.slice(0, 400));
if (JSON.parse(page2).page !== 2) {
  console.error('FAIL: 2페이지 조회 실패');
  process.exit(1);
}

console.log('E2E PASS ✅');
await client.close();
process.exit(0);
