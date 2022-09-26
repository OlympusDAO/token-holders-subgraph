import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { BurnCall, MintCall, Transfer } from "../generated/gOHM/gOHM";
import {
  Token,
  TokenHolder,
  TokenHolderSnapshot,
  TokenHolderTransaction,
} from "../generated/schema";
import { arrayIncludesLoose } from "./arrayHelper";
import {
  getDaysBetween,
  getISO8601DateStringFromTimestamp,
  getISO8601StringFromTimestamp,
} from "./dateHelper";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

const ERC20_GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
const NULL = "0x0000000000000000000000000000000000000000";
const IGNORED_ADDRESSES = [ERC20_GOHM, NULL];

const TYPE_TRANSFER = "TRANSFER";
const TYPE_MINT = "MINT";
const TYPE_BURN = "BURN";

function createOrLoadToken(address: Address, name: string, blockchain: string): Token {
  const tokenId = `${name}/${blockchain}`;
  const loadedToken = Token.load(tokenId);
  if (loadedToken !== null) {
    return loadedToken;
  }

  const token = new Token(tokenId);
  token.address = address;
  token.name = name;
  token.blockchain = blockchain;
  token.save();

  return token;
}

function createOrLoadTokenHolderSnapshot(
  tokenHolder: TokenHolder,
  timestamp: i64,
  balance: BigDecimal,
): TokenHolderSnapshot {
  const date = getISO8601DateStringFromTimestamp(timestamp);
  const snapshotId = `${tokenHolder.id}/${date}`;
  const loadedSnapshot = TokenHolderSnapshot.load(snapshotId);
  if (loadedSnapshot != null) {
    return loadedSnapshot;
  }

  const snapshot = new TokenHolderSnapshot(snapshotId);
  snapshot.holder = tokenHolder.id;
  snapshot.date = date;
  snapshot.balance = balance;

  snapshot.save();

  return snapshot;
}

function createOrLoadTokenHolder(token: Token, address: Address): TokenHolder {
  const holderId = `${token.id}/${address.toHexString()}`;
  const loadedHolder = TokenHolder.load(holderId);
  if (loadedHolder !== null) {
    return loadedHolder;
  }

  const tokenHolder = new TokenHolder(holderId);
  tokenHolder.holder = address;
  tokenHolder.balance = BigDecimal.zero();
  tokenHolder.token = token.id;
  tokenHolder.save();

  return tokenHolder;
}

function createTokenHolderTransfer(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  value: BigDecimal,
  block: BigInt,
  timestamp: i64,
  transaction: Bytes,
  type: string,
): TokenHolderTransaction {
  const balanceId = `${tokenHolder.id}/${transaction.toHexString()}`;
  const tokenBalance = new TokenHolderTransaction(balanceId);
  tokenBalance.balance = balance;
  tokenBalance.block = block;
  tokenBalance.date = getISO8601StringFromTimestamp(timestamp);
  tokenBalance.holder = tokenHolder.id;
  tokenBalance.previousBalance = tokenHolder.balance;
  tokenBalance.timestamp = timestamp.toString();
  tokenBalance.transaction = transaction;
  tokenBalance.type = type;
  tokenBalance.value = value;
  tokenBalance.save();

  return tokenBalance;
}

function createTokenHolderSnapshots(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  timestamp: i64,
): void {
  const newSnapshotDate = new Date(timestamp);

  // Grab the latest snapshot
  const latestSnapshotId = tokenHolder.latestSnapshot;
  if (latestSnapshotId !== null) {
    const latestSnapshot = TokenHolderSnapshot.load(latestSnapshotId);
    if (latestSnapshot !== null) {
      // Create snapshots for the days in between
      const latestSnapshotDate = Date.parse(latestSnapshot.date);
      const daysBetween = getDaysBetween(latestSnapshotDate, newSnapshotDate);

      for (let i = 1; i < daysBetween; i++) {
        const currentDate = new Date(latestSnapshotDate.getTime() + i * 24 * 60 * 60 * 1000);
        createOrLoadTokenHolderSnapshot(tokenHolder, currentDate.getTime(), latestSnapshot.balance);
      }
    }
  }

  // Fetch or create the snapshot for the current day
  const currentSnapshot = createOrLoadTokenHolderSnapshot(tokenHolder, timestamp, balance);

  // Set latest snapshot
  tokenHolder.latestSnapshot = currentSnapshot.id;
  tokenHolder.save();
}

function updateTokenBalance(
  tokenAddress: Address,
  holderAddress: Address,
  value: BigInt,
  isSender: boolean,
  block: BigInt,
  timestamp: BigInt,
  transaction: Bytes,
  transactionType: string,
): void {
  const decimalValue = toDecimal(value);
  const unixTimestamp = timestamp.toI64() * 1000;
  log.debug("updateTokenBalance: token {}, holder {}, value {}, isSender {}", [
    tokenAddress.toHexString(),
    holderAddress.toHexString(),
    decimalValue.toString(),
    isSender ? "true" : "false",
  ]);
  if (arrayIncludesLoose(IGNORED_ADDRESSES, holderAddress.toHexString())) {
    log.debug("holder {} is on ignore list. Skipping", [holderAddress.toHexString()]);
    return;
  }

  // Get the parent token
  const token = createOrLoadToken(tokenAddress, "gOHM", "Ethereum");

  // Get the token holder record
  const tokenHolder = createOrLoadTokenHolder(token, holderAddress);
  log.debug("existing balance for holder {} = {}", [
    holderAddress.toHexString(),
    tokenHolder.balance.toString(),
  ]);

  // Calculate the new balance
  const adjustedValue = isSender ? BigDecimal.fromString("-1").times(decimalValue) : decimalValue;
  const newBalance = tokenHolder.balance.plus(adjustedValue);
  assert(
    newBalance.ge(BigDecimal.zero()),
    "Balance should be >= 0, but was " + newBalance.toString(),
  );

  // Create a new balance record
  createTokenHolderTransfer(
    tokenHolder,
    newBalance,
    adjustedValue,
    block,
    unixTimestamp,
    transaction,
    transactionType,
  );

  // Create balance snapshots
  createTokenHolderSnapshots(tokenHolder, newBalance, unixTimestamp);

  // Update the TokenHolder
  tokenHolder.balance = newBalance;
  tokenHolder.save();
}

export function handleTransfer(event: Transfer): void {
  updateTokenBalance(
    event.address,
    event.params.from,
    event.params.value,
    true,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    TYPE_TRANSFER,
  );
  updateTokenBalance(
    event.address,
    event.params.to,
    event.params.value,
    false,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    TYPE_TRANSFER,
  );
}

export function handleMint(call: MintCall): void {
  updateTokenBalance(
    call.to,
    call.inputs._to,
    call.inputs._amount,
    false,
    call.block.number,
    call.block.timestamp,
    call.transaction.hash,
    TYPE_MINT,
  );
}

export function handleBurn(call: BurnCall): void {
  updateTokenBalance(
    call.to,
    call.inputs._from,
    call.inputs._amount,
    true,
    call.block.number,
    call.block.timestamp,
    call.transaction.hash,
    TYPE_BURN,
  );
}
