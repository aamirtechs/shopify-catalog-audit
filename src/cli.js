#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { loadAndAudit, reviewCsv, buildSummary } from "./audit.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.out) {
    console.error("Usage: shopify-catalog-audit --input products.csv --out review.csv [--report report.md]");
    process.exit(1);
  }
  const { records, issues } = loadAndAudit(args.input);
  writeFileSync(args.out, reviewCsv(issues));
  const summary = buildSummary(records, issues);
  if (args.report) writeFileSync(args.report, summary); else process.stdout.write(summary);
  console.log("Checked " + records.length + " row(s), found " + issues.length + " issue(s). Wrote " + args.out + (args.report ? " and " + args.report : "") + ". Nothing was modified or deleted.");
}
main();
