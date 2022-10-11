import { assert, beforeEach, clearStore, describe, test } from "matchstick-as";
import { Transfer } from "../generated/gOHM/gOHM";
import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { backfill, updateTokenBalance } from "../src/handleEvent";
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

    test("0 balance not recorded", () => {
        const value = BigDecimal.fromString("0");
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

        // Token Holder Balance should NOT be created
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-09`);
        log.debug("token holder balance should be null", []);
        assert.assertNull(tokenHolderBalance);
        
        // Token snapshot NOT updated
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-09`);
        assert.assertNull(tokenDailySnapshot);
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

    test("multiple transfers, single day, zero balance", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Second transaction
        const valueTwo = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(valueTwo), true, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", BigInt.fromString("100"));

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Balance should be deleted (0 balance)
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-09`);
        log.debug("token holder balance should be null", []);
        assert.assertNull(tokenHolderBalance);

        // Token snapshot balances should be deleted (0 balance)
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-09`);
        log.debug("token daily snapshot should be null", []);
        assert.assertTrue(stringArrayEquals([], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
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

    test("multiple transfers, multiple days, zero balance", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Second transaction
        const valueTwo = BigDecimal.fromString("1.1");
        const timestampTwo = "1665402107"; // 2022-10-10T11:41:47.000
        const blockTwo = "15717471";
        const transactionTwo = "0x74e3c96ad72f989ac693e04455411c194495a5502920c453428c7edcee95ad21";
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(valueTwo), true, BigInt.fromString(blockTwo), BigInt.fromString(timestampTwo), Bytes.fromHexString(transactionTwo), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Balance should not be present (due to 0 balance)
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-10`);
        log.debug("token holder balance should be null", []);
        assert.assertNull(tokenHolderBalance);
        
        // Snapshot does not contain the balance
        log.debug("token daily snapshot should be updated", []);
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-10`);
        assert.assertTrue(stringArrayEquals([], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });

    test("multiple transfers, multiple days, backfill, zero balance", () => {
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        const token = Token.load("gOHM/Ethereum");
        if (!token) {
            throw new Error("Expected gOHM token to be created");
        }

        // Backfill happens in between
        const backfillTimestamp = BigInt.fromString("1665402106");
        backfill(backfillTimestamp, token);

        // Second transaction
        const valueTwo = BigDecimal.fromString("1.1");
        const timestampTwo = "1665402107"; // 2022-10-10T11:41:47.000
        const blockTwo = "15717471";
        const transactionTwo = "0x74e3c96ad72f989ac693e04455411c194495a5502920c453428c7edcee95ad21";
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(valueTwo), true, BigInt.fromString(blockTwo), BigInt.fromString(timestampTwo), Bytes.fromHexString(transactionTwo), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const tokenId = token ? token.id : "";
        log.debug("token should not be null", []);
        assert.assertNotNull(token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);
        log.debug("token holder should not be null", []);
        assert.assertNotNull(tokenHolder);

        // Token Holder Balance should not be present (due to 0 balance)
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-10`);
        log.debug("token holder balance should be null", []);
        assert.assertNull(tokenHolderBalance);
        
        // Snapshot does not contain the balance
        log.debug("token daily snapshot should be updated", []);
        const tokenDailySnapshot = TokenDailySnapshot.load(`${tokenId}/2022-10-10`);
        assert.assertTrue(stringArrayEquals([], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });
});

describe("backfill", () => {
    beforeEach(() => {
        clearStore();
    });

    test("backfills for current day", () => {
        // This will create a balance and snapshot for 2022-10-09
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        if (!token) {
            throw new Error("token cannot be null");
        }

        // Calling backfill will populate the current day's snapshot
        const timestampTwo = BigInt.fromString("1665402107"); // 2022-10-10T11:41:47.000
        backfill(timestampTwo, token);

        // Token Holder should be created
        const tokenHolder = TokenHolder.load(`gOHM/Ethereum/${getHolderAddress().toHexString()}`);

        // Token Holder Balance should be created for the current day
        const tokenHolderBalance = TokenHolderBalance.load(`${tokenHolder ? tokenHolder.id : ""}/2022-10-10`);
        const tokenHolderBalanceId = tokenHolderBalance ? tokenHolderBalance.id : "";
        // Balance is copied and accurate
        assert.stringEquals("1.1", tokenHolderBalance ? tokenHolderBalance.balance.toString() : "");
        
        const tokenDailySnapshot = TokenDailySnapshot.load(`${token.id}/2022-10-10`);
        assert.assertTrue(stringArrayEquals([tokenHolderBalanceId], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });

    test("does not backfill for missing day", () => {
        // This will create a balance and snapshot for 2022-10-09
        const value = BigDecimal.fromString("1.1");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        if (!token) {
            throw new Error("token cannot be null");
        }

        // Calling backfill will populate the current day's snapshot
        const timestampTwo = BigInt.fromString("1664630381"); // 2022-10-11T13:19:41.000
        backfill(timestampTwo, token);

        // Empty as there is no record for 2022-10-10
        const tokenDailySnapshot = TokenDailySnapshot.load(`${token.id}/2022-10-11`);
        assert.assertTrue(stringArrayEquals([], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });

    test("does not backfill for 0 balance", () => {
        // This will create a balance and snapshot for 2022-10-09
        const value = BigDecimal.fromString("0");
        updateTokenBalance(getTokenAddress(), getHolderAddress(), toBigInt(value), false, getBlock(), getTimestamp(), getTransaction(), "TRANSFER", getTransactionLogIndex());

        // Token should be created
        const token = Token.load("gOHM/Ethereum");
        if (!token) {
            throw new Error("token cannot be null");
        }
        
        // Calling backfill will populate the current day's snapshot
        const timestampTwo = BigInt.fromString("1665402107"); // 2022-10-10T11:41:47.000
        backfill(timestampTwo, token);

        const tokenDailySnapshot = TokenDailySnapshot.load(`${token.id}/2022-10-10`);
        assert.assertTrue(stringArrayEquals([], tokenDailySnapshot ? tokenDailySnapshot.balancesList : []));
    });
});