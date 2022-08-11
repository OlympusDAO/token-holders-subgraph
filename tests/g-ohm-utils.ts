import { value Address, value BigInt, value ethereum } from "@graphprotocol/graph-ts";
import { value newMockEvent } from "matchstick-as";

import {
  value Approval,
  value DelegateChanged,
  value DelegateVotesChanged,
  value Transfer,
} from "../generated/gOHM/gOHM";

export function createApprovalEvent(owner: Address, spender: Address, value: BigInt): Approval {
  const approvalEvent = changetype<Approval>(newMockEvent());

  approvalEvent.parameters = [];

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("spender", ethereum.Value.fromAddress(spender)),
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)),
  );

  return approvalEvent;
}

export function createDelegateChangedEvent(
  delegator: Address,
  fromDelegate: Address,
  toDelegate: Address,
): DelegateChanged {
  const delegateChangedEvent = changetype<DelegateChanged>(newMockEvent());

  delegateChangedEvent.parameters = [];

  delegateChangedEvent.parameters.push(
    new ethereum.EventParam("delegator", ethereum.Value.fromAddress(delegator)),
  );
  delegateChangedEvent.parameters.push(
    new ethereum.EventParam("fromDelegate", ethereum.Value.fromAddress(fromDelegate)),
  );
  delegateChangedEvent.parameters.push(
    new ethereum.EventParam("toDelegate", ethereum.Value.fromAddress(toDelegate)),
  );

  return delegateChangedEvent;
}

export function createDelegateVotesChangedEvent(
  delegate: Address,
  previousBalance: BigInt,
  newBalance: BigInt,
): DelegateVotesChanged {
  const delegateVotesChangedEvent = changetype<DelegateVotesChanged>(newMockEvent());

  delegateVotesChangedEvent.parameters = [];

  delegateVotesChangedEvent.parameters.push(
    new ethereum.EventParam("delegate", ethereum.Value.fromAddress(delegate)),
  );
  delegateVotesChangedEvent.parameters.push(
    new ethereum.EventParam("previousBalance", ethereum.Value.fromUnsignedBigInt(previousBalance)),
  );
  delegateVotesChangedEvent.parameters.push(
    new ethereum.EventParam("newBalance", ethereum.Value.fromUnsignedBigInt(newBalance)),
  );

  return delegateVotesChangedEvent;
}

export function createTransferEvent(from: Address, to: Address, value: BigInt): Transfer {
  const transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.parameters = [];

  transferEvent.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  transferEvent.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)),
  );

  return transferEvent;
}
