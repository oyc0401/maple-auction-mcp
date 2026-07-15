import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 넥슨 응답 캐시는 client.ts를 타는 모든 호출에 걸린다. 테스트가 실제 사용자 데이터
// 디렉터리(~/Library/Application Support/maple-auction-mcp 등)에 쓰거나 지우지 않도록
// 테스트 파일마다 임시 디렉터리로 격리한다.
process.env.MAPLE_AUCTION_DATA_DIR = mkdtempSync(join(tmpdir(), 'maple-auction-test-'));
