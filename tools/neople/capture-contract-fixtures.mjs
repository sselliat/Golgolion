import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_BASE_URL = "https://api.neople.co.kr";
const TARGET_ITEM_NAME = "+10 장비 증폭권[골고라이언]";
const API_KEY = process.env.NEOPLE_API_KEY;

if (!API_KEY) {
  throw new Error(
    "NEOPLE_API_KEY가 설정되지 않았습니다. 키는 환경변수로만 전달하세요.",
  );
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const fixtureDirectory = path.join(
  repositoryRoot,
  "docs",
  "validation",
  "neople",
  "fixtures",
);

const sensitiveKeyPattern =
  /api.?key|character(?:id|name)|adventureName|guildName|seller|buyer|account|user(?:id|name)/i;

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitize(nestedValue),
      ]),
    );
  }

  return value;
}

function publicRequestPath(pathname, parameters) {
  const search = new URLSearchParams(parameters);
  return `${pathname}?${search}`;
}

async function fetchJson(pathname, parameters = {}) {
  const url = new URL(pathname, API_BASE_URL);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("apikey", API_KEY);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const code = body?.error?.code ?? "UNKNOWN";
    const message = body?.error?.message ?? response.statusText;
    throw new Error(`Neople API 요청 실패: HTTP ${response.status} ${code} ${message}`);
  }

  return sanitize(body);
}

async function writeFixture(filename, value) {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized.includes(API_KEY)) {
    throw new Error(`${filename}에 API 키가 포함되어 저장을 중단했습니다.`);
  }

  await writeFile(
    path.join(fixtureDirectory, filename),
    `${serialized}\n`,
    "utf8",
  );
}

function requireRows(response, endpoint) {
  if (!Array.isArray(response?.rows)) {
    throw new Error(`${endpoint} 응답에 rows 배열이 없습니다.`);
  }
  return response.rows;
}

await mkdir(fixtureDirectory, { recursive: true });

const itemSearchParameters = {
  itemName: TARGET_ITEM_NAME,
  wordType: "match",
  limit: 30,
};
const itemSearch = await fetchJson("/df/items", itemSearchParameters);
const exactMatches = requireRows(itemSearch, "/df/items").filter(
  (row) => row?.itemName === TARGET_ITEM_NAME,
);

if (exactMatches.length !== 1 || typeof exactMatches[0]?.itemId !== "string") {
  throw new Error(
    `정확한 아이템을 하나로 확정할 수 없습니다. 일치 결과 수: ${exactMatches.length}`,
  );
}

const itemId = exactMatches[0].itemId;
const itemDetail = await fetchJson(`/df/items/${encodeURIComponent(itemId)}`);
const auctionDefaultParameters = { itemId, limit: 400 };
const auctionPriceParameters = {
  itemId,
  limit: 400,
  sort: "unitPrice:asc",
};
const soldParameters = { itemId, limit: 100 };

const auctionDefault = await fetchJson("/df/auction", auctionDefaultParameters);
const auctionPriceAscending = await fetchJson(
  "/df/auction",
  auctionPriceParameters,
);
const auctionSold = await fetchJson("/df/auction-sold", soldParameters);
const capturedAt = new Date().toISOString();

await Promise.all([
  writeFixture("items-search.json", itemSearch),
  writeFixture("item-detail.json", itemDetail),
  writeFixture("auction-default.json", auctionDefault),
  writeFixture("auction-unit-price-asc.json", auctionPriceAscending),
  writeFixture("auction-sold.json", auctionSold),
  writeFixture("manifest.json", {
    capturedAt,
    targetItemName: TARGET_ITEM_NAME,
    itemId,
    requests: [
      publicRequestPath("/df/items", itemSearchParameters),
      `/df/items/${encodeURIComponent(itemId)}`,
      publicRequestPath("/df/auction", auctionDefaultParameters),
      publicRequestPath("/df/auction", auctionPriceParameters),
      publicRequestPath("/df/auction-sold", soldParameters),
    ],
    redaction: "Identity-like response values are replaced with [REDACTED].",
  }),
]);

console.log(`비식별 fixture 6개를 생성했습니다: ${fixtureDirectory}`);
console.log(`확정 아이템 ID: ${itemId}`);
