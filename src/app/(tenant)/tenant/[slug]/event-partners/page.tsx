import Link from "next/link";
import { Briefcase, ChevronRight, MapPin, Star } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Business, getBusinessById, getEventById } from "@/lib/database";
import { notFound } from "next/navigation";

function getVendorLocation(business: Business) {
    return business.location?.address || "Location not listed";
}

export default async function TenantEventPartnersPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await getEventById(slug);

    if (!event) {
        return notFound();
    }

    const linkedVendors = event.vendors?.length
        ? await Promise.all(event.vendors.map((vendorId) => getBusinessById(vendorId)))
        : [];
    const vendors = linkedVendors.filter(Boolean) as Business[];

    return (
        <main className="min-h-screen bg-stone-50 pb-24">
            <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 lg:px-8">
                <SectionHeader
                    title="The Dream Team"
                    subtitle={`The creative team and vendors behind this beautiful ${event.category?.toLowerCase() || "event"}.`}
                />

                {vendors.length === 0 ? (
                    <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-stone-200 bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                            <Briefcase className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Vendor list coming soon</h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-stone-600">
                            Event partners linked by the host will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="mt-12 grid gap-5 md:grid-cols-2">
                        {vendors.map((vendor) => (
                            <Link
                                key={vendor.id}
                                href={`/marketplace/${vendor.id}`}
                                className="group flex items-center gap-5 rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
                            >
                                <div
                                    className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 bg-stone-100 bg-cover bg-center"
                                    style={{
                                        backgroundImage: `url("${vendor.coverImage || "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?q=80&w=500&auto=format&fit=crop"}")`,
                                    }}
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-xl font-black text-slate-900">{vendor.name}</h3>
                                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-amber-700">{vendor.type}</p>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-stone-500">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {getVendorLocation(vendor)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                            {vendor.rating || 0}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-900" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
