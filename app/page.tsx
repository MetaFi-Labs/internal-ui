import { Navbar } from "@/components/navbar";
import { SwapCard } from "@/components/swap-card";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-white via-slate-50 to-white">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <SwapCard />
      </main>
    </div>
  );
}
