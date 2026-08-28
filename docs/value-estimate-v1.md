# Value Estimate v1

Goal: turn a saved Thing into a useful first euro estimate without pretending that owner-entered data is verified market evidence.

## Inputs
- purchase price in EUR
- purchase year
- condition: LIKE_NEW, GOOD, FAIR, POOR

## Output
The authenticated owner receives a server-calculated estimate. The estimate is stored as value evidence with `source_type = MODEL_V1_OWNER_INPUT` so the UI can distinguish it from future comparable-market evidence.

## Security
- ownership is derived from `auth.uid()`
- the RPC accepts no owner id
- anonymous execution is revoked
- valuation profile tables are not writable directly by mobile clients

## Product language
The UI must call this a model estimate, not a verified market price. Future comparable-market sources can supersede it without changing the inventory/value/sale flow.
