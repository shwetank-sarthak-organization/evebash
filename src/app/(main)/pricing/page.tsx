import Link from "next/link";
import { Check } from "lucide-react";

const packages = [
    {
        name: "Free",
        price: "₹0",
        period: "forever",
        description: "Get started and explore the platform at no cost.",
        features: [
            "2 Events",
            "1 GB Storage",
            "10 Templates",
            "Guest Sharing via Link",
            "Basic Gallery View",
        ],
        recommended: false,
        cta: "Get Started",
        color: "slate"
    },
    {
        name: "Basic",
        price: "₹299",
        period: "/ month",
        description: "For individuals capturing small events and memories.",
        features: [
            "5 Events",
            "10 GB Storage",
            "All Templates",
            "Guest Approval System",
            "Face Recognition Search",
            "Priority Email Support",
        ],
        recommended: false,
        cta: "Choose Basic",
        color: "slate"
    },
    {
        name: "Standard",
        price: "₹699",
        period: "/ month",
        description: "The go-to plan for growing photographers and families.",
        features: [
            "20 Events",
            "50 GB Storage",
            "All Templates",
            "Guest Approval & Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Priority Support",
        ],
        recommended: false,
        cta: "Choose Standard",
        color: "slate"
    },
    {
        name: "Premium",
        price: "₹1,499",
        period: "/ month",
        description: "Our most popular plan for professional photographers.",
        features: [
            "Unlimited Events",
            "200 GB Storage",
            "All Templates",
            "Guest Approval & Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Delegate Team Members",
            "Dedicated Support",
        ],
        recommended: true,
        cta: "Choose Premium",
        color: "sky"
    },
    {
        name: "Elite",
        price: "₹3,999",
        period: "/ month",
        description: "The ultimate plan for studios and large-scale operations.",
        features: [
            "Unlimited Events",
            "1 TB Storage",
            "All Templates",
            "Guest Approval & Traffic Logs",
            "Face Recognition Search",
            "Custom Subdomain",
            "Unlimited Team Members",
            "White-Label Branding",
            "Dedicated Account Manager",
        ],
        recommended: false,
        cta: "Choose Elite",
        color: "amber"
    }
];


export default function Pricing() {
    return (
        <div className="min-h-screen bg-slate-50 py-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif text-slate-800">Simple, Transparent Pricing</h1>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto font-light">
                        From free to enterprise — find the plan that fits your story.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {packages.map((pkg) => {
                        const accentClass = pkg.recommended
                            ? "ring-2 ring-sky-500"
                            : pkg.color === "amber"
                            ? "ring-2 ring-amber-400"
                            : "border border-slate-100";

                        const btnClass = pkg.recommended
                            ? "bg-sky-600 text-white hover:bg-sky-700 shadow-md"
                            : pkg.color === "amber"
                            ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900";

                        return (
                            <div
                                key={pkg.name}
                                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col ${accentClass}`}
                            >
                                {pkg.recommended && (
                                    <div className="bg-sky-500 text-white text-xs font-bold py-1 text-center uppercase tracking-widest">
                                        Most Popular
                                    </div>
                                )}
                                {pkg.color === "amber" && !pkg.recommended && (
                                    <div className="bg-amber-500 text-white text-xs font-bold py-1 text-center uppercase tracking-widest">
                                        Best Value
                                    </div>
                                )}

                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="text-xl font-serif font-bold text-slate-800 mb-2">{pkg.name}</h3>
                                    <div className="flex items-baseline mb-1">
                                        <span className="text-3xl font-bold text-slate-900">{pkg.price}</span>
                                    </div>
                                    <span className="text-slate-400 text-xs font-light mb-3">{pkg.period}</span>
                                    <p className="text-slate-500 font-light text-xs mb-4 min-h-[36px]">{pkg.description}</p>

                                    <div className="w-full h-px bg-slate-100 mb-4"></div>

                                    <ul className="space-y-3 mb-6 flex-1">
                                        {pkg.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start group">
                                                <div className={`p-1 rounded-full mr-2 shrink-0 ${pkg.recommended ? 'bg-sky-100 text-sky-600' : pkg.color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Check className="w-3 h-3" />
                                                </div>
                                                <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Link href={pkg.name === "Free" ? "/login" : "/contact-us"} className="block w-full mt-auto">
                                        <div className={`w-full py-3 text-center rounded-lg uppercase tracking-widest text-xs font-bold transition-all duration-300 ${btnClass}`}>
                                            {pkg.cta}
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-20 text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-2xl font-serif text-slate-800 mb-3">Need a custom plan?</h3>
                    <p className="text-slate-500 mb-8 max-w-2xl mx-auto">
                        Running a large studio or enterprise operation? Let's build a custom plan tailored to your exact needs.
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
