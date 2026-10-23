import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const src = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
  if (clean.length === 0) return { header: [], records: [] };
  const header = clean[0].map((h) => h.trim());
  const records = clean.slice(1).map((r, idx) => {
    const obj = { _row: idx + 2 };
    header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
  return { header, records };
}

export function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function pick(record, names) {
  for (const n of names) if (record[n] !== undefined) return record[n];
  return "";
}

export function normalizeTitle(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function wordSet(title) {
  const norm = normalizeTitle(title);
  return new Set(norm ? norm.split(" ") : []);
}

export function titleSimilarity(a, b) {
  const sa = wordSet(a), sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared += 1;
  const union = new Set([...sa, ...sb]).size;
  return shared / union;
}

export function auditCatalog(header, records) {
  const issues = [];
  const add = (record, issue, suggestion, kind) => issues.push({
    row: record._row,
    handle: pick(record, ["Handle"]),
    sku: pick(record, ["Variant SKU"]),
    issue,
    suggestion,
    kind: kind || issue.split(":")[0]
  });

  const hasWeight = header.includes("Variant Weight");
  const priceOf = (r) => pick(r, ["Variant Price", "Price"]);

  // Duplicate SKU and duplicate barcode. First occurrence is kept, later ones are merge candidates.
  for (const [column, label] of [["Variant SKU", "duplicate SKU"], ["Variant Barcode", "duplicate barcode"]]) {
    const seen = new Map();
    for (const r of records) {
      const value = pick(r, [column]);
      if (!value) continue;
      if (seen.has(value)) add(r, label + ": " + value + " (first seen on row " + seen.get(value) + ")", "merge", label);
      else seen.set(value, r._row);
    }
  }

  // Same handle with conflicting titles.
  const titlesByHandle = new Map();
  for (const r of records) {
    const handle = pick(r, ["Handle"]), title = pick(r, ["Title"]);
    if (!handle || !title) continue;
    if (!titlesByHandle.has(handle)) titlesByHandle.set(handle, new Map());
    const m = titlesByHandle.get(handle);
    if (!m.has(title)) m.set(title, r._row);
  }
  for (const [handle, m] of titlesByHandle) {
    if (m.size > 1) {
      for (const r of records) {
        if (pick(r, ["Handle"]) === handle && pick(r, ["Title"])) add(r, "conflicting titles for handle: " + [...m.keys()].join(" / "), "fix", "conflicting titles for handle");
      }
    }
  }

  // Near-duplicate titles across different handles, using normalised word overlap.
  const uniqueTitles = [];
  const seenPair = new Set();
  for (const r of records) {
    const handle = pick(r, ["Handle"]), title = pick(r, ["Title"]);
    if (handle && title && !uniqueTitles.some((u) => u.handle === handle && u.title === title)) uniqueTitles.push({ handle, title });
  }
  for (let i = 0; i < uniqueTitles.length; i++) {
    for (let j = i + 1; j < uniqueTitles.length; j++) {
      const a = uniqueTitles[i], b = uniqueTitles[j];
      if (a.handle === b.handle) continue;
      if (normalizeTitle(a.title) === normalizeTitle(b.title) || titleSimilarity(a.title, b.title) >= 0.8) {
        const key = a.handle + "|" + b.handle;
        if (seenPair.has(key)) continue;
        seenPair.add(key);
        for (const r of records) {
          if (pick(r, ["Handle"]) === b.handle && pick(r, ["Title"]) === b.title) add(r, "near-duplicate title of handle " + a.handle + ": " + a.title, "merge", "near-duplicate title");
        }
      }
    }
  }

  // Orphaned variant rows: a handle group with no titled parent row at all.
  const handlesWithTitle = new Set(records.filter((r) => pick(r, ["Title"])).map((r) => pick(r, ["Handle"])));
  for (const r of records) {
    const handle = pick(r, ["Handle"]);
    if (handle && !handlesWithTitle.has(handle)) add(r, "orphaned variant row: handle has no parent title row", "fix", "orphaned variant row");
  }

  // Per row completeness checks.
  for (const r of records) {
    const title = pick(r, ["Title"]);
    const sku = pick(r, ["Variant SKU"]);
    const image = pick(r, ["Image Src"]);
    const alt = pick(r, ["Image Alt Text"]);
    if (title && !image) add(r, "missing image", "fix");
    if (image && !alt) add(r, "missing image alt text", "fix");
    if (sku) {
      const price = priceOf(r);
      if (!price || Number(price) === 0) add(r, "blank or zero price", "fix");
      if (hasWeight && !pick(r, ["Variant Weight"])) add(r, "missing weight", "fix");
    }
  }

  issues.sort((a, b) => a.row - b.row || a.issue.localeCompare(b.issue));
  return issues;
}

export function reviewCsv(issues) {
  const lines = ["row,handle,sku,issue,suggestion"];
  for (const i of issues) lines.push([i.row, csvEscape(i.handle), csvEscape(i.sku), csvEscape(i.issue), i.suggestion].join(","));
  return lines.join("\n") + "\n";
}

export function buildSummary(records, issues) {
  const counts = new Map();
  for (const i of issues) {
    const kind = i.kind || i.issue.split(":")[0];
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  const lines = [];
  lines.push("# Catalog audit summary");
  lines.push("");
  lines.push("Product rows checked: " + records.length);
  lines.push("Issues found: " + issues.length);
  lines.push("");
  lines.push("| Issue | Count |");
  lines.push("| --- | --- |");
  for (const [kind, count] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push("| " + kind + " | " + count + " |");
  }
  lines.push("");
  lines.push("This tool only reports. It never modifies, merges or deletes any row. Work through review.csv, decide keep, merge or fix per row in your store admin, then export again and re-run the audit to confirm the list is clear.");
  lines.push("");
  return lines.join("\n");
}

export function auditCsvText(text) {
  const { header, records } = parseCsv(text);
  const issues = auditCatalog(header, records);
  return { header, records, issues, review: reviewCsv(issues), summary: buildSummary(records, issues) };
}

export function loadAndAudit(path) {
  const { header, records } = parseCsv(readFileSync(path, "utf8"));
  return { header, records, issues: auditCatalog(header, records) };
}
