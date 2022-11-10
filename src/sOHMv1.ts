import { RebaseCall, Transfer } from "../generated/sOHMv1/sOHMv1";
import { TYPE_TRANSFER } from "./constants";
import { updateTokenBalance } from "./handleEvent";

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
    // Determine the current balance of sOHM

    // Determine the previous balance of sOHM

    // Mimic a transfer of the difference
}