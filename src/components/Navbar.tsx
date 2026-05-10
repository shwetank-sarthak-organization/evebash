"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Camera, User as UserIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
    { name: "Home", href: "/" },
    { name: "Sample Galleries", href: "/sample-galleries" },
    { name: "Pricing", href: "/pricing" },
    { name: "Contact Us", href: "/contact-us" },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const getPlanLabel = (role?: string) => {
        switch (role) {
            case "admin":    return "Super Admin";
            case "elite":    return "Elite Plan";
            case "premium":  return "Premium Plan";
            case "standard": return "Standard Plan";
            case "basic":    return "Basic Plan";
            default:         return "Free Plan";
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo & Brand */}
                    <Link href="/" className="flex items-center space-x-2 group">
                        <div className="bg-slate-900 text-white p-2 rounded-lg group-hover:bg-slate-800 transition-colors">
                            <Camera className="w-5 h-5" />
                        </div>
                        <span className="font-playfair text-xl font-bold text-slate-900">
                            Lens & Frame
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-slate-900 pb-1 border-b-2 border-transparent",
                                    pathname === link.href
                                        ? "text-slate-900 border-slate-900"
                                        : "text-slate-700 hover:border-slate-300"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}

                        {user ? (
                            <div className="relative ml-4">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-3 px-3 py-1.5 rounded-full border transition-all border-slate-200 hover:bg-slate-50"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[12px] font-bold shadow-sm">
                                        {user.name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <div className="flex flex-col text-left pr-2">
                                        <span className="text-sm font-bold leading-tight text-slate-800">Hi, {user.name?.split(' ')[0]}</span>
                                        <span className="text-[10px] text-slate-500 font-sans leading-tight">{getPlanLabel(user.role)}</span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {profileOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-50"
                                        >
                                            <div className="p-4 border-b border-stone-50 bg-stone-50/50">
                                                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                                <p className="text-[10px] text-stone-500 uppercase tracking-widest truncate mt-0.5">{user.email}</p>
                                            </div>
                                            <div className="p-2 flex flex-col space-y-1">
                                                <Link
                                                    href="/profile"
                                                    className="flex items-center space-x-3 w-full px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-stone-50 rounded-xl transition-all"
                                                    onClick={() => setProfileOpen(false)}
                                                >
                                                    <UserIcon className="w-4 h-4" />
                                                    <span>My Profile</span>
                                                </Link>
                                                <Link
                                                    href={user.role === "admin" && !user.delegatedBy ? "/admin/dashboard" : "/dashboard"}
                                                    className="flex items-center space-x-3 w-full px-3 py-2 text-xs font-bold text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all"
                                                    onClick={() => setProfileOpen(false)}
                                                >
                                                    <Camera className="w-4 h-4" />
                                                    <span>{user.role === "admin" && !user.delegatedBy ? "Admin Dashboard" : "Manage Galleries"}</span>
                                                </Link>
                                                <div className="my-1 border-t border-stone-100"></div>
                                                <button
                                                    onClick={() => {
                                                        setProfileOpen(false);
                                                        logout();
                                                    }}
                                                    className="flex items-center space-x-3 w-full px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    <span>Logout</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors shadow-sm"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <div
                className={cn(
                    "md:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-100 shadow-xl transition-all duration-300 ease-in-out origin-top overflow-hidden",
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                )}
            >
                <div className="px-4 pt-4 pb-6 space-y-2 flex flex-col">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "block px-4 py-3 rounded-lg text-lg font-medium transition-colors",
                                pathname === link.href
                                    ? "text-sky-600 bg-sky-50 font-semibold"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-sky-600"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="pt-4 border-t border-slate-100 mt-2 space-y-3">
                        {user ? (
                            <>
                                <div className="flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-lg mb-2">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200">
                                        <UserIcon className="w-5 h-5 text-slate-700" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                                        <p className="text-xs text-slate-700">{getPlanLabel(user.role)}</p>
                                    </div>
                                </div>
                                <Link
                                    href="/profile"
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "block w-full text-center px-4 py-3 rounded-lg text-lg font-medium transition-colors",
                                        pathname === "/profile" ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    My Profile
                                </Link>
                                {(user) && (
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "block w-full text-center px-4 py-3 rounded-lg text-lg font-medium transition-colors",
                                            pathname === "/dashboard" ? "bg-sky-100 text-sky-600" : "bg-sky-50 text-sky-600 hover:bg-sky-100"
                                        )}
                                    >
                                        Manage Galleries
                                    </Link>
                                )}
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        logout();
                                    }}
                                    className="block w-full text-center px-4 py-3 border border-slate-200 text-slate-600 rounded-lg text-lg font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                onClick={() => setIsOpen(false)}
                                className="block w-full text-center px-4 py-3 bg-slate-900 text-white rounded-lg text-lg font-medium hover:bg-slate-800 transition-colors"
                            >
                                Login
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav >
    );
}
