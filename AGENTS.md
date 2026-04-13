# AGENTS.md

## Project Overview

This repository contains a token indexing subgraph for OHM, gOHM, and related token holder or transfer state across supported contracts.

## Node and Tooling

- Node.js must use version 24+.
- Use `.nvmrc` and `.node-version` files for version alignment.
- Run `pnpm install --frozen-lockfile` before dependency-dependent work.

## Common Commands

- `pnpm install --frozen-lockfile`: install dependencies
- `pnpm run lint` or repository lint equivalent: run project lint checks
- `pnpm run build` or repository build equivalent: validate builds succeed
- `pnpm test` or repository test equivalent: validate behavior changes
