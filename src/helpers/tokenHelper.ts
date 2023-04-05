import { Address } from "@graphprotocol/graph-ts";
import { Token } from "../../generated/schema";

export function getTokenId(name: string, blockchain: string): string {
    return `${name}/${blockchain}`;
}

export function createOrLoadToken(address: Address, name: string, blockchain: string): Token {
    const tokenId = getTokenId(name, blockchain);
    const loadedToken = Token.load(tokenId);
    if (loadedToken !== null) {
        return loadedToken;
    }

    const token = new Token(tokenId);
    token.address = address;
    token.name = name;
    token.blockchain = blockchain;
    token.tokenHolders = [];
    token.save();

    return token;
}