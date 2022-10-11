import { Address, BigDecimal, BigInt, Bytes, ethereum, log, store } from "@graphprotocol/graph-ts";

import { BurnCall, MintCall, Transfer } from "../generated/gOHM/gOHM";
import { Token, TokenDailySnapshot, TokenHolder, TokenHolderBalance, TokenHolderTransaction } from "../generated/schema";
import { arrayIncludesLoose } from "./arrayHelper";
import { getISO8601DateStringFromTimestamp, getISO8601StringFromTimestamp } from "./dateHelper";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

const ERC20_GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
const ERC20_OHM_V1 = "0x383518188c0c6d7730d91b2c03a03c837814a899";
const ERC20_SOHM_V1 = "0x04F2694C8fcee23e8Fd0dfEA1d4f5Bb8c352111F";
const ERC20_OHM_V2 = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const ERC20_SOHM_V2 = "0x04906695D6D12CF5459975d7C3C03356E4Ccd460";

const NULL = "0x0000000000000000000000000000000000000000";
const IGNORED_ADDRESSES = [
  ERC20_GOHM,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_SOHM_V1,
  ERC20_SOHM_V2,
  NULL,
];

const TYPE_TRANSFER = "TRANSFER";
const TYPE_MINT = "MINT";
const TYPE_BURN = "BURN";

const TOKENS = new Map<string, string>();
TOKENS.set(ERC20_GOHM.toLowerCase(), "gOHM");
TOKENS.set(ERC20_OHM_V1.toLowerCase(), "OHM V1");
TOKENS.set(ERC20_SOHM_V1.toLowerCase(), "sOHM V1");
TOKENS.set(ERC20_OHM_V2.toLowerCase(), "OHM V2");
TOKENS.set(ERC20_SOHM_V2.toLowerCase(), "sOHM V2");

function getTokenName(address: string): string {
  if (!TOKENS.has(address.toLowerCase())) {
    return "";
  }

  return TOKENS.get(address.toLowerCase());
}

const TOKEN_DECIMALS = new Map<string, string>();
TOKEN_DECIMALS.set(ERC20_GOHM.toLowerCase(), "18");
TOKEN_DECIMALS.set(ERC20_OHM_V1.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_SOHM_V1.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_OHM_V2.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_SOHM_V2.toLowerCase(), "9");

function getTokenDecimals(address: string): number {
  if (!TOKEN_DECIMALS.has(address.toLowerCase())) {
    return -1;
  }

  return parseInt(TOKEN_DECIMALS.get(address.toLowerCase()));
}

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

function getDailySnapshotId(timestamp: i64, token: Token): string {
  const dateString = getISO8601DateStringFromTimestamp(timestamp);
  return `${token.id}/${dateString}`;
}

function getDailySnapshot(timestamp: i64, token: Token): TokenDailySnapshot | null {
  return TokenDailySnapshot.load(getDailySnapshotId(timestamp, token));
}

function createOrLoadTokenDailySnapshot(timestamp: i64, token: Token): TokenDailySnapshot {
  const snapshotId = getDailySnapshotId(timestamp, token);
  const dateString = getISO8601DateStringFromTimestamp(timestamp);
  
  const loadedSnapshot = TokenDailySnapshot.load(snapshotId);
  if (loadedSnapshot !== null) {
    return loadedSnapshot;
  }

  const snapshot = new TokenDailySnapshot(snapshotId);
  snapshot.date = dateString;
  snapshot.token = token.id;
  snapshot.balancesList = [];
  snapshot.save();

  return snapshot;
}

function createTokenHolderTransaction(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  value: BigDecimal,
  block: BigInt,
  timestamp: i64,
  transaction: Bytes,
  type: string,
  transactionLogIndex: BigInt,
): TokenHolderTransaction {
  // The balanceId incorporates the transactionLogIndex, so that multiple transfers within a single transaction can be recorded
  const transactionId = `${
    tokenHolder.id
    }/${transaction.toHexString()}/${transactionLogIndex.toString()}`;
  const transactionRecord = new TokenHolderTransaction(transactionId);
  transactionRecord.balance = balance;
  transactionRecord.block = block;
  transactionRecord.date = getISO8601StringFromTimestamp(timestamp);
  transactionRecord.holder = tokenHolder.id;
  transactionRecord.previousBalance = tokenHolder.balance;
  transactionRecord.timestamp = timestamp.toString();
  transactionRecord.transaction = transaction;
  transactionRecord.transactionLogIndex = transactionLogIndex;
  transactionRecord.type = type;
  transactionRecord.value = value;
  transactionRecord.save();

  return transactionRecord;
}

function getHolderBalanceId(timestamp: i64, tokenHolder: TokenHolder): string {
  return `${tokenHolder.id}/${getISO8601DateStringFromTimestamp(timestamp)}`;
}

function getHolderBalanceIdOnDate(balanceId: string, timestamp: i64): string {
  // Strip the date and separator (/YYYY-MM-DD) from the existing balance id
  const strippedBalanceId = balanceId.slice(0, -11);
  return `${strippedBalanceId}/${getISO8601DateStringFromTimestamp(timestamp)}`;
}

function getHolderBalance(timestamp: i64, tokenHolder: TokenHolder): TokenHolderBalance | null {
  return TokenHolderBalance.load(getHolderBalanceId(timestamp, tokenHolder));
}

function createTokenHolderBalance(balanceId: string, date: string, holderId: string, balance: BigDecimal): TokenHolderBalance {
  const balanceRecord = new TokenHolderBalance(balanceId);
  balanceRecord.date = date;
  balanceRecord.holder = holderId;
  balanceRecord.balance = balance;
  balanceRecord.save();

  return balanceRecord;
}

function createOrLoadTokenHolderBalance(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  timestamp: i64,
): TokenHolderBalance {
  const balanceId = getHolderBalanceId(timestamp, tokenHolder);
  const loadedBalance = TokenHolderBalance.load(balanceId);
  if (loadedBalance) {
    return loadedBalance;
  }

  return createTokenHolderBalance(balanceId, getISO8601DateStringFromTimestamp(timestamp), tokenHolder.id, balance);
}

export function updateTokenBalance(
  tokenAddress: Address,
  holderAddress: Address,
  value: BigInt,
  isSender: boolean,
  block: BigInt,
  timestamp: BigInt,
  transaction: Bytes,
  transactionType: string,
  transactionLogIndex: BigInt,
): void {
  if (arrayIncludesLoose(IGNORED_ADDRESSES, holderAddress.toHexString())) {
    log.debug("holder {} is on ignore list. Skipping", [holderAddress.toHexString()]);
    return;
  }

  const tokenDecimals = getTokenDecimals(tokenAddress.toHexString());
  assert(tokenDecimals !== -1, "Could not find token decimals for " + tokenAddress.toHexString());
  const decimalValue = toDecimal(value, tokenDecimals);

  const unixTimestamp = timestamp.toI64() * 1000;
  log.debug(
    "updateTokenBalance: token {}, holder {}, value {}, isSender {}, type {}, transaction {}, logIndex {}",
    [
      tokenAddress.toHexString(),
      holderAddress.toHexString(),
      decimalValue.toString(),
      isSender ? "true" : "false",
      transactionType,
      transaction.toHexString(),
      transactionLogIndex.toString(),
    ],
  );

  const tokenName = getTokenName(tokenAddress.toHexString());
  assert(tokenName.length > 0, "Could not find token name for " + tokenAddress.toHexString()); // Fail loudly during indexing if we can't get the token name

  // Get the parent token
  const token = createOrLoadToken(tokenAddress, tokenName, "Ethereum");

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

  // Create a new transaction record
  createTokenHolderTransaction(
    tokenHolder,
    newBalance,
    adjustedValue,
    block,
    unixTimestamp,
    transaction,
    transactionType,
    transactionLogIndex,
  );

  // Update the TokenHolder
  tokenHolder.balance = newBalance;
  tokenHolder.save();

  // We don't bother to save 0 balances
  if (newBalance.equals(BigDecimal.zero())) {
    // Delete the existing holder balance
    const balanceRecord = getHolderBalance(unixTimestamp, tokenHolder);
    if (balanceRecord) {
      store.remove("TokenHolderBalance", balanceRecord.id);
    }

    // Remove from snapshot
    const dailySnapshot = getDailySnapshot(unixTimestamp, token);
    if (dailySnapshot && balanceRecord) {
      const balancesList = dailySnapshot.balancesList;
      const balanceRecordIndex = balancesList.indexOf(balanceRecord.id);
      if (balanceRecordIndex > -1) {
        balancesList.splice(balanceRecordIndex, 1);
      }
      dailySnapshot.balancesList = balancesList;
      dailySnapshot.save();
    }

    return;
  }

  // Create or update the balance
  const balanceRecord = createOrLoadTokenHolderBalance(tokenHolder, newBalance, unixTimestamp);
  balanceRecord.balance = newBalance;
  balanceRecord.save();

  // Create or uppdate the daily snapshot
  const dailySnapshot = createOrLoadTokenDailySnapshot(unixTimestamp, token);
  const balancesList = dailySnapshot.balancesList;

  // Only add balanceRecord if it doesn't exist
  // TODO consider a more efficient approach
  if (!balancesList.includes(balanceRecord.id)) {
    balancesList.push(balanceRecord.id);
  }

  dailySnapshot.balancesList = balancesList;
  dailySnapshot.save();
}

function stringArrayToMap(array: string[]): Map<string, string> {
  const newMap = new Map<string, string>();
  for (let i = 0; i < array.length; i++) {
    newMap.set(array[i], array[i]);
  }

  return newMap;
}

export function backfill(timestamp: BigInt, token: Token): void {
  const unixTimestamp = timestamp.toI64() * 1000;
  log.info("Performing backfill at date {} for token {}", [getISO8601DateStringFromTimestamp(unixTimestamp), token.name]);
  const dayMilliseconds = 86400 * 1000;

  // Grab the previous daily snapshot
  const previousSnapshot = createOrLoadTokenDailySnapshot(unixTimestamp - dayMilliseconds, token);
  const previousSnapshotBalanceList = previousSnapshot ? previousSnapshot.balancesList : [];

  // Grab the daily snapshot
  const currentSnapshot = getDailySnapshot(unixTimestamp, token);
  
  // If there's no daily snapshot, we copy the balance list from the previous day
  if (!currentSnapshot) {
    log.debug("No snapshot for the current day. Copying from the previous day.", []);
    const newSnapshot = createOrLoadTokenDailySnapshot(unixTimestamp, token);
    const newSnapshotBalancesList: string[] = [];

    for (let i = 0; i < previousSnapshotBalanceList.length; i++) {
      const previousBalanceId = previousSnapshotBalanceList[i];
      const previousBalance = TokenHolderBalance.load(previousBalanceId);
      if (!previousBalance) {
        throw new Error("Expected to find TokenHolderBalance with id " + previousBalanceId + ", but could not");
      }

      // previousBalanceId contains the date, so we need to convert to today's date
      const newBalanceId = getHolderBalanceIdOnDate(previousBalanceId, unixTimestamp);
      createTokenHolderBalance(newBalanceId, getISO8601DateStringFromTimestamp(unixTimestamp), previousBalance.holder, previousBalance.balance);
      newSnapshotBalancesList.push(newBalanceId);
    }

    newSnapshot.balancesList = newSnapshotBalancesList;
    newSnapshot.save();
  }
  // Otherwise anything missing from the previous day is added
  // This is because the snapshot could be created from a transaction before backfill is performed
  else {
    log.debug("Snapshot exists. Performing backfill from previous day.", []);
    const balanceMap = stringArrayToMap(currentSnapshot.balancesList);

    for (let i = 0; i < previousSnapshotBalanceList.length; i++) {
      const previousBalanceId = previousSnapshotBalanceList[i];
      const previousBalance = TokenHolderBalance.load(previousBalanceId);
      if (!previousBalance) {
        throw new Error("Expected to find TokenHolderBalance with id " + previousBalanceId + ", but could not");
      }

      const newBalanceId = getHolderBalanceIdOnDate(previousBalanceId, unixTimestamp);
      // If there is already a balance for today, no need for action
      if (balanceMap.has(newBalanceId)) {
        continue;
      }

      createTokenHolderBalance(newBalanceId, getISO8601DateStringFromTimestamp(unixTimestamp), previousBalance.holder, previousBalance.balance);
      balanceMap.set(newBalanceId, newBalanceId);
    }

    currentSnapshot.balancesList = balanceMap.values();
    currentSnapshot.save();
  }
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
    event.transactionLogIndex,
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
    event.transactionLogIndex,
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
    BigInt.fromString("0"),
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
    BigInt.fromString("0"),
  );
}

function handleBlock(block: ethereum.Block, token: Token): void {
  // Perform backfill at 00:01
  const date = new Date(block.timestamp.toI64() * 1000);
  if (!(date.getUTCHours() === 0 && date.getUTCMinutes() === 1)) {
    return;
  }

  backfill(block.timestamp, token);
}

export function handleGOhmBlock(block: ethereum.Block): void {
  const token = createOrLoadToken(Address.fromString(ERC20_GOHM), getTokenName(ERC20_GOHM), "Ethereum");
  handleBlock(block, token);
}

export function handleOhmV2Block(block: ethereum.Block): void {
  const token = createOrLoadToken(Address.fromString(ERC20_OHM_V2), getTokenName(ERC20_OHM_V2), "Ethereum");
  handleBlock(block, token);
}
