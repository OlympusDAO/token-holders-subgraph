import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

import { Transfer } from "../generated/gOHM/ERC20";
import { Token, TokenHolder, TokenHolderBalance } from "../generated/schema";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

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
  tokenHolder.balance = BigInt.zero();
  tokenHolder.token = token.id;
  tokenHolder.save();

  return tokenHolder;
}

function createTokenHolderBalance(
  tokenHolder: TokenHolder,
  balance: BigInt,
  block: BigInt,
  timestamp: BigInt,
  transaction: Bytes,
  value: BigInt,
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
): void {
  // Ignore null address
  if (holderAddress.toHexString().toLowerCase() == "0x0000000000000000000000000000000000000000") {
    return;
  }

  // Get the parent token
  const token = createOrLoadToken(tokenAddress, "gOHM", "Ethereum");

  // Get the token holder record
  const tokenHolder = createOrLoadTokenHolder(token, holderAddress);

  // Calculate the new balance
  const adjustedValue = isSender ? BigInt.fromString("-1").times(value) : value;
  const newBalance = tokenHolder.balance.plus(adjustedValue);

  // Create a new balance record
  createTokenHolderBalance(tokenHolder, newBalance, block, timestamp, transaction, adjustedValue);

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
