import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { Transfer } from "../generated/gOHM/gOHM";
import { Token, TokenHolder, TokenHolderTransaction } from "../generated/schema";
import { arrayIncludesLoose } from "./arrayHelper";
import { IGNORED_ADDRESSES, getTokenDecimals, getTokenName, TYPE_TRANSFER } from "./constants";
import { getISO8601StringFromTimestamp } from "./dateHelper";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

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
  const balanceId = `${tokenHolder.id
    }/${transaction.toHexString()}/${transactionLogIndex.toString()}`;
  const tokenBalance = new TokenHolderTransaction(balanceId);
  tokenBalance.balance = balance;
  tokenBalance.block = block;
  tokenBalance.date = getISO8601StringFromTimestamp(timestamp);
  tokenBalance.holder = tokenHolder.id;
  tokenBalance.previousBalance = tokenHolder.balance;
  tokenBalance.timestamp = timestamp.toString();
  tokenBalance.transaction = transaction;
  tokenBalance.transactionLogIndex = transactionLogIndex;
  tokenBalance.type = type;
  tokenBalance.value = value;
  tokenBalance.save();

  return tokenBalance;
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

  // Create a new balance record
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
