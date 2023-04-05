import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

const DEFAULT_DECIMALS = 18;

/**
 * Converts the given BigInt to a BigDecimal.
 *
 * If the `decimals` parameter is specified, that will be used instead of `DEFAULT_DECIMALS`.
 *
 * @param value
 * @param decimals
 * @returns
 */
export function toDecimal(value: BigInt, decimals: number = DEFAULT_DECIMALS): BigDecimal {
  const precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();

  return value.divDecimal(precision);
}

/**
 * Converts the given BigDecimal to a BigInt.
 *
 * If the `decimals` parameter is specified, that will be used instead of `DEFAULT_DECIMALS`.
 *
 * @param value
 * @param decimals
 * @returns
 */
export function toBigInt(value: BigDecimal, decimals: number = DEFAULT_DECIMALS): BigInt {
  const multiplier = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();

  return BigInt.fromString(value.times(multiplier).toString());
}
