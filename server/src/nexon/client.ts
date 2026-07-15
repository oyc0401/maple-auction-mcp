/**
 * 넥슨 공식 OpenAPI의 유일한 네트워크 진입점.
 *
 * 429가 발생하면 API 키가 장시간 차단되어 개발 자체가 중단될 수 있다.
 * 모든 엔드포인트 함수는 반드시 requestNexonOpenApi()를 사용해야 하며,
 * 다른 모듈에서 넥슨 API를 fetch()로 직접 호출하거나 1초 간격을 우회하면 안 된다.
 */
export const NEXON_OPEN_API_BASE = 'https://open.api.nexon.com/maplestory/v1';
export const NEXON_REQUEST_INTERVAL_MS = 1_000;

export interface NexonApiOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

export type NexonApiKeyOrOptions = string | NexonApiOptions;

export class NexonOpenApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = 'NexonOpenApiError';
  }
}

export function nexonApiKey(): string | undefined {
  return process.env.NEXON_DEVELOPER_KEY || undefined;
}

export function resolveNexonOptions(keyOrOptions?: NexonApiKeyOrOptions): NexonApiOptions {
  return typeof keyOrOptions === 'string' ? { apiKey: keyOrOptions } : keyOrOptions ?? {};
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestSchedule {
  nextRequestAt: number;
  tail: Promise<void>;
}

const requestSchedules = new Map<string, RequestSchedule>();

async function waitForRequestSlot(apiKey: string): Promise<void> {
  let schedule = requestSchedules.get(apiKey);
  if (!schedule) {
    schedule = { nextRequestAt: 0, tail: Promise.resolve() };
    requestSchedules.set(apiKey, schedule);
  }

  const slot = schedule.tail.then(async () => {
    const waitMs = Math.max(0, schedule.nextRequestAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    schedule.nextRequestAt = Date.now() + NEXON_REQUEST_INTERVAL_MS;
  });
  schedule.tail = slot.catch(() => undefined);
  await slot;
}

async function readErrorDetail(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestNexonOpenApi<T>(
  path: string,
  params: Record<string, string | undefined>,
  keyOrOptions?: NexonApiKeyOrOptions
): Promise<T> {
  const options = resolveNexonOptions(keyOrOptions);
  const apiKey = options.apiKey ?? nexonApiKey();
  if (!apiKey) throw new Error('NEXON_DEVELOPER_KEY 미설정');

  const url = new URL(NEXON_OPEN_API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const fetchFn = options.fetchFn ?? fetch;
  await waitForRequestSlot(apiKey);
  const res = await fetchFn(url, {
    signal: options.signal,
    headers: { 'x-nxopen-api-key': apiKey },
  });
  if (res.ok) return (await res.json()) as T;

  const detail = await readErrorDetail(res);
  const suffix = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
  throw new NexonOpenApiError(`넥슨 오픈 API ${res.status} ${path}${suffix}`, res.status, path, detail);
}
