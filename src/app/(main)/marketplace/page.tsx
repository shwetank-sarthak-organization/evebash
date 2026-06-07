import React from "react";
import { Search } from "lucide-react";

export const metadata = {
  title: "Marketplace | Lens & Frame",
  description: "Explore photography businesses",
};

export default function MarketplacePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center font-serif">
      <div className="bg-slate-100 p-6 rounded-full mb-6">
        <Search className="w-16 h-16 text-slate-800" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Marketplace</h1>
      <p className="text-lg text-slate-600 max-w-lg mx-auto font-sans">
        Discover and connect with top-tier photography businesses, studios, and freelance professionals for your next big event.
        <br/><br/>
        <span className="text-sm font-semibold uppercase tracking-widest text-sky-600 bg-sky-50 px-3 py-1 rounded-full">Coming Soon to Web</span>
      </p>
    </div>
  );
}
