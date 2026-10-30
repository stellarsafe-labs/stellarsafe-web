import { StrKey } from "@stellar/stellar-sdk";

/** G... account (ed25519 public key) */
export const isAccountAddress = (v: string) => StrKey.isValidEd25519PublicKey(v);
/** C... contract address */
export const isContractAddress = (v: string) => StrKey.isValidContract(v);
/** Any address that can hold assets or sign on Soroban. */
export const isStellarAddress = (v: string) => isAccountAddress(v) || isContractAddress(v);

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
