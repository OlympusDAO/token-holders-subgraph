# Token Holders Subgraph

## Intended Uses

- Tracking the number of holders of a particular token
- Tracking the balances of particular token and holder combinations

## Architecture

### Considerations

- Calculating daily balances within a subgraph is currently prohibitively slow, so this is outsourced to the Google Cloud Function deployed by the [token-holder-balances](https://github.com/OlympusDAO/token-holder-balances) repo.

### Design Principles

- The subgraph should need minimal maintenance
- The subgraph entities should enable users to calculate the metrics they need (i.e. don't try too hard to anticipate the metrics needed)

### Indexing

Indexing takes place in the following circumstances:

- Transfer function call
    - When the `transfer` function is called on any of the tokens, a `TokenHolderTransaction` record is created for each of the sender and receiver.
