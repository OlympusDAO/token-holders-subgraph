# Token Holders Subgraph

## Intended Uses

## Architecture

### Considerations

- The Graph Protocol limits each page to 1000 records and a maximum of 5 pages (5000 records)
- It is not guaranteed that each token holder will have a transaction on every day, so periodic balance calculation is required so that days without transfers still have balances

### Design Principles

- The subgraph should need minimal maintenance
- The subgraph entities should enable users to calculate the metrics they need (i.e. don't try too hard to anticipate the metrics needed)
