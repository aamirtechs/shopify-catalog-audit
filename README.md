# shopify-catalog-audit
Live page: https://aamirtechs.github.io/shopify-catalog-audit/
Use it in your browser: the Pages site above runs the full tool locally, no install needed.

Audit a Shopify or WooCommerce product CSV export for the catalog problems that cost sales: duplicate SKUs and barcodes, near duplicate titles, orphaned variant rows, missing images, prices and alt text. Get a review first fix list. Never auto-deletes.

## Why

Catalog exports rot quietly. The same SKU lands on two products, a barcode gets reused, a variant row loses its parent product, a bestseller sits at a zero price with no image alt text. Each one costs sales or breaks a downstream feed, and none of them show up until someone reads the whole export. This tool reads it for you and returns a short review list, one row per problem, with a suggested action. It only reports. Fixing stays a human decision in the store admin, which is deliberate: a cleanup tool that deletes on its own is how good products disappear.

## Install

Requires Node.js 20 or later. No dependencies.

```bash
git clone https://github.com/aamirtechs/shopify-catalog-audit.git
cd shopify-catalog-audit
node src/cli.js --input examples/products.csv --out review.csv --report report.md
```

## Input

A Shopify format product CSV export. The audit reads these columns: Handle, Title, Variant SKU, Variant Barcode, Variant Price (or Price), Variant Weight when present, Image Src, Image Alt Text, plus the option value columns which it ignores. One row per variant, exactly as Shopify exports it, with the title only on the first row of each product.

## Checks

- Duplicate SKU across rows, and duplicate barcode across rows. The first occurrence is treated as the original, later rows are merge suggestions.
- Near duplicate titles across different handles, by normalised word overlap (punctuation and case ignored, similarity threshold 0.8).
- Same handle carrying more than one different title.
- Orphaned variant rows: a handle whose rows never include a titled parent row.
- Missing image on a titled product row.
- Missing image alt text where an image is present.
- Blank or zero price on a variant row.
- Missing weight on a variant row, only when the export has a weight column at all.

## Usage

```bash
node src/cli.js --input products.csv --out review.csv --report report.md
```

## Example

Input, `examples/products.csv`, a small synthetic catalog with one of most problems planted in it:

```csv
Handle,Title,Variant SKU,Variant Barcode,Variant Price,Variant Weight,Image Src,Image Alt Text,Option1 Value
blue-cotton-tee,Blue Cotton T-Shirt,TEE-BLU-M,8901001001,19.99,0.20,https://example.com/images/tee-blue.jpg,Blue cotton t-shirt front,Medium
blue-cotton-tee,,TEE-BLU-L,8901001002,19.99,0.22,,,Large
blue-cotton-tshirt,Blue Cotton T Shirt,TEE-BLU-M,8901001003,18.99,0.20,https://example.com/images/tee-blue-2.jpg,,Medium
red-wool-scarf,Red Wool Scarf,SCARF-RED,8901001001,24.50,0.15,https://example.com/images/scarf-red.jpg,Red wool scarf,One Size
red-wool-scarf,Red Wool Scarf Deluxe,SCARF-RED-2,8901001004,26.00,0.16,https://example.com/images/scarf-red-2.jpg,Red wool scarf deluxe,One Size
mystery-variant,,VAR-ORPHAN-1,8901001005,9.99,0.10,,,Small
plain-mug,Plain Ceramic Mug,MUG-PLAIN,8901001006,0,,https://example.com/images/mug.jpg,,Standard
trail-shoes,Trail Running Shoes,SHOE-TRAIL-9,8901001007,59.99,0.80,,,UK 9
```

Real output, `review.csv`:

```csv
row,handle,sku,issue,suggestion
4,blue-cotton-tshirt,TEE-BLU-M,duplicate SKU: TEE-BLU-M (first seen on row 2),merge
4,blue-cotton-tshirt,TEE-BLU-M,missing image alt text,fix
4,blue-cotton-tshirt,TEE-BLU-M,near-duplicate title of handle blue-cotton-tee: Blue Cotton T-Shirt,merge
5,red-wool-scarf,SCARF-RED,conflicting titles for handle: Red Wool Scarf / Red Wool Scarf Deluxe,fix
5,red-wool-scarf,SCARF-RED,duplicate barcode: 8901001001 (first seen on row 2),merge
6,red-wool-scarf,SCARF-RED-2,conflicting titles for handle: Red Wool Scarf / Red Wool Scarf Deluxe,fix
7,mystery-variant,VAR-ORPHAN-1,orphaned variant row: handle has no parent title row,fix
8,plain-mug,MUG-PLAIN,blank or zero price,fix
8,plain-mug,MUG-PLAIN,missing image alt text,fix
8,plain-mug,MUG-PLAIN,missing weight,fix
9,trail-shoes,SHOE-TRAIL-9,missing image,fix
```

Suggestions mean: `merge` for duplicates a human should probably combine, `fix` for rows that need a value corrected or filled in. A `keep` decision is yours to record while reviewing; the tool never writes it for you and never changes the input file.

Real summary, `report.md`:

```markdown
# Catalog audit summary

Product rows checked: 8
Issues found: 11

| Issue | Count |
| --- | --- |
| conflicting titles for handle | 2 |
| missing image alt text | 2 |
| blank or zero price | 1 |
| duplicate barcode | 1 |
| duplicate SKU | 1 |
| missing image | 1 |
| missing weight | 1 |
| near-duplicate title | 1 |
| orphaned variant row | 1 |

This tool only reports. It never modifies, merges or deletes any row. Work through review.csv, decide keep, merge or fix per row in your store admin, then export again and re-run the audit to confirm the list is clear.
```

## Library API

```js
import { parseCsv, auditCatalog, buildSummary } from "./src/audit.js";

const { header, records } = parseCsv(csvText);
const issues = auditCatalog(header, records);
console.log(issues.length, buildSummary(records, issues));
```

## Tests

```bash
npm test
```

## License

MIT, see LICENSE.
