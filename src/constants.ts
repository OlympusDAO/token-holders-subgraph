export const ERC20_GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
export const ERC20_OHM_V1 = "0x383518188c0c6d7730d91b2c03a03c837814a899";
export const ERC20_SOHM_V1 = "0x31932e6e45012476ba3a3a4953cba62aee77fbbe";
export const ERC20_SOHM_V2 = "0x04F2694C8fcee23e8Fd0dfEA1d4f5Bb8c352111F";
export const ERC20_OHM_V2 = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
export const ERC20_SOHM_V3 = "0x04906695D6D12CF5459975d7C3C03356E4Ccd460";

export const CHAIN_ETHEREUM = "Ethereum";

const NULL = "0x0000000000000000000000000000000000000000";
export const IGNORED_ADDRESSES = [
    ERC20_GOHM,
    ERC20_OHM_V1,
    ERC20_OHM_V2,
    ERC20_SOHM_V1,
    ERC20_SOHM_V2,
    ERC20_SOHM_V3,
    NULL,
];

export const TYPE_TRANSFER = "TRANSFER";
export const TYPE_MINT = "MINT";
export const TYPE_BURN = "BURN";
export const TYPE_REBASE = "REBASE";

const TOKENS = new Map<string, string>();
TOKENS.set(ERC20_GOHM.toLowerCase(), "gOHM");
TOKENS.set(ERC20_OHM_V1.toLowerCase(), "OHM V1");
TOKENS.set(ERC20_SOHM_V1.toLowerCase(), "sOHM V1");
TOKENS.set(ERC20_SOHM_V2.toLowerCase(), "sOHM V2");
TOKENS.set(ERC20_OHM_V2.toLowerCase(), "OHM V2");
TOKENS.set(ERC20_SOHM_V3.toLowerCase(), "sOHM V3");

export function getTokenName(address: string): string {
    if (!TOKENS.has(address.toLowerCase())) {
        return "";
    }

    return TOKENS.get(address.toLowerCase());
}

const TOKEN_DECIMALS = new Map<string, string>();
TOKEN_DECIMALS.set(ERC20_GOHM.toLowerCase(), "18");
TOKEN_DECIMALS.set(ERC20_OHM_V1.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_SOHM_V1.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_SOHM_V2.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_OHM_V2.toLowerCase(), "9");
TOKEN_DECIMALS.set(ERC20_SOHM_V3.toLowerCase(), "9");

export function getTokenDecimals(address: string): number {
    if (!TOKEN_DECIMALS.has(address.toLowerCase())) {
        return -1;
    }

    return parseInt(TOKEN_DECIMALS.get(address.toLowerCase()));
}