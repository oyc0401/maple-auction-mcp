# Maple Auction MCP

메이플스토리 경매장을 검색하는 MCP 서버.

## 설치 방법

먼저 [크롬 확장](https://chromewebstore.google.com)을 설치하고, 크롬에서 [메이플스토리 경매장](https://auction.maplestory.nexon.com)에 로그인 해 주세요

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

### Antigravity CLI

Antigravity CLI는 등록 명령어가 없어 설정 파일 `~/.gemini/config/mcp_config.json`(없으면 생성)에 직접 추가합니다:

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

Windows는 `"command": "cmd", "args": ["/c", "npx", "-y", "maple-auction-mcp"]` 형태로 넣어주세요. 등록 확인은 CLI에서 `/mcp` 입력. (구버전 CLI는 `~/.gemini/antigravity-cli/mcp_config.json`을 읽습니다.)

> Gemini CLI는 2026-06-18부로 개인 계정 지원이 종료되어 Antigravity CLI로 대체되었습니다.

## 환산 주스탯 (자동)

방어구·장신구를 검색하면 각 매물에 **`hwansanBySlot`**(부위별로, 현재 착용 장비 대신 낄 때 오르는 환산 주스탯, 음수면 하락)이 함께 표시된다. 전투력과 달리 **보스 데미지·방어율 무시·데미지·세트 효과 변화까지 반영**해 장비 우열을 판단한다.

maplescouter API 기반으로 별도 설정 없이 자동 동작한다(무기 검색, 제논·데몬어벤져 캐릭터는 아직 미지원).

## 사용 예

> 에디공 21퍼 아케인 체인 검색해줘

> 내가 낄 만한 카데나 무기 환산 높은 순으로 찾아줘

![메이플 경매장 검색 예시](docs/maple-auction-example.png)

## 개인정보 처리방침

크롬 확장은 어떠한 데이터도 외부로 수집·전송하지 않습니다. 자세한 내용은 [개인정보 처리방침](docs/privacy-policy.md)을 참고하세요.

## 라이선스

[MIT](LICENSE)