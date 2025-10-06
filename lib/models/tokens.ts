export type TokenSymbol = "USDC" | "USDT" | "USDS" | "gmUSD";

export interface TokenDefinition {
  symbol: TokenSymbol;
  name: string;
  address: `0x${string}` | null;
  decimals: number;
}

export const TOKENS: Record<TokenSymbol, TokenDefinition> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
  },
  USDS: {
    symbol: "USDS",
    name: "Sky USDS",
    address: null,
    decimals: 18,
  },
  gmUSD: {
    symbol: "gmUSD",
    name: "GMX Dollar",
    address: "0x613547C233B752C9aff6967194FB8f6287443b61",
    decimals: 18,
  },
};

export type VaultSymbol = "USDC_VAULT" | "USDT_VAULT";

export interface VaultDefinition {
  symbol: VaultSymbol;
  token: Extract<TokenSymbol, "USDC" | "USDT">;
  address: `0x${string}`;
}

export const VAULTS: Record<VaultSymbol, VaultDefinition> = {
  USDC_VAULT: {
    symbol: "USDC_VAULT",
    token: "USDC",
    address: "0x6c17818f09Cf045a203cc55ADe286B4c5A4B8A4e",
  },
  USDT_VAULT: {
    symbol: "USDT_VAULT",
    token: "USDT",
    address: "0xfE582063D48773fa5Fb7Be2dEED181875aFAFFE8",
  },
};

type StablecoinSymbol = Extract<TokenSymbol, "USDC" | "USDT" | "USDS">;

export const STABLE_VAULT_MAP: Partial<Record<StablecoinSymbol, VaultDefinition>> = {
  USDC: VAULTS.USDC_VAULT,
  USDT: VAULTS.USDT_VAULT,
};
