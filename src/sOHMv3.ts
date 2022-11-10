import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { TokenHolder } from "../generated/schema";
import { sOHMv3, Transfer } from "../generated/sOHMv3/sOHMv3";
import { CHAIN_ETHEREUM, ERC20_SOHM_V3, getTokenName, STAKING_V3, TYPE_REBASE, TYPE_TRANSFER } from "./constants";
import { updateTokenBalance } from "./handleEvent";
import { toBigInt, toDecimal } from "./helpers/decimalHelper";
import { createOrLoadToken } from "./helpers/tokenHelper";

export function handleTransfer(event: Transfer): void {
    const isFromStakingContract = event.params.from.toHexString().toLowerCase() !== STAKING_V3.toLowerCase();

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
        isFromStakingContract ? true : false, // If it's the staking contract, skip the balance assertion
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
        isFromStakingContract ? true : false, // If it's the staking contract, skip the balance assertion
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
    // Get list of token holders
    const token = createOrLoadToken(Address.fromString(ERC20_SOHM_V3), getTokenName(ERC20_SOHM_V3), CHAIN_ETHEREUM);
    if (!token) {
        throw new Error(`Expected to find Token record for ${ERC20_SOHM_V3}, but it was null.`);
    }

    const tokenAddress = Address.fromString(ERC20_SOHM_V3);
    const sOHMv3Contract = sOHMv3.bind(tokenAddress);
    const sOHMDecimals = sOHMv3Contract.decimals();

    const tokenHolderIds = token.tokenHolders;
    // Iterate through all token holders
    for (let i = 0; i < tokenHolderIds.length; i++) {
        const tokenHolderId = tokenHolderIds[i];
        const tokenHolder = TokenHolder.load(tokenHolderId);
        if (!tokenHolder) {
            throw new Error(`Expected to find TokenHolder for id ${tokenHolderId}, but it was null.`);
        }

        const holderAddress = Address.fromBytes(tokenHolder.holder);

        // Determine the current balance of sOHM reported by the sOHM contract
        const currentBalance = toDecimal(sOHMv3Contract.balanceOf(holderAddress), sOHMDecimals);

        // Determine the previous balance of sOHM
        const previousBalance = tokenHolder.balance;

        const difference = currentBalance.minus(previousBalance);

        // No point in recording a 0 value
        if (difference.equals(BigDecimal.zero())) {
            continue;
        }

        // Mimic a transfer of the difference
        // TODO should there be a decerement of the staking contract?
        updateTokenBalance(tokenAddress, holderAddress, toBigInt(difference, sOHMDecimals), false, block.number, block.timestamp, block.hash, TYPE_REBASE, BigInt.zero());
    }
}