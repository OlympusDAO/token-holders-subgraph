import { Transfer } from "../generated/OHMv2/ERC20";
import { TYPE_TRANSFER } from "./constants";
import { updateTokenBalance } from "./handleEvent";

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