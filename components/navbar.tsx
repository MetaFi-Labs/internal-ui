"use client";

import Image from "next/image";
import Link from "next/link";

import { WalletButton } from "@/components/wallet-button";

export function Navbar() {
  return (
    <header className="w-full border-b-4 border-black bg-white px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center text-black">
          <Image
            src="/icons/full-logo-black.svg"
            alt="Generic logo"
            width={200}
            height={54}
            priority
            className="h-12 w-auto"
          />
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}
