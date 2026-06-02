"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    createUserProfile,
    getAllowedUser,
    getUserProfile,
    logGuestLogin,
} from "@/lib/firestore";

type RoleType = "primary" | "event";

type AppUser = {
    uid: string;
    name: string;
    phone: string;
    role?: string;
    roleType?: RoleType;
    assignedEvents?: string[];
    profileImage?: string;
    email?: string | null;
    delegatedBy?: string;
    username?: string;
};

interface AuthContextType {
    user: AppUser | null;
    login: (email: string, password: string) => Promise<boolean>;
    signup: (email: string, password: string, name: string) => Promise<boolean>;
    loginWithGoogle: () => Promise<boolean>;
    resetPassword: (email: string) => Promise<boolean>;
    loginWithPhoneSimple: (name: string, phone: string) => Promise<boolean>;
    authWithPhone: (name: string, phone: string, password: string) => Promise<boolean>;
    authWithEmail: (name: string, email: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUsername(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
}

function buildUserData(uid: string, email: string | null, fallbackName: string, profile: Awaited<ReturnType<typeof getUserProfile>>): AppUser {
    const name = profile?.name || fallbackName || email?.split("@")[0] || "Wedding User";
    return {
        uid,
        name,
        phone: profile?.phone || "No Phone",
        role: profile?.role || "user",
        roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary"),
        assignedEvents: profile?.assignedEvents || [],
        profileImage: profile?.profileImage,
        email,
        delegatedBy: profile?.delegatedBy,
        username: profile?.username || normalizeUsername(name),
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const syncUserSession = (userData: AppUser) => {
        setUser(userData);
        localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
    };

    const hydrateSupabaseUser = async (uid: string, email: string | null, fallbackName: string) => {
        await createUserProfile(uid, fallbackName, email || "");
        const profile = await getUserProfile(uid);
        syncUserSession(buildUserData(uid, email, fallbackName, profile));
    };

    useEffect(() => {
        let isMounted = true;
        let profileChannel: ReturnType<typeof supabase.channel> | null = null;

        const subscribeToProfile = (uid: string, email: string | null, fallbackName: string) => {
            if (profileChannel) {
                supabase.removeChannel(profileChannel);
            }

            profileChannel = supabase
                .channel(`web-profile-${uid}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
                    async () => {
                        if (!isMounted) return;
                        const profile = await getUserProfile(uid);
                        syncUserSession(buildUserData(uid, email, fallbackName, profile));
                    }
                )
                .subscribe();
        };

        const loadSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const fallbackName =
                        session.user.user_metadata?.name ||
                        session.user.email?.split("@")[0] ||
                        "Wedding User";
                    await hydrateSupabaseUser(session.user.id, session.user.email || null, fallbackName);
                    subscribeToProfile(session.user.id, session.user.email || null, fallbackName);
                } else {
                    const storedUser = localStorage.getItem("wedding_guest_user");
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        if (parsed?.uid?.startsWith("phone_")) {
                            setUser(parsed);
                        } else {
                            localStorage.removeItem("wedding_guest_user");
                            setUser(null);
                        }
                    } else {
                        setUser(null);
                    }
                }
            } catch (error) {
                console.error("[Auth] Supabase session load failed:", error);
                setUser(null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;

            if (session?.user) {
                const fallbackName =
                    session.user.user_metadata?.name ||
                    session.user.email?.split("@")[0] ||
                    "Wedding User";
                await hydrateSupabaseUser(session.user.id, session.user.email || null, fallbackName);
                subscribeToProfile(session.user.id, session.user.email || null, fallbackName);
            } else {
                if (profileChannel) {
                    supabase.removeChannel(profileChannel);
                    profileChannel = null;
                }
                setUser(null);
                localStorage.removeItem("wedding_guest_user");
            }

            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            if (profileChannel) {
                supabase.removeChannel(profileChannel);
            }
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) {
                const fallbackName = data.user.user_metadata?.name || email.split("@")[0] || "Wedding User";
                await hydrateSupabaseUser(data.user.id, data.user.email || email, fallbackName);
            }
            return true;
        } catch (error) {
            console.error("Supabase login error:", error);
            return false;
        }
    };

    const signup = async (email: string, password: string, name: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            });
            if (error) throw error;
            if (data.user) {
                await createUserProfile(data.user.id, name, data.user.email || email);
                const profile = await getUserProfile(data.user.id);
                syncUserSession(buildUserData(data.user.id, data.user.email || email, name, profile));
            }
            return true;
        } catch (error) {
            console.error("Supabase signup error:", error);
            return false;
        }
    };

    const loginWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/profile`,
                },
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Supabase Google login error:", error);
            return false;
        }
    };

    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Supabase reset password error:", error);
            return false;
        }
    };

    const loginWithPhoneSimple = async (name: string, phone: string) => {
        try {
            const phoneUid = `phone_${phone.replace(/\D/g, "")}`;
            const isMasterAdmin = phone === "8535029872";
            const allowedUser = await getAllowedUser(phone);

            if (!isMasterAdmin && !allowedUser) {
                return false;
            }

            const assignedRole = isMasterAdmin ? "admin" : (allowedUser?.role || "user");
            await createUserProfile(phoneUid, name || allowedUser?.name || "Guest", "", phone, assignedRole);

            const profile = await getUserProfile(phoneUid);
            const userData: AppUser = {
                uid: phoneUid,
                name: profile?.name || name || allowedUser?.name || "Guest",
                phone: profile?.phone || phone,
                role: profile?.role || assignedRole,
                roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary"),
                assignedEvents: profile?.assignedEvents || [],
                profileImage: profile?.profileImage,
                email: null,
                delegatedBy: profile?.delegatedBy,
                username: profile?.username,
            };

            syncUserSession(userData);
            await logGuestLogin(userData.name, phone);
            return true;
        } catch (error) {
            console.error("Simple phone login error:", error);
            return false;
        }
    };

    const authWithEmailLogic = async (name: string, email: string, password: string, phone = "") => {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

        if (!loginError && loginData.user) {
            const existingProfile = await getUserProfile(loginData.user.id);
            const finalName = existingProfile?.name || name || loginData.user.email?.split("@")[0] || "Wedding User";
            const finalPhone = existingProfile?.phone || phone;
            await createUserProfile(loginData.user.id, finalName, loginData.user.email || email, finalPhone, existingProfile?.role || "user");
            const profile = await getUserProfile(loginData.user.id);
            syncUserSession(buildUserData(loginData.user.id, loginData.user.email || email, finalName, profile));
            return true;
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });

        if (signupError || !signupData.user) {
            console.error("Supabase email auth error:", signupError || loginError);
            return false;
        }

        await createUserProfile(signupData.user.id, name, signupData.user.email || email, phone);
        const profile = await getUserProfile(signupData.user.id);
        syncUserSession(buildUserData(signupData.user.id, signupData.user.email || email, name, profile));
        return true;
    };

    const authWithEmail = async (name: string, email: string, password: string) => {
        return authWithEmailLogic(name, email, password);
    };

    const authWithPhone = async (name: string, phone: string, password: string) => {
        const fakeEmail = `${phone.replace(/\D/g, "")}@phone-login.local`;
        return authWithEmailLogic(name, fakeEmail, password, phone);
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Supabase logout error:", error);
        }
        setUser(null);
        localStorage.removeItem("wedding_guest_user");
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, resetPassword, loginWithPhoneSimple, authWithPhone, authWithEmail, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
