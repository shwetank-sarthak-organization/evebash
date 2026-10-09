"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
    const pathname = usePathname();
    const isEventPage = pathname.startsWith("/events/");

    if (pathname === '/login') return null;

    // Guests on an event gallery get a light brand line instead of the marketing footer.
    if (isEventPage) {
        return (
            <footer
                className="event-footer border-t py-8"
                style={{
                    backgroundColor: "var(--event-template-primary)",
                    borderColor: "var(--event-template-border)",
                    color: "var(--event-template-muted)",
                }}
            >
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm sm:flex-row sm:px-6 lg:px-8">
                    <p>
                        Made with{" "}
                        <Link href="/" className="font-semibold underline-offset-4 hover:underline">EveBash</Link>
                        {" · "}
                        <Link href="/login?mode=signup" className="font-semibold underline-offset-4 hover:underline">Create your own event free</Link>
                    </p>
                    <div className="flex gap-5">
                        <Link href="/privacy-policy" className="underline-offset-4 hover:underline">Privacy</Link>
                        <Link href="/terms-and-conditions" className="underline-offset-4 hover:underline">Terms</Link>
                    </div>
                </div>
            </footer>
        );
    }

    return (
        <footer className="bg-[var(--site-bg)] text-[var(--site-muted)] pt-16 pb-8 border-t border-[var(--site-border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
                    {/* Brand Section */}
                    <div className="space-y-6">
                        <Link href="/" className="inline-block">
                            <h3 className="font-serif text-2xl font-bold tracking-tight text-[var(--site-text)] hover:text-[#CA9C68] transition-colors">
                                EveBash
                            </h3>
                        </Link>
                        <p className="text-[var(--site-muted)] leading-relaxed font-light text-base">
                            An event media platform for photographers and event organizers.
                            Upload, organize and share every event&apos;s photos and videos with your clients and guests.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6 lg:pl-8">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Explore</h4>
                        <ul className="space-y-3 text-base">
                            <li>
                                <Link href="/sample-galleries" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Sample Galleries
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/eb-network" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    EB Network
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact-us" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Contact Us
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div className="space-y-6">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Legal</h4>
                        <ul className="space-y-3 text-base">
                            <li>
                                <Link href="/privacy-policy" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-and-conditions" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Terms & Conditions
                                </Link>
                            </li>
                            <li>
                                <Link href="/cancellation-refund-policy" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Cancellation & Refund
                                </Link>
                            </li>
                            <li>
                                <Link href="/digital-service-delivery-policy" className="text-[var(--site-muted)] hover:text-[#CA9C68] transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-[#CA9C68] transition-colors"></span>
                                    Digital Service Delivery
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Contact Us</h4>
                        <div className="space-y-4 text-base">
                            <div className="flex items-start">
                                <MapPin className="w-4 h-4 text-[#CA9C68] mt-1 shrink-0" />
                                <p className="ml-3">
                                    Dehradun, Uttarakhand, India - 248001
                                </p>
                            </div>
                            <div className="flex items-center">
                                <Phone className="w-4 h-4 text-[#CA9C68] shrink-0" />
                                <div className="ml-3">
                                    <p><a href="tel:+919871264964" className="hover:text-[#CA9C68] transition-colors">+91 98712 64964</a></p>
                                    <p><a href="tel:+918535029872" className="hover:text-[#CA9C68] transition-colors">+91 85350 29872</a></p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Mail className="w-4 h-4 text-[#CA9C68] shrink-0" />
                                <a href="mailto:support@evebash.com" className="ml-3 hover:text-[#CA9C68] transition-colors">support@evebash.com</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-16 pt-8 border-t border-[var(--site-border)] flex flex-col md:flex-row justify-between items-center bg-[var(--site-bg)]">
                    <p className="text-sm text-[var(--site-muted)]">
                        &copy; {new Date().getFullYear()} EveBash. All rights reserved.
                    </p>
                    <p className="mt-2 text-sm text-[var(--site-muted)] md:mt-0">
                        Designed with <span className="text-[#CA9C68]">♥</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}
