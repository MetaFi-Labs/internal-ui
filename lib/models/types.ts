export type HexAddress = `0x${string}`;

export interface ContractBase {
  address: HexAddress;
  label: string;
}
