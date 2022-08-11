import { Address, BigDecimal, BigInt, log, store } from "@graphprotocol/graph-ts";

import { ERC20, Transfer } from "../generated/gOHM/ERC20";
import { TokenBalance } from "../generated/schema";
import { toDecimal } from "./decimalHelper";

// Inspired by: https://github.com/xdaichain/token-holders-subgraph/blob/master/src/mapping.ts

function createTokenBalance(
  entityId: string,
  tokenAddress: Address,
  holderAddress: Address,
): TokenBalance {
  const tokenBalance = new TokenBalance(entityId);
  tokenBalance.owner = holderAddress;
  tokenBalance.tokenName = "gOHM";
  tokenBalance.balance = BigDecimal.zero();

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
