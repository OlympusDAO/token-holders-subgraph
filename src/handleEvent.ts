import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { Token, TokenHolder, TokenHolderTransaction } from "../generated/schema";
import { arrayIncludesLoose } from "./helpers/arrayHelper";
import { IGNORED_ADDRESSES, getTokenDecimals, getTokenName, CHAIN_ETHEREUM } from "./constants";
import { getISO8601StringFromTimestamp } from "./helpers/dateHelper";
import { toDecimal } from "./helpers/decimalHelper";
import { createOrLoadToken } from "./helpers/tokenHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

/**
 * Creates or loads a TokenHolder record.
 * 
 * If the TokenHolder is being created, it also adds the id to the `tokenHolders`
 * mapping array on the respective Token record.
 * 
 * @param token 
 * @param address 
 * @returns 
 */
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

  // Add the record id to Token too, so it can be accessed
  // As this is only done at creation time, there are no duplicates
  let existingTokenHolders: string[] = token.tokenHolders;
  existingTokenHolders.push(tokenHolder.id);
  token.tokenHolders = existingTokenHolders;
  token.save();

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
  const token = createOrLoadToken(tokenAddress, tokenName, CHAIN_ETHEREUM);

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
