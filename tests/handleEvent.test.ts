import { assert, beforeEach, clearStore, describe, test } from "matchstick-as";
import { Transfer } from "../generated/gOHM/gOHM";
import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { updateTokenBalance } from "../src/handleEvent";
import { Token, TokenDailySnapshot, TokenHolder, TokenHolderBalance, TokenHolderTransaction } from "../generated/schema";
import { toBigInt } from "../src/decimalHelper";

const ERC20_GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
const holderAddressString = "0xbb3041f88c52b1f003a1a2ceeb63b73a2a9f3f04";
const transactionString = "0xb0ac02a9b5ac8a3a0ce7de92654f14b39a354cc3e10d6ccca153ff55e275dd15";

function getTokenAddress(): Address {
    return Address.fromString(ERC20_GOHM);
}

function getHolderAddress(): Address {
    return Address.fromString(holderAddressString);
}

function getBlock(): BigInt {
    return BigInt.fromString("15710427");
}

function getTimestamp(): BigInt {
    return BigInt.fromString("1665317159"); // 2022-10-09T12:05:59.000Z
}

function getTransaction(): Bytes {
    return Bytes.fromHexString(transactionString);
}

function getTransactionLogIndex(): BigInt {
    return BigInt.fromString("1");
}

function stringArrayEquals(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }

    return true;
}

describe("transfer", () => {
    beforeEach(() => {
        clearStore();
    });

    test("single transfer", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Transaction should be created
        const tokenHolderTransaction = TokenHolderTransaction.load(`${tokenHolder ? tokenHolder.id : ""}/${getTransaction().toHexString()}/${getTransactionLogIndex().toString()}`);
        log.debug("token holder transaction should not be null", []);
        assert.assertNotNull(tokenHolderTransaction);
        assert.stringEquals(value.toString(), tokenHolderTransaction ? tokenHolderTransaction.value.toString() : "");

        // Token Holder Balance should be created
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-09`);
        const tokenHolderBalanceId = tokenHolderBalance ? tokenHolderBalance.id : "";
        log.debug("token holder balance should not be null", []);
        assert.assertNotNull(tokenHolderBalance);
        assert.stringEquals(value.toString(), tokenHolderBalance ? tokenHolderBalance.balance.toString() : "");
        
        // Token balances updated
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-09`);
        assert.assertTrue(stringArrayEquals([tokenHolderBalanceId], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });

    test("multiple transfers, single day", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Second transaction
        const valueTwo = BigDecimal.fromString("1.2");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(valueTwo), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", BigInt.fromString("100"));

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Transaction should be created
        const tokenHolderTransaction = TokenHolderTransaction.load(`${tokenHolder ? tokenHolder.id : ""}/${getTransaction().toHexString()}/100`);
        log.debug("token holder transaction should not be null", []);
        assert.assertNotNull(tokenHolderTransaction);
        assert.stringEquals(valueTwo.toString(), tokenHolderTransaction ? tokenHolderTransaction.value.toString() : "");

        // Token Holder Balance should be updated
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-09`);
        const tokenHolderBalanceId = tokenHolderBalance ? tokenHolderBalance.id : "";
        log.debug("token holder balance should not be null", []);
        assert.assertNotNull(tokenHolderBalance);
        assert.stringEquals(value.plus(valueTwo).toString(), tokenHolderBalance ? tokenHolderBalance.balance.toString() : "");

        // Token balances updated
        log.debug("token daily snapshot should be updated", []);
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-09`);
        assert.assertTrue(stringArrayEquals([tokenHolderBalanceId], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });

    test("multiple transfers, multiple days", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Second transaction
        const valueTwo = BigDecimal.fromString("1.2");
        const timestampTwo = "1665402107"; // 2022-10-10T11:41:47.000
        const blockTwo = "15717471";
        const transactionTwo = "0x74e3c96ad72f989ac693e04455411c194495a5502920c453428c7edcee95ad21";
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(valueTwo), false, BigInt.fromString(blockTwo), BigInt.fromString(timestampTwo), Bytes.fromHexString(transactionTwo), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Transaction should be created
        const tokenHolderTransaction = TokenHolderTransaction.load(`${tokenHolder ? tokenHolder.id : ""}/${transactionTwo}/${getTransactionLogIndex().toString()}`);
        log.debug("token holder transaction should not be null", []);
        assert.assertNotNull(tokenHolderTransaction);
        assert.stringEquals(valueTwo.toString(), tokenHolderTransaction ? tokenHolderTransaction.value.toString() : "");

        // Token Holder Balance should be updated
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-10`);
        const tokenHolderBalanceId = tokenHolderBalance ? tokenHolderBalance.id : "";
        log.debug("token holder balance should not be null", []);
        assert.assertNotNull(tokenHolderBalance);
        assert.stringEquals(value.plus(valueTwo).toString(), tokenHolderBalance ? tokenHolderBalance.balance.toString() : "");
        
        // Token balances updated
        log.debug("token daily snapshot should be updated", []);
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-10`);
        assert.assertTrue(stringArrayEquals([tokenHolderBalanceId], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });
});

describe("backfill", () => {
    beforeEach(() => {
        clearStore();
    });

    test("backfills for previous day", () => {
        throw new Error("");
    });
});