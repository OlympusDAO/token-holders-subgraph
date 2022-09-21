import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { Transfer } from "../generated/gOHM/ERC20";
import { Token, TokenHolder, TokenHolderBalance } from "../generated/schema";
import { arrayIncludesLoose } from "./arrayHelper";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

const ERC20_GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
const NULL = "0x0000000000000000000000000000000000000000";
const IGNORED_ADDRESSES = [ERC20_GOHM, NULL];

export const getISO8601StringFromTimestamp = (timestamp: i64): string => {
  const date = new Date(timestamp);
  return date.toISOString();
};

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

function createTokenHolderBalance(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  block: BigInt,
  timestamp: BigInt,
  transaction: Bytes,
): TokenHolderBalance {
  const unixTimestamp = timestamp.toI64() * 1000;

  const balanceId = `${tokenHolder.id}/${transaction.toHexString()}`;
  const tokenBalance = new TokenHolderBalance(balanceId);
  tokenBalance.block = block;
  tokenBalance.timestamp = unixTimestamp.toString();
  tokenBalance.date = getISO8601StringFromTimestamp(unixTimestamp);
  tokenBalance.balance = balance;
  tokenBalance.transaction = transaction;
  tokenBalance.holder = tokenHolder.id;
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
): void {
  const decimalValue = toDecimal(value);
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
  createTokenHolderBalance(tokenHolder, newBalance, block, timestamp, transaction);

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
  );
  updateTokenBalance(
    event.address,
    event.params.to,
    event.params.value,
    false,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
  );
}
