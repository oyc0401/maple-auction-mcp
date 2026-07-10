# Maple Auction MCP

메이플스토리 경매장을 검색하는 MCP 서버.

## 설치 방법

먼저 [크롬 확장](https://chromewebstore.google.com/)을 설치하고, 크롬에서 [메이플스토리 경매장](https://auction.maplestory.nexon.com)에 로그인 해 주세요

### Claude Code

```bash
claude mcp add --scope user maple-auction -- npx -y maple-auction-mcp
```

Claude Desktop은 `claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "maple-auction": {
      "command": "npx",
      "args": ["-y", "maple-auction-mcp"]
    }
  }
}
```

### Codex

```bash
codex mcp add maple-auction -- npx -y maple-auction-mcp
```

### Gemini CLI

```bash
gemini mcp add --scope user maple-auction npx -y maple-auction-mcp
```

## 사용 예

> 앱솔랩스 스피어 에디공 21% 이상 매물 찾아줘

## 라이선스

[MIT](LICENSE)