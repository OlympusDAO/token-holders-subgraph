# Token Holders Subgraph

## Intended Uses

- Tracking the number of holders of a particular token
- Tracking the balances of particular token and holder combinations

## Architecture

### Considerations

- The Graph Protocol limits each page to 1000 records and a maximum of 5 pages (5000 records)
- It is not guaranteed that each token holder will have a transaction on every day, so periodic balance calculation is required so that days without transfers still have balances

### Design Principles

- The subgraph should need minimal maintenance
- The subgraph entities should enable users to calculate the metrics they need (i.e. don't try too hard to anticipate the metrics needed)

### Indexing

Indexing takes place in the following circumstances:

- Transfer function call
    - When the `transfer` function is called on any of the tokens, a `TokenHolderTransaction` record is created for each of the sender and receiver.
    - A `TokenHolderBalance` record is created/updated after each transaction, and added to the `TokenDailySnapshot` record for that day.
- Start of day
    - At the start of each day in the UTC timezone, a `TokenDailySnapshot` is created and the `TokenHolderBalance` records from the previous day are copied and added to the `balancesList` property on `TokenDailySnapshot`.
- Every hour
    - The `balancesList` on `TokenDailySnapshot` is de-duplicated, as it is computationally expensive to do so at the time of indexing the transfer function call.
