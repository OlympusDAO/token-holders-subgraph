import { Address } from "@graphprotocol/graph-ts";
import { Token, TokenHolder } from "../generated/schema";
import { RebaseCall, sOHMv3, Transfer } from "../generated/sOHMv3/sOHMv3";
import { CHAIN_ETHEREUM, ERC20_SOHM_V3, TYPE_REBASE, TYPE_TRANSFER } from "./constants";
import { updateTokenBalance } from "./handleEvent";
import { toBigInt, toDecimal } from "./helpers/decimalHelper";
import { getTokenId } from "./helpers/tokenHelper";

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

export function handleRebase(event: RebaseCall): void {
    // Get list of token holders
    const token = Token.load(getTokenId(ERC20_SOHM_V3, CHAIN_ETHEREUM));
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

        // Mimic a transfer of the difference
        // TODO should there be a decerement of the staking contract?
        updateTokenBalance(tokenAddress, holderAddress, toBigInt(difference, sOHMDecimals), false, event.block.number, event.block.timestamp, event.transaction.hash, TYPE_REBASE, event.transaction.index);
    }
}