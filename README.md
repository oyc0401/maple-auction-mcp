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

## 최종 데미지 증감률 (넥슨 오픈 API 키 필수)

`item_damage` 도구는 매물을 현재 착용 장비와 교체할 때의 **최종 데미지 증감률(%)** 을 계산합니다 — 주스탯(%적용·미적용 분리)·공격력·보스 데미지·방어율 무시(곱연산)·크리티컬 데미지·최종 데미지·세트 효과 변화까지 반영. `user_equip`으로 캐릭터 착용 장비도 조회할 수 있습니다.

이 도구들을 쓰려면 [openapi.nexon.com](https://openapi.nexon.com)에서 API 키를 발급받아(무료) 실행 인자에 붙여야 합니다:

```bash
claude mcp add --scope user maple-auction -- npx -y maple-auction-mcp --api-key YOUR_NEXON_API_KEY
```

## 사용 예

> 에디공 21퍼 아케인 체인 검색해줘

> 내가 낄 만한 카데나 무기 데미지 증가율 높은 순으로 찾아줘

![메이플 경매장 검색 예시](docs/maple-auction-example.png)

## 개인정보 처리방침

크롬 확장은 어떠한 데이터도 외부로 수집·전송하지 않습니다. 자세한 내용은 [개인정보 처리방침](docs/privacy-policy.md)을 참고하세요.

## 라이선스

[MIT](LICENSE)