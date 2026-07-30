import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const TARGET_ITEM_NAME = "+10 장비 증폭권[골고라이언]";
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.resolve(
  testDirectory,
  "../../docs/validation/neople/fixtures",
);

async function fixture(filename) {
  try {
    return JSON.parse(
      await readFile(path.join(fixtureDirectory, filename), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      assert.fail(
        `${filename}이 없습니다. 먼저 capture-contract-fixtures.mjs를 실행하세요.`,
      );
    }
    throw error;
  }
}

function rows(response, endpoint) {
  assert.ok(Array.isArray(response?.rows), `${endpoint}.rows는 배열이어야 한다.`);
  return response.rows;
}

function comparableInteger(value, field) {
  assert.match(String(value), /^\d+$/, `${field}는 음이 아닌 정수여야 한다.`);
  return BigInt(value);
}

function assertExactKeys(value, expectedKeys, subject) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expectedKeys].sort(),
    `${subject}의 필드 계약이 변경되었다.`,
  );
}

function assertType(value, expectedType, field) {
  assert.equal(typeof value, expectedType, `${field}는 ${expectedType}이어야 한다.`);
}

const itemSearchKeys = [
  "itemId",
  "itemName",
  "itemRarity",
  "itemTypeId",
  "itemType",
  "itemTypeDetailId",
  "itemTypeDetail",
  "itemAvailableLevel",
  "fame",
];

const itemDetailKeys = [
  ...itemSearchKeys,
  "itemExplain",
  "itemExplainDetail",
  "itemFlavorText",
  "setItemId",
  "setItemName",
];

const auctionKeys = [
  "auctionNo",
  "regDate",
  "expireDate",
  ...itemSearchKeys,
  "refine",
  "reinforce",
  "amplificationName",
  "count",
  "regCount",
  "price",
  "currentPrice",
  "unitPrice",
  "averagePrice",
];

const soldKeys = [
  "soldDate",
  ...itemSearchKeys,
  "refine",
  "reinforce",
  "amplificationName",
  "count",
  "price",
  "unitPrice",
];

const datePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

test("정확한 MVP 아이템 하나와 itemId를 확정한다", async () => {
  const [manifest, search, detail] = await Promise.all([
    fixture("manifest.json"),
    fixture("items-search.json"),
    fixture("item-detail.json"),
  ]);
  const exactMatches = rows(search, "/df/items").filter(
    (row) => row?.itemName === TARGET_ITEM_NAME,
  );

  assert.equal(exactMatches.length, 1);
  assert.equal(typeof exactMatches[0].itemId, "string");
  assert.ok(exactMatches[0].itemId.length > 0);
  assert.equal(manifest.targetItemName, TARGET_ITEM_NAME);
  assert.equal(manifest.itemId, exactMatches[0].itemId);
  assert.equal(detail.itemId, manifest.itemId);
  assert.equal(detail.itemName, TARGET_ITEM_NAME);
  assertExactKeys(exactMatches[0], itemSearchKeys, "아이템 검색 행");
  assertExactKeys(detail, itemDetailKeys, "아이템 상세 응답");

  for (const key of itemSearchKeys) {
    const expectedType = ["itemAvailableLevel", "fame"].includes(key)
      ? "number"
      : "string";
    assertType(exactMatches[0][key], expectedType, `검색 결과.${key}`);
  }

  assert.equal(detail.setItemId, null);
  assert.equal(detail.setItemName, null);
});

test("등록 매물 기본 응답은 문서상 최대 400건이며 auctionNo 오름차순이다", async () => {
  const response = await fixture("auction-default.json");
  const auctionRows = rows(response, "/df/auction");

  assert.ok(auctionRows.length <= 400);
  for (let index = 0; index < auctionRows.length; index += 1) {
    const row = auctionRows[index];
    assertExactKeys(row, auctionKeys, `등록 매물 ${index}`);
    assert.match(row.regDate, datePattern);
    assert.match(row.expireDate, datePattern);
    assert.equal(row.amplificationName, null);
    assert.equal(row.currentPrice, row.unitPrice * row.count);
    assert.ok(row.regCount >= row.count);
    assert.ok(Number.isSafeInteger(row.auctionNo));

    if (index === 0) {
      continue;
    }
    const previous = comparableInteger(
      auctionRows[index - 1].auctionNo,
      "auctionNo",
    );
    const current = comparableInteger(auctionRows[index].auctionNo, "auctionNo");
    assert.ok(previous <= current, "auctionNo 기본 정렬은 오름차순이어야 한다.");
  }
});

test("등록 매물은 unitPrice 오름차순으로 요청할 수 있다", async () => {
  const response = await fixture("auction-unit-price-asc.json");
  const auctionRows = rows(response, "/df/auction?sort=unitPrice:asc");

  assert.ok(auctionRows.length <= 400);
  for (let index = 1; index < auctionRows.length; index += 1) {
    const previous = comparableInteger(
      auctionRows[index - 1].unitPrice,
      "unitPrice",
    );
    const current = comparableInteger(
      auctionRows[index].unitPrice,
      "unitPrice",
    );
    assert.ok(previous <= current, "unitPrice는 오름차순이어야 한다.");
  }
});

test("체결 내역 응답은 문서상 최대 100건이다", async () => {
  const response = await fixture("auction-sold.json");
  const soldRows = rows(response, "/df/auction-sold");

  assert.ok(soldRows.length <= 100);
  const fingerprints = new Set();
  for (let index = 0; index < soldRows.length; index += 1) {
    const row = soldRows[index];
    assertExactKeys(row, soldKeys, `체결 내역 ${index}`);
    assert.match(row.soldDate, datePattern);
    assert.equal(row.amplificationName, null);
    assert.equal(row.price, row.unitPrice * row.count);

    const fingerprint = [
      row.soldDate,
      row.itemId,
      row.unitPrice,
      row.count,
    ].join("|");
    assert.ok(
      !fingerprints.has(fingerprint),
      "잠정 체결 fingerprint가 fixture 안에서 유일해야 한다.",
    );
    fingerprints.add(fingerprint);

    if (index > 0) {
      assert.ok(
        soldRows[index - 1].soldDate >= row.soldDate,
        "관찰된 soldDate 정렬은 내림차순이어야 한다.",
      );
    }
  }
});

test("fixture와 manifest에 API 키가 포함되지 않는다", async () => {
  const filenames = [
    "manifest.json",
    "items-search.json",
    "item-detail.json",
    "auction-default.json",
    "auction-unit-price-asc.json",
    "auction-sold.json",
  ];

  for (const filename of filenames) {
    const value = await fixture(filename);
    const serialized = JSON.stringify(value);
    assert.doesNotMatch(serialized, /["']?api.?key["']?\s*[:=]/i);

    if (filename === "manifest.json") {
      assert.ok(
        value.requests.every((request) => !request.includes("apikey")),
        "manifest 요청 경로에 apikey 파라미터가 없어야 한다.",
      );
    }
  }
});
