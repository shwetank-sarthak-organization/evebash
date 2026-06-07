import React from "react";
import { Store } from "lucide-react";

export const metadata = {
  title: "Biz Hub | Lens & Frame",
  description: "Manage your photography business",
};

export default function BizHubPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center font-serif">
      <div className="bg-slate-100 p-6 rounded-full mb-6">
        <Store className="w-16 h-16 text-slate-800" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Biz Hub</h1>
      <p className="text-lg text-slate-600 max-w-lg mx-auto font-sans">
        Manage your business profile, view analytics, and organize your client bookings all in one place.
        <br/><br/>
        <span className="text-sm font-semibold uppercase tracking-widest text-sky-600 bg-sky-50 px-3 py-1 rounded-full">Coming Soon to Web</span>
      </p>
    </div>
  );
}
