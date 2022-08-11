import { Address, BigDecimal, BigInt, log, store } from "@graphprotocol/graph-ts";

import { ERC20, Transfer } from "../generated/gOHM/ERC20";
import { HolderBalance, Token, TokenBalance, TokenHolder } from "../generated/schema";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

function createOrLoadToken(address: Address, name: string): Token {
  const loadedToken = Token.load(name);
  if (loadedToken !== null) {
    return loadedToken;
  }

  const token = new Token(name);
  token.address = address;
  token.name = name;
  token.holders = [];
  token.save();

  return token;
}

function createOrLoadTokenHolder(token: Token, address: Address): TokenHolder {
  const holderId = token.id + "/" + address.toHexString();
  const loadedHolder = TokenHolder.load(holderId);
  if (loadedHolder !== null) {
    return loadedHolder;
  }

  const tokenHolder = new TokenHolder(holderId);
  tokenHolder.holder = address;
  tokenHolder.balances = [];
  tokenHolder.save();

  token.holders.push(tokenHolder.id);
  token.save();

  return tokenHolder;
}

function getLatestBalance(tokenHolder: TokenHolder): TokenBalance | null {}

function createHolderBalance(
  tokenHolder: TokenHolder,
  balance: BigDecimal,
  block: BigInt,
): TokenBalance {
  const balanceId = tokenHolder.id + "/" + block.toString();
  const tokenBalance = new HolderBalance(balanceId);
  tokenBalance.block = block;
  tokenBalance.balance = balance;
  tokenBalance.save();

  tokenHolder.balances.push(tokenBalance.id);
  tokenHolder.save();

  return tokenBalance;
}

function updateTokenBalance(
  tokenAddress: Address,
  holderAddress: Address,
  value: BigInt,
  isSender: boolean,
): void {
  // Ignore null address
  if (holderAddress.toHexString().toLowerCase() == "0x0000000000000000000000000000000000000000") {
    return;
  }

  // Get the parent token
  const token = createOrLoadToken(tokenAddress, "gOHM");

  // Get the token holder record
  const tokenHolder = createOrLoadTokenHolder(token, holderAddress);

  // Get the latest balance for the holder

  // Calculate the new balance

  // TODO use map of balances? also store the latest balance

  const entityId = tokenAddress.toHexString() + "-" + holderAddress.toHexString();
  const existingTokenBalance = TokenBalance.load(entityId);
  const tokenBalance =
    existingTokenBalance !== null
      ? existingTokenBalance
      : createTokenBalance(entityId, tokenAddress, holderAddress);

  const decimalValue = toDecimal(value, 18);

  tokenBalance.balance = isSender
    ? tokenBalance.balance.minus(decimalValue)
    : tokenBalance.balance.plus(decimalValue);

  if (tokenBalance.balance.equals(BigDecimal.zero())) {
    store.remove("TokenBalance", entityId);
  } else {
    tokenBalance.save();
  }
}

export function handleTransfer(event: Transfer): void {
  updateTokenBalance(event.address, event.params.from, event.params.value, true);
  updateTokenBalance(event.address, event.params.to, event.params.value, false);
}
