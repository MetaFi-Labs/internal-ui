"use client";

import { useMemo } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useAppKitContext } from "@/components/appkit-provider";
import { cn } from "@/lib/utils";

function formatLabel(address?: string) {
  if (!address) {
    return "Connect Wallet";
  }
  const prefix = address.slice(0, 6);
  const suffix = address.slice(-4);
  return `${prefix}…${suffix}`;
}

export function WalletButton() {
  const { ready, isConnected, address, openModal } = useAppKitContext();

  const label = useMemo(
    () => (isConnected ? formatLabel(address) : "Connect Wallet"),
    [address, isConnected]
  );

  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "min-w-[180px] justify-center",
        isConnected ? "normal-case tracking-wide" : "tracking-[0.25em]"
      )}
      onClick={() => {
        void openModal({ view: isConnected ? "Account" : "Connect" });
      }}
      disabled={!ready}
    >
      {label}
    </button>
  );
}
