import Link from "next/link";
import { Check, Info, X } from "lucide-react";

const packages = [
    {
        name: "Free",
        price: "₹0",
        period: "forever",
        badge: null,
        badgeColor: "",
        description: "Get started and explore the platform at no cost.",
        features: [
            "2 Events",
            "1 GB Storage",
            "1 Standard Template Only",
            "Guest Sharing via Link",
            "Basic Gallery View",
            "Watermark on Images",
            "No Authorized Guest Sign-In",
        ],
        cta: "Get Started",
        ctaHref: "/login",
        accentClass: "border border-slate-100",
        btnClass: "bg-slate-800 text-white hover:bg-slate-900",
        checkClass: "bg-slate-100 text-slate-600",
    },
    {
        name: "Basic",
        price: "₹499",
        period: "/ month",
        badge: null,
        badgeColor: "",
        description: "For individuals & small events.",
        features: [
            "5 Events",
            "15 GB Storage",
            "All Templates",
            "Authorized Guest Sign-In",
            "Guest Approval System",
            "Face Recognition Search",
            "Standard Support",
            "Optimized Image Delivery (JPG)",
        ],
        cta: "Choose Basic",
        ctaHref: "/contact-us",
        accentClass: "border border-teal-100",
        btnClass: "bg-teal-600 text-white hover:bg-teal-700",
        checkClass: "bg-teal-50 text-teal-500",
    },
    {
        name: "Standard",
        price: "₹1,499",
        period: "/ month",
        badge: null,
        badgeColor: "",
        description: "Best for frequent users & families.",
        features: [
            "20 Events",
            "60 GB Storage",
            "All Templates",
            "Authorized Guest Sign-In",
            "Guest Approval + Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Priority Support",
            "Faster CDN Delivery",
        ],
        cta: "Choose Standard",
        ctaHref: "/contact-us",
        accentClass: "border border-sky-100",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700",
        checkClass: "bg-sky-50 text-sky-500",
    },
    {
        name: "Premium",
        price: "₹3,999",
        period: "/ month",
        badge: "Most Popular",
        badgeColor: "bg-sky-600",
        description: "For professional photographers.",
        features: [
            "Unlimited Events",
            "200 GB Storage",
            "All Templates",
            "Authorized Guest Sign-In",
            "Guest Approval + Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Delegate Team Members",
            "Dedicated Support",
            "RAW + JPG Download Options",
            "Advanced Analytics",
        ],
        cta: "Choose Premium",
        ctaHref: "/contact-us",
        accentClass: "ring-2 ring-sky-500",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-200",
        checkClass: "bg-sky-100 text-sky-600",
    },
    {
        name: "Elite",
        price: "₹9,999",
        period: "/ month",
        badge: "Best Value",
        badgeColor: "bg-purple-600",
        description: "For studios & heavy users.",
        features: [
            "Unlimited Events",
            "1 TB Storage",
            "All Templates",
            "Authorized Guest Sign-In",
            "Guest Approval + Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Unlimited Team Members",
            "White-Label Branding",
            "Dedicated Account Manager",
            "Priority CDN (Fastest Delivery)",
            "Bulk Upload Tools",
            "API Access",
        ],
        cta: "Choose Elite",
        ctaHref: "/contact-us",
        accentClass: "ring-2 ring-purple-400",
        btnClass: "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200",
        checkClass: "bg-purple-100 text-purple-600",
    },
];

export default function Pricing() {
    return (
        <div className="min-h-screen bg-slate-50 py-24 px-4">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif text-slate-800">Simple, Transparent Pricing</h1>
                    <p className="text-slate-700 text-lg max-w-2xl mx-auto font-light">
                        From free to enterprise — find the plan that fits your story.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
                    {packages.map((pkg) => (
                        <div
                            key={pkg.name}
                            className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col ${pkg.accentClass}`}
                        >
                            {/* Badge */}
                            {pkg.badge && (
                                <div className={`${pkg.badgeColor} text-white text-xs font-bold py-1.5 text-center uppercase tracking-widest`}>
                                    {pkg.badge}
                                </div>
                            )}

                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="text-xl font-serif font-bold text-slate-800 mb-2">{pkg.name}</h3>

                                <div className="flex items-baseline mb-0.5">
                                    <span className="text-3xl font-bold text-slate-900">{pkg.price}</span>
                                </div>
                                <span className="text-slate-600 text-xs font-light mb-2">{pkg.period}</span>
                                <p className="text-slate-700 font-light text-xs mb-4 min-h-[32px]">{pkg.description}</p>

                                <div className="w-full h-px bg-slate-100 mb-4" />

                                <ul className="space-y-2.5 mb-6 flex-1">
                                    {pkg.features.map((feature, idx) => {
                                        const isRestriction = feature.startsWith("No ");
                                        return (
                                            <li key={idx} className="flex items-start group">
                                                <div className={`p-1 rounded-full mr-2 shrink-0 mt-px ${
                                                    isRestriction ? "bg-red-50 text-red-400" : pkg.checkClass
                                                }`}>
                                                    {isRestriction
                                                        ? <X className="w-2.5 h-2.5" />
                                                        : <Check className="w-2.5 h-2.5" />
                                                    }
                                                </div>
                                                <span className={`text-xs leading-snug transition-colors ${
                                                    isRestriction ? "text-red-400 line-through" : "text-slate-600 group-hover:text-slate-900"
                                                }`}>{feature}</span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <Link href={pkg.ctaHref} className="block w-full mt-auto">
                                    <div className={`w-full py-3 text-center rounded-xl uppercase tracking-widest text-xs font-bold transition-all duration-300 active:scale-95 ${pkg.btnClass}`}>
                                        {pkg.cta}
                                    </div>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Fair Usage Policy Note */}
                <div className="mt-10 flex items-start justify-center gap-2 text-center">
                    <Info className="w-4 h-4 text-slate-600 shrink-0 mt-px" />
                    <p className="text-slate-600 text-xs max-w-xl leading-relaxed">
                        <span className="font-semibold text-slate-700">Fair Usage Policy:</span> Bandwidth usage beyond fair limits may incur additional charges.
                        Extra Storage: ₹5/GB &bull; Extra Bandwidth: ₹7–₹10/GB.
                    </p>
                </div>

                {/* Custom Plan CTA */}
                <div className="mt-14 text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-2xl font-serif text-slate-800 mb-3">Need a custom plan?</h3>
                    <p className="text-slate-700 mb-8 max-w-2xl mx-auto">
                        Running a large studio or enterprise operation? Let&apos;s build a plan tailored to your exact needs.
                    </p>
                    <Link href="/contact-us" className="inline-block">
                        <span className="text-sky-600 font-semibold border-b-2 border-transparent hover:border-sky-600 transition-all duration-300">
                            Contact Us for Custom Quote &rarr;
                        </span>
                    </Link>
                </div>

            </div>
        </div>
    );
}
