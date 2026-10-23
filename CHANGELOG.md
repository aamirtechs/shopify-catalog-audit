# Changelog

## 1.0.0

First release.

- Audit a Shopify format product CSV export offline, reporting only. The tool never modifies or deletes anything.
- Checks for duplicate SKUs, duplicate barcodes, near duplicate titles, conflicting titles on one handle, orphaned variant rows, missing images, missing image alt text, blank or zero prices and missing weight where a weight column exists.
- Review CSV with row, handle, SKU, issue and a keep, merge or fix suggestion per issue.
- Summary report in Markdown with counts per issue.
- Zero dependencies, library API and CLI.
