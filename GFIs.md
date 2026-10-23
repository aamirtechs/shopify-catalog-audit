# Good first issues

These are seeded ideas for first time contributors. All work is offline on synthetic CSV exports, and the review first rule must hold: the tool reports, it never modifies or deletes rows.

## 1. WooCommerce CSV column mapping

WooCommerce exports use different column names for the same ideas, for example SKU, Regular price and a different image column layout. Add a mapping layer that detects or selects a WooCommerce layout and translates it into the internal fields the checks already use, so every existing check works unchanged. Include a small synthetic WooCommerce example, tests for the mapping, and README notes on any WooCommerce field that has no equivalent.

## 2. GTIN checksum validation reusing feed rules

Barcodes that fail their check digit are a quiet cause of rejected listings. Add a check that validates the checksum of common GTIN lengths found in the barcode column and reports rows whose barcode is the right length but fails the checksum, with a fix suggestion. Keep short internal codes out of scope by skipping values that are not plausible GTIN lengths, and add tests with hand computed valid and invalid numbers.

## 3. Image URL format checks (offline, format only)

Add offline format checks for image values: missing scheme, spaces in the URL, a value that is clearly a local file path, and a file extension that is not a common image type. This must stay format only, with no network requests, since the tool promises to work offline on an export. Add tests for each malformed shape and document that reachability is deliberately out of scope.
