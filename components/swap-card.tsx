"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpDown } from "lucide-react";
import { useBalance, useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";

import { useAppKitContext } from "@/components/appkit-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { erc4626Abi } from "@/lib/contracts/erc4626";
import { STABLE_VAULT_MAP, TOKENS, type TokenSymbol } from "@/lib/models/tokens";
import { cn } from "@/lib/utils";

type StablecoinTicker = Exclude<TokenSymbol, "gmUSD">;
type SwapToken = TokenSymbol;

const EXCHANGE_RATES: Record<StablecoinTicker, number> = {
  USDC: 0.98,
  USDT: 0.97,
  USDS: 0.99,
};

const TOKEN_META: Record<SwapToken, { label: string; icon: string }> = {
  USDC: { label: "USDC", icon: "/tokens/usdc.svg" },
  USDT: { label: "USDT", icon: "/tokens/usdt.svg" },
  USDS: { label: "USDS", icon: "/tokens/usds.svg" },
  gmUSD: { label: "gmUSD", icon: "/icons/icon.svg" },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function SwapCard() {
  const [mode, setMode] = useState<"deposit" | "redeem">("deposit");
  const [token, setToken] = useState<StablecoinTicker>("USDC");
  const [amount, setAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { ready, isConnected, address } = useAppKitContext();
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const config = useConfig();

  const fromToken: SwapToken = mode === "deposit" ? token : "gmUSD";
  const tokenDefinition = TOKENS[fromToken];
  const stableTokenDefinition = TOKENS[token];
  const gmTokenDefinition = TOKENS.gmUSD;
  const activeVault = STABLE_VAULT_MAP[token];
  const hasVault = Boolean(activeVault?.address);
  const supportsBalance = Boolean(tokenDefinition.address);
  const accountAddress =
    isConnected && address ? (address as `0x${string}`) : undefined;

  const balanceQuery = useBalance({
    address: accountAddress,
    token: supportsBalance
      ? (tokenDefinition.address as `0x${string}`)
      : undefined,
    query: {
      enabled: Boolean(ready && supportsBalance && accountAddress),
      refetchOnWindowFocus: false,
      refetchInterval: 30_000,
    },
  });

  const maxAmount = useMemo(() => {
    if (!balanceQuery.data) return undefined;
    return formatUnits(balanceQuery.data.value, balanceQuery.data.decimals);
  }, [balanceQuery.data]);

  const formattedBalance = useMemo(
    () => (maxAmount ? formatBalanceDisplay(maxAmount) : undefined),
    [maxAmount]
  );

  type BalanceStatus = "unsupported" | "disconnected" | "loading" | "ready";

  const balanceStatus: BalanceStatus = useMemo(() => {
    if (!supportsBalance) return "unsupported";
    if (!ready || !isConnected || !accountAddress) return "disconnected";
    if (!balanceQuery.data && balanceQuery.isPending) return "loading";
    return balanceQuery.data ? "ready" : "loading";
  }, [
    supportsBalance,
    ready,
    isConnected,
    accountAddress,
    balanceQuery.data,
    balanceQuery.isPending,
  ]);

  const balanceText = useMemo(() => {
    switch (balanceStatus) {
      case "unsupported":
        return "Unavailable";
      case "disconnected":
        return "Connect wallet";
      case "loading":
        return "Fetching…";
      case "ready":
        return formattedBalance ?? "0.00";
      default:
        return "0.00";
    }
  }, [balanceStatus, formattedBalance]);

  const canSetMax = Boolean(
    balanceStatus === "ready" &&
      balanceQuery.data &&
      balanceQuery.data.value > 0n &&
      maxAmount
  );

  const handleApplyMax = useCallback(() => {
    if (!maxAmount) return;
    setAmount(maxAmount);
  }, [maxAmount]);

  const canSubmit = useMemo(() => {
    if (!amount) return false;
    if (!activeVault?.address || !accountAddress) return false;

    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;

    try {
      if (mode === "deposit") {
        if (!stableTokenDefinition.address) return false;
        parseUnits(amount, stableTokenDefinition.decimals);
        return true;
      }

      if (!gmTokenDefinition.address) return false;
      parseUnits(amount, gmTokenDefinition.decimals);
      return true;
    } catch {
      return false;
    }
  }, [
    mode,
    amount,
    activeVault?.address,
    accountAddress,
    stableTokenDefinition.decimals,
    stableTokenDefinition.address,
    gmTokenDefinition.decimals,
  ]);

  const allowanceArgs = useMemo(
    () => [
      (accountAddress ?? ZERO_ADDRESS) as Address,
      (activeVault?.address ?? ZERO_ADDRESS) as Address,
    ] as const,
    [accountAddress, activeVault?.address]
  );

  const allowanceQuery = useReadContract({
    address:
      mode === "deposit"
        ? ((stableTokenDefinition.address ?? ZERO_ADDRESS) as Address)
        : (gmTokenDefinition.address ?? ZERO_ADDRESS),
    abi: erc20Abi,
    functionName: "allowance",
    args: allowanceArgs,
    query: {
      enabled: Boolean(
        ready &&
          activeVault?.address &&
          accountAddress &&
          (mode === "deposit"
            ? stableTokenDefinition.address
            : gmTokenDefinition.address)
      ),
      staleTime: 30_000,
    },
  });

  const allowanceValue = allowanceQuery.data ?? 0n;
  const refetchAllowance = allowanceQuery.refetch;
  const refetchBalance = balanceQuery.refetch;

  const handleSubmit = useCallback(async () => {
    if (!activeVault?.address || !accountAddress || !amount) {
      return;
    }

    setIsProcessing(true);
    try {
      if (mode === "deposit") {
        if (!stableTokenDefinition.address) {
          return;
        }

        const assets = parseUnits(amount || "0", stableTokenDefinition.decimals);
        if (assets <= 0n) {
          return;
        }

        const needsApproval = allowanceValue < assets;

        if (needsApproval) {
          const approveHash = await writeContractAsync({
            address: stableTokenDefinition.address as Address,
            abi: erc20Abi,
            functionName: "approve",
            args: [activeVault.address as Address, assets],
          });

          await waitForTransactionReceipt(config, { hash: approveHash });
          await refetchAllowance?.();
        }

        const depositHash = await writeContractAsync({
          address: activeVault.address as Address,
          abi: erc4626Abi,
          functionName: "deposit",
          args: [assets, accountAddress],
        });

        await waitForTransactionReceipt(config, { hash: depositHash });
        await refetchBalance?.();
        return;
      }

      // Redeem flow: parse gmUSD shares
      if (!activeVault?.address || !accountAddress || !gmTokenDefinition.address) {
        return;
      }

      const shares = parseUnits(amount || "0", gmTokenDefinition.decimals);
      if (shares <= 0n) return;

      const needsApproval = allowanceValue < shares;

      if (needsApproval) {
        const approveHash = await writeContractAsync({
          address: gmTokenDefinition.address as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [activeVault.address as Address, shares],
        });

        await waitForTransactionReceipt(config, { hash: approveHash });
        await refetchAllowance?.();
      }

      const redeemHash = await writeContractAsync({
        address: activeVault.address as Address,
        abi: erc4626Abi,
        functionName: "redeem",
        args: [shares, accountAddress, accountAddress],
      });

      await waitForTransactionReceipt(config, { hash: redeemHash });
      await refetchBalance?.();
    } catch (error) {
      console.error("Swap action failed", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    mode,
    activeVault?.address,
    accountAddress,
    amount,
    stableTokenDefinition.decimals,
    gmTokenDefinition.decimals,
    allowanceValue,
    refetchAllowance,
    refetchBalance,
    config,
    stableTokenDefinition.address,
    gmTokenDefinition.address,
    writeContractAsync,
  ]);

  const assetUnit = useMemo(
    () => 10n ** BigInt(stableTokenDefinition.decimals),
    [stableTokenDefinition.decimals]
  );

  const shareUnit = useMemo(
    () => 10n ** BigInt(gmTokenDefinition.decimals),
    [gmTokenDefinition.decimals]
  );

  const depositRateQuery = useReadContract({
    address: (activeVault?.address ?? ZERO_ADDRESS) as Address,
    abi: erc4626Abi,
    functionName: "convertToShares",
    args: [assetUnit],
    query: {
      enabled: Boolean(ready && mode === "deposit" && hasVault),
      staleTime: 30_000,
    },
  });

  const redeemRateQuery = useReadContract({
    address: (activeVault?.address ?? ZERO_ADDRESS) as Address,
    abi: erc4626Abi,
    functionName: "convertToAssets",
    args: [shareUnit],
    query: {
      enabled: Boolean(ready && mode === "redeem" && hasVault),
      staleTime: 30_000,
    },
  });

  const dynamicDepositRate = useMemo(() => {
    if (mode !== "deposit" || !hasVault || !depositRateQuery.data) {
      return undefined;
    }
    return Number(formatUnits(depositRateQuery.data, gmTokenDefinition.decimals));
  }, [mode, hasVault, depositRateQuery.data, gmTokenDefinition.decimals]);

  const dynamicRedeemRate = useMemo(() => {
    if (mode !== "redeem" || !hasVault || !redeemRateQuery.data) {
      return undefined;
    }
    return Number(formatUnits(redeemRateQuery.data, stableTokenDefinition.decimals));
  }, [mode, hasVault, redeemRateQuery.data, stableTokenDefinition.decimals]);

  const output = useMemo(() => {
    if (!amount) return "";
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed)) return "";
    if (mode === "deposit") {
      const rate = dynamicDepositRate ?? EXCHANGE_RATES[token];
      return (parsed * rate).toFixed(4);
    }
    const rate = dynamicRedeemRate ?? 1 / EXCHANGE_RATES[token];
    return (parsed * rate).toFixed(4);
  }, [amount, mode, token, dynamicDepositRate, dynamicRedeemRate]);

  const rateLabel = useMemo(() => {
    if (mode === "deposit") {
      const rate = dynamicDepositRate ?? EXCHANGE_RATES[token];
      return `1 ${token} = ${formatRateNumber(rate)} gmUSD`;
    }
    const fallback = 1 / EXCHANGE_RATES[token];
    const rate = dynamicRedeemRate ?? fallback;
    return `1 gmUSD = ${formatRateNumber(rate)} ${token}`;
  }, [mode, token, dynamicDepositRate, dynamicRedeemRate]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-start justify-between pb-0">
        <CardTitle className="text-2xl font-semibold tracking-[0.08em]">
          {mode === "deposit" ? "Get gmUSD" : "Redeem gmUSD"}
        </CardTitle>
        <button
          type="button"
          onClick={() => setMode(mode === "deposit" ? "redeem" : "deposit")}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "shadow-none"
          )}
          aria-label="Toggle deposit or redeem"
        >
          <ArrowUpDown className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="from-amount">From</Label>
          <div className="flex gap-3">
            {mode === "deposit" ? (
              <TokenSelect token={token} setToken={setToken} />
            ) : (
              <TokenPill ticker="gmUSD" />
            )}
            <Input
              id="from-amount"
              type="number"
              placeholder="0.00"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>

        <BalanceDisplay
          symbol={fromToken}
          text={balanceText}
          showSymbol={balanceStatus === "ready"}
          interactive={canSetMax}
          onMax={canSetMax ? handleApplyMax : undefined}
        />

        <div className="flex justify-center">
          <span className="border-4 border-black bg-white p-2">
            <ArrowDown className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-3">
          <Label htmlFor="to-amount">To</Label>
          <div className="flex gap-3">
            {mode === "deposit" ? (
              <TokenPill ticker="gmUSD" />
            ) : (
              <TokenSelect token={token} setToken={setToken} />
            )}
            <Input
              id="to-amount"
              placeholder="0.00"
              readOnly
              value={output}
              className="bg-slate-100 text-slate-500"
            />
          </div>
        </div>

        {amount && (
          <div className="border-4 border-black bg-white px-4 py-3 text-sm font-semibold tracking-widest">
            <div className="flex items-center justify-between">
              <span className="uppercase">Rate</span>
              <RateLabel value={rateLabel} />
            </div>
          </div>
        )}

        <Button
          className="w-full"
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting || isProcessing}
        >
          {mode === "deposit"
            ? isProcessing || isSubmitting
              ? "Processing..."
              : "Deposit"
            : "Withdraw"}
        </Button>
      </CardContent>
    </Card>
  );
}

type TokenPillProps = {
  ticker: SwapToken;
};

function TokenPill({ ticker }: TokenPillProps) {
  const meta = TOKEN_META[ticker];
  return (
    <div className="flex h-12 w-36 items-center gap-3 border-4 border-black bg-white px-4 text-base tracking-widest">
      <Image
        src={meta.icon}
        alt={meta.label}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
      />
      <span className={ticker === "gmUSD" ? "font-semibold normal-case" : "uppercase"}>
        {meta.label}
      </span>
    </div>
  );
}

type TokenSelectProps = {
  token: StablecoinTicker;
  setToken: (ticker: StablecoinTicker) => void;
};

function TokenSelect({ token, setToken }: TokenSelectProps) {
  return (
    <Select value={token} onValueChange={(value) => setToken(value as StablecoinTicker)}>
      <SelectTrigger className="w-36 justify-start gap-2">
        <TokenOption ticker={token} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USDC">
          <TokenOption ticker="USDC" />
        </SelectItem>
        <SelectItem value="USDT">
          <TokenOption ticker="USDT" />
        </SelectItem>
        <SelectItem value="USDS">
          <TokenOption ticker="USDS" />
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

type TokenOptionProps = {
  ticker: SwapToken;
};

function TokenOption({ ticker }: TokenOptionProps) {
  const meta = TOKEN_META[ticker];
  return (
    <span className="inline-flex items-center gap-2 text-base">
      <Image
        src={meta.icon}
        alt={meta.label}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 object-contain"
      />
      <span className={ticker === "gmUSD" ? "font-semibold normal-case" : "uppercase"}>
        {meta.label}
      </span>
    </span>
  );
}

type BalanceDisplayProps = {
  symbol: SwapToken;
  text: string;
  showSymbol: boolean;
  interactive: boolean;
  onMax?: () => void;
};

function BalanceDisplay({ symbol, text, showSymbol, interactive, onMax }: BalanceDisplayProps) {
  const symbolClass = symbol === "gmUSD" ? "normal-case" : "uppercase";
  const content = (
    <>
      <span className="uppercase text-black/60">Balance:</span>{" "}
      <span className="text-black">
        {text}
        {showSymbol ? (
          <>
            {" "}
            <span className={symbolClass}>{symbol}</span>
          </>
        ) : null}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div className="mt-1 text-xs tracking-[0.25em] text-black/50">{content}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onMax}
      className="mt-1 text-left text-xs tracking-[0.25em] text-black/70 transition-colors hover:text-black focus:outline-none cursor-pointer"
      aria-label={`Use maximum ${symbol} balance`}
    >
      {content}
    </button>
  );
}

function formatBalanceDisplay(value: string, precision = 4) {
  const [whole, fraction = ""] = value.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!fraction) return formattedWhole;
  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return trimmedFraction ? `${formattedWhole}.${trimmedFraction}` : formattedWhole;
}

function formatRateNumber(value: number, precision = 4) {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }
  return value.toFixed(precision);
}

function RateLabel({ value }: { value: string }) {
  const parts = value.split(" ");
  return (
    <span className="tracking-[0.15em]">
      {parts.map((part, index) => {
        const isToken = part.toLowerCase() === "gmusd";
        return (
          <span
            key={`${part}-${index}`}
            className={cn(
              "uppercase",
              isToken && "font-semibold normal-case"
            )}
          >
            {isToken ? "gmUSD" : part}
            {index < parts.length - 1 ? " " : null}
          </span>
        );
      })}
    </span>
  );
}
