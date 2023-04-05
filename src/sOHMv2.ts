import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { TokenHolder } from "../generated/schema";
import { sOHMv2, Transfer } from "../generated/sOHMv2/sOHMv2";
import { CHAIN_ETHEREUM, ERC20_SOHM_V2, getTokenName, STAKING_V2, TYPE_REBASE, TYPE_TRANSFER } from "./constants";
import { updateTokenBalance } from "./handleEvent";
import { toBigInt, toDecimal } from "./helpers/decimalHelper";
import { createOrLoadToken } from "./helpers/tokenHelper";

export function handleTransfer(event: Transfer): void {
    updateTokenBalance(
        event.address,
        event.params.from,
        event.params.from,
        event.params.to,
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
        event.params.from,
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

/**
 * Records the rebase rewards every 8 hours.
 * 
 * The rebase function call cannot be used, as it is called every
 * time a wallet stakes, leading to too many records and slow indexing.
 * 
 * @param block 
 * @returns 
 */
export function handleBlock(block: ethereum.Block): void {
    // Every 24 hours
    if (block.number.mod(BigInt.fromI32(24 * 60 * 60 / 12)).notEqual(BigInt.zero())) {
        return;
    }

    // Get list of token holders
    const currentToken = ERC20_SOHM_V2;
    const tokenAddress = Address.fromString(currentToken);
    const token = createOrLoadToken(tokenAddress, getTokenName(currentToken), CHAIN_ETHEREUM);
    if (!token) {
        throw new Error(`Expected to find Token record for ${currentToken}, but it was null.`);
    }

    const sOHMv2Contract = sOHMv2.bind(tokenAddress);
    const sOHMDecimals = sOHMv2Contract.decimals();

    const tokenHolderIds = token.tokenHolders;
    if (!tokenHolderIds || tokenHolderIds.length === 0) {
        log.warning("Skipping empty or null token holder ids for token {} at block {}", [currentToken, block.number.toString()]);
        return;
    }

    // Iterate through all token holders
    for (let i = 0; i < tokenHolderIds.length; i++) {
        const tokenHolderId = tokenHolderIds[i];
        // In case a null value creeps in
        if (!tokenHolderId) {
            continue;
        }

        const tokenHolder = TokenHolder.load(tokenHolderId);
        if (!tokenHolder) {
            throw new Error(`Expected to find TokenHolder for id ${tokenHolderId}, but it was null.`);
        }

        const holderAddress = Address.fromBytes(tokenHolder.holder);

        // Determine the current balance of sOHM reported by the sOHM contract
        const currentBalance = toDecimal(sOHMv2Contract.balanceOf(holderAddress), sOHMDecimals);

        // Determine the previous balance of sOHM
        const previousBalance = tokenHolder.balance;

        const difference = currentBalance.minus(previousBalance);

        // No point in recording a 0 value
        if (difference.equals(BigDecimal.zero())) {
            continue;
        }

        // Mimic a transfer of the difference
        // TODO should there be a decerement of the staking contract?
        updateTokenBalance(tokenAddress, holderAddress, Address.fromString(STAKING_V2), holderAddress, toBigInt(difference, sOHMDecimals), false, block.number, block.timestamp, block.hash, TYPE_REBASE, BigInt.zero());
    }
}