"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Info } from "lucide-react";
import { pricingPlanToFeatures, PricingPlan } from "@/lib/pricingPlans";
import type { RazorpayBillingDuration } from "@/lib/razorpayPricing";

type BillingCycle = "monthly" | "threeMonths" | "sixMonths" | "yearly";

const billingCycles: { key: BillingCycle; label: string; period: string }[] = [
    { key: "monthly", label: "Monthly", period: "/ month" },
    { key: "threeMonths", label: "3 Months", period: "/ 3 months" },
    { key: "sixMonths", label: "6 Months", period: "/ 6 months" },
    { key: "yearly", label: "Yearly", period: "/ year" },
];

type CheckoutMessage = {
    type: "success" | "error" | "info";
    text: string;
};

type RazorpaySuccessResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
};

type RazorpayFailureResponse = {
    error?: {
        code?: string;
        description?: string;
        reason?: string;
    };
};

type RazorpayOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: {
        ondismiss?: () => void;
    };
    theme?: {
        color?: string;
    };
};

type RazorpayCheckout = {
    open: () => void;
    on: (event: "payment.failed", callback: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
    }
}

const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);

const planVisuals: Record<string, {
    badge: string | null;
    badgeColor: string;
    description: string;
    accentClass: string;
    btnClass: string;
    checkClass: string;
}> = {
    free: {
        badge: null,
        badgeColor: "",
        description: "Get started and explore the platform at no cost.",
        accentClass: "border border-slate-100",
        btnClass: "bg-slate-800 text-white hover:bg-slate-900",
        checkClass: "bg-slate-100 text-slate-600",
    },
    starter: {
        badge: null,
        badgeColor: "",
        description: "For small personal galleries.",
        accentClass: "border border-teal-100",
        btnClass: "bg-teal-600 text-white hover:bg-teal-700",
        checkClass: "bg-teal-50 text-teal-500",
    },
    basic: {
        badge: null,
        badgeColor: "",
        description: "For individuals and small events.",
        accentClass: "border border-teal-100",
        btnClass: "bg-teal-600 text-white hover:bg-teal-700",
        checkClass: "bg-teal-50 text-teal-500",
    },
    standard: {
        badge: null,
        badgeColor: "",
        description: "Best for frequent users and families.",
        accentClass: "border border-sky-100",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700",
        checkClass: "bg-sky-50 text-sky-500",
    },
    premium: {
        badge: "Most Popular",
        badgeColor: "bg-sky-600",
        description: "For professional photographers.",
        accentClass: "ring-2 ring-sky-500",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-200",
        checkClass: "bg-sky-100 text-sky-600",
    },
    pro: {
        badge: null,
        badgeColor: "",
        description: "For growing professional teams.",
        accentClass: "border border-purple-100",
        btnClass: "bg-purple-600 text-white hover:bg-purple-700",
        checkClass: "bg-purple-50 text-purple-500",
    },
    elite: {
        badge: null,
        badgeColor: "bg-purple-600",
        description: "For studios and heavy users.",
        accentClass: "ring-2 ring-purple-400",
        btnClass: "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200",
        checkClass: "bg-purple-100 text-purple-600",
    },
    ultimate: {
        badge: "Best Value",
        badgeColor: "bg-orange-600",
        description: "For large studios and high-volume workflows.",
        accentClass: "ring-2 ring-orange-400",
        btnClass: "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200",
        checkClass: "bg-orange-100 text-orange-600",
    },
};

function getPlanPrice(plan: PricingPlan, billingCycle: BillingCycle) {
    if (billingCycle === "monthly") return plan.monthlyPrice;
    if (billingCycle === "threeMonths") return plan.threeMonthPrice;
    if (billingCycle === "sixMonths") return plan.sixMonthPrice;
    return plan.discountedYearlyPrice;
}

function getPlanActualPrice(plan: PricingPlan, billingCycle: BillingCycle) {
    if (billingCycle === "monthly") return plan.monthlyActualPrice;
    if (billingCycle === "threeMonths") return plan.threeMonthActualPrice;
    if (billingCycle === "sixMonths") return plan.sixMonthActualPrice;
    return plan.yearlyActualPrice;
}

function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
        if (typeof window === "undefined") {
            resolve(false);
            return;
        }

        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(true), { once: true });
            existingScript.addEventListener("error", () => resolve(false), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function Pricing() {
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [pricingStatus, setPricingStatus] = useState<"loading" | "ready" | "unavailable">("loading");
    const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
    const [checkoutMessage, setCheckoutMessage] = useState<CheckoutMessage | null>(null);
    const selectedCycle = billingCycles.find((cycle) => cycle.key === billingCycle) || billingCycles[0];

    useEffect(() => {
        let isMounted = true;

        async function loadPricingPlans() {
            try {
                const response = await fetch("/api/pricing-plans", { cache: "no-store" });
                const result = await response.json().catch(() => ({}));
                if (!isMounted) return;
                if (result.source !== "supabase" || !Array.isArray(result.plans)) {
                    setPricingStatus("unavailable");
                    setPlans([]);
                    return;
                }

                const activePlans = result.plans.filter((plan: PricingPlan) => plan.active);
                setPlans(activePlans);
                setPricingStatus(activePlans.length > 0 ? "ready" : "unavailable");
            } catch {
                if (!isMounted) return;
                setPlans([]);
                setPricingStatus("unavailable");
            }
        }

        loadPricingPlans();

        return () => {
            isMounted = false;
        };
    }, []);

    async function handleCheckout(plan: PricingPlan) {
        setCheckoutMessage(null);
        setCheckoutPlanId(plan.id);

        try {
            const isScriptLoaded = await loadRazorpayScript();
            if (!isScriptLoaded || !window.Razorpay) {
                setCheckoutMessage({
                    type: "error",
                    text: "Payment checkout could not be loaded. Please check your connection and try again.",
                });
                return;
            }

            const orderResponse = await fetch("/api/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    planId: plan.id,
                    duration: billingCycle as RazorpayBillingDuration,
                }),
            });
            const orderResult = await orderResponse.json().catch(() => ({}));

            if (!orderResponse.ok) {
                setCheckoutMessage({
                    type: "error",
                    text: orderResult.error || "Unable to start checkout. Please try again.",
                });
                return;
            }

            const key = orderResult.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!key) {
                setCheckoutMessage({
                    type: "error",
                    text: "Payment checkout is not configured yet.",
                });
                return;
            }

            let paymentCompleted = false;
            const checkout = new window.Razorpay({
                key,
                amount: Number(orderResult.amount),
                currency: orderResult.currency || "INR",
                name: "EveBash",
                description: `${plan.name} Plan - ${selectedCycle.label}`,
                order_id: orderResult.order_id,
                handler: async (paymentResponse) => {
                    paymentCompleted = true;
                    setCheckoutPlanId(plan.id);
                    const verifyResponse = await fetch("/api/verify-payment", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(paymentResponse),
                    });
                    const verifyResult = await verifyResponse.json().catch(() => ({}));

                    if (!verifyResponse.ok || !verifyResult.success) {
                        setCheckoutMessage({
                            type: "error",
                            text: verifyResult.error || "Payment verification failed. Please contact support before retrying.",
                        });
                        setCheckoutPlanId(null);
                        return;
                    }

                    setCheckoutMessage({
                        type: "success",
                        text: "Payment verified successfully. Plan activation will be completed by the server.",
                    });
                    setCheckoutPlanId(null);
                },
                modal: {
                    ondismiss: () => {
                        if (paymentCompleted) return;
                        setCheckoutMessage({
                            type: "info",
                            text: "Checkout was closed before payment was completed.",
                        });
                        setCheckoutPlanId(null);
                    },
                },
                theme: {
                    color: "#0f172a",
                },
            });

            checkout.on("payment.failed", (response) => {
                setCheckoutMessage({
                    type: "error",
                    text: response.error?.description || "Payment failed. Please try again.",
                });
                setCheckoutPlanId(null);
            });

            checkout.open();
        } catch {
            setCheckoutMessage({
                type: "error",
                text: "Something went wrong while starting checkout. Please try again.",
            });
        } finally {
            setCheckoutPlanId((current) => (current === plan.id ? null : current));
        }
    }

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

                <div className="mb-10 flex justify-center">
                    <div className="inline-grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-4">
                        {billingCycles.map((cycle) => {
                            const isActive = billingCycle === cycle.key;
                            return (
                                <button
                                    key={cycle.key}
                                    type="button"
                                    onClick={() => setBillingCycle(cycle.key)}
                                    className={`rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                                        isActive
                                            ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                    }`}
                                >
                                    {cycle.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {checkoutMessage && pricingStatus === "ready" && (
                    <div
                        className={`mx-auto mb-8 max-w-2xl rounded-2xl border px-5 py-4 text-center text-sm font-medium ${
                            checkoutMessage.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : checkoutMessage.type === "info"
                                    ? "border-sky-200 bg-sky-50 text-sky-800"
                                    : "border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                    >
                        {checkoutMessage.text}
                    </div>
                )}

                {pricingStatus === "loading" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Loading Pricing</p>
                        <p className="mt-3 text-slate-700">Fetching the latest plans.</p>
                    </div>
                )}

                {pricingStatus === "unavailable" && (
                    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
                        <p className="text-sm font-bold uppercase tracking-widest text-amber-700">Pricing Unavailable</p>
                        <h2 className="mt-3 text-2xl font-serif text-slate-800">Pricing is temporarily unavailable.</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                            We could not load the latest pricing plans right now. Please try again shortly or contact support.
                        </p>
                        <Link href="/contact-us" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800">
                            Contact Support
                        </Link>
                    </div>
                )}

                {/* Pricing Cards */}
                {pricingStatus === "ready" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    {plans.map((plan) => {
                        const visual = planVisuals[plan.id] || planVisuals.starter;
                        const price = getPlanPrice(plan, billingCycle);
                        const actualPrice = getPlanActualPrice(plan, billingCycle);
                        const savings = Math.max(actualPrice - price, 0);
                        const cta = plan.id === "free" ? "Get Started" : `Choose ${plan.name}`;
                        const ctaHref = plan.id === "free" ? "/login" : "/contact-us";
                        const isCheckingOut = checkoutPlanId === plan.id;

                        return (
                        <div
                            key={plan.id}
                            className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col ${visual.accentClass}`}
                        >
                            {/* Badge */}
                            {visual.badge && (
                                <div className={`${visual.badgeColor} text-white text-xs font-bold py-1.5 text-center uppercase tracking-widest`}>
                                    {visual.badge}
                                </div>
                            )}

                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="text-xl font-serif font-bold text-slate-800 mb-2">{plan.name}</h3>

                                {actualPrice > price && (
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(actualPrice)}</span>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                            Save {formatPrice(savings)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-baseline mb-0.5">
                                    <span className="text-3xl font-bold text-slate-900">{formatPrice(price)}</span>
                                </div>
                                <span className="text-slate-600 text-xs font-light mb-2">
                                    {price === 0 ? "forever" : selectedCycle.period}
                                </span>
                                <p className="text-slate-700 font-light text-xs mb-4 min-h-[32px]">{visual.description}</p>

                                <div className="w-full h-px bg-slate-100 mb-4" />

                                <ul className="space-y-2.5 mb-6 flex-1">
                                    {pricingPlanToFeatures(plan).map((feature, idx) => (
                                        <li key={idx} className="flex items-start group">
                                            <div className={`p-1 rounded-full mr-2 shrink-0 mt-px ${visual.checkClass}`}>
                                                <Check className="w-2.5 h-2.5" />
                                            </div>
                                            <span className="text-xs leading-snug text-slate-600 transition-colors group-hover:text-slate-900">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {plan.id === "free" ? (
                                    <Link href={ctaHref} className="block w-full mt-auto">
                                        <div className={`w-full py-3 text-center rounded-xl uppercase tracking-widest text-xs font-bold transition-all duration-300 active:scale-95 ${visual.btnClass}`}>
                                            {cta}
                                        </div>
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleCheckout(plan)}
                                        disabled={isCheckingOut}
                                        className={`w-full py-3 text-center rounded-xl uppercase tracking-widest text-xs font-bold transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${visual.btnClass}`}
                                    >
                                        {isCheckingOut ? "Starting Checkout..." : cta}
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
                )}

                {/* Fair Usage Policy Note */}
                {pricingStatus === "ready" && (
                <div className="mt-10 flex items-start justify-center gap-2 text-center">
                    <Info className="w-4 h-4 text-slate-600 shrink-0 mt-px" />
                    <p className="text-slate-600 text-xs max-w-xl leading-relaxed">
                        <span className="font-semibold text-slate-700">Fair Usage Policy:</span> Bandwidth usage beyond fair limits may incur additional charges.
                        Extra Storage: ₹5/GB &bull; Extra Bandwidth: ₹7–₹10/GB.
                    </p>
                </div>
                )}

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
