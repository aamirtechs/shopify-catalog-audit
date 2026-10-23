import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, titleSimilarity, auditCatalog, buildSummary } from "../src/audit.js";

const HEADER = ["Handle","Title","Variant SKU","Variant Barcode","Variant Price","Variant Weight","Image Src","Image Alt Text"];
function rec(row, obj) { return { _row: row, ...obj }; }

test("parseCsv parses headers and rows and keeps row numbers", () => {
  const { header, records } = parseCsv("Handle,Title\nmug,Plain Mug\n");
  assert.deepEqual(header, ["Handle","Title"]);
  assert.equal(records[0]._row, 2);
  assert.equal(records[0].Title, "Plain Mug");
});

test("title similarity is high for punctuation only differences", () => {
  assert.equal(titleSimilarity("Blue Cotton T-Shirt", "Blue Cotton T Shirt"), 1);
  assert.ok(titleSimilarity("Red Wool Scarf", "Blue Cotton Shirt") < 0.8);
});

test("duplicate SKU flags later rows as merge, not the first", () => {
  const records = [
    rec(2, { Handle: "a", Title: "Item A", "Variant SKU": "SKU-1", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" }),
    rec(3, { Handle: "b", Title: "Item B", "Variant SKU": "SKU-1", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/b.jpg", "Image Alt Text": "b" })
  ];
  const issues = auditCatalog(HEADER, records).filter((i) => i.issue.startsWith("duplicate SKU"));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].row, 3);
  assert.equal(issues[0].suggestion, "merge");
});

test("duplicate barcode is detected across handles", () => {
  const records = [
    rec(2, { Handle: "a", Title: "Item A", "Variant SKU": "S1", "Variant Barcode": "111", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" }),
    rec(3, { Handle: "b", Title: "Item B", "Variant SKU": "S2", "Variant Barcode": "111", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/b.jpg", "Image Alt Text": "b" })
  ];
  assert.ok(auditCatalog(HEADER, records).some((i) => i.issue.startsWith("duplicate barcode")));
});

test("near duplicate titles across handles are flagged", () => {
  const records = [
    rec(2, { Handle: "a", Title: "Blue Cotton T-Shirt", "Variant SKU": "S1", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" }),
    rec(3, { Handle: "b", Title: "Blue Cotton T Shirt", "Variant SKU": "S2", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/b.jpg", "Image Alt Text": "b" })
  ];
  assert.ok(auditCatalog(HEADER, records).some((i) => i.issue.startsWith("near-duplicate title")));
});

test("same handle with conflicting titles is flagged", () => {
  const records = [
    rec(2, { Handle: "a", Title: "Scarf", "Variant SKU": "S1", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" }),
    rec(3, { Handle: "a", Title: "Scarf Deluxe", "Variant SKU": "S2", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/b.jpg", "Image Alt Text": "b" })
  ];
  assert.ok(auditCatalog(HEADER, records).some((i) => i.issue.startsWith("conflicting titles")));
});

test("orphaned variant row with no titled parent is flagged", () => {
  const records = [rec(2, { Handle: "ghost", Title: "", "Variant SKU": "S1", "Variant Price": "10", "Variant Weight": "1" })];
  assert.ok(auditCatalog(HEADER, records).some((i) => i.issue.startsWith("orphaned variant")));
});

test("missing image, missing alt, zero price and missing weight are flagged", () => {
  const records = [
    rec(2, { Handle: "a", Title: "No Image Item", "Variant SKU": "S1", "Variant Price": "10", "Variant Weight": "1", "Image Src": "", "Image Alt Text": "" }),
    rec(3, { Handle: "b", Title: "No Alt Item", "Variant SKU": "S2", "Variant Price": "0", "Variant Weight": "", "Image Src": "https://example.com/b.jpg", "Image Alt Text": "" })
  ];
  const kinds = auditCatalog(HEADER, records).map((i) => i.issue);
  assert.ok(kinds.includes("missing image"));
  assert.ok(kinds.includes("missing image alt text"));
  assert.ok(kinds.includes("blank or zero price"));
  assert.ok(kinds.includes("missing weight"));
});

test("missing weight is only checked when a weight column exists", () => {
  const headerNoWeight = HEADER.filter((h) => h !== "Variant Weight");
  const records = [rec(2, { Handle: "a", Title: "Item", "Variant SKU": "S1", "Variant Price": "10", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" })];
  assert.ok(!auditCatalog(headerNoWeight, records).some((i) => i.issue === "missing weight"));
});

test("clean catalog produces no issues and summary states the review rule", () => {
  const records = [rec(2, { Handle: "a", Title: "Clean Item", "Variant SKU": "S1", "Variant Barcode": "111", "Variant Price": "10", "Variant Weight": "1", "Image Src": "https://example.com/a.jpg", "Image Alt Text": "a" })];
  const issues = auditCatalog(HEADER, records);
  assert.equal(issues.length, 0);
  assert.ok(buildSummary(records, issues).includes("never modifies"));
});
