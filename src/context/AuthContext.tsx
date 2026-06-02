"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: {
        uid: string;
        name: string;
        phone: string;
        role?: string;
        roleType?: 'primary' | 'event';
        assignedEvents?: string[];
        profileImage?: string;
        email?: string | null;
        delegatedBy?: string;
        username?: string;
    } | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{
        uid: string;
        name: string;
        phone: string;
        role?: string;
        roleType?: 'primary' | 'event';
        assignedEvents?: string[];
        profileImage?: string;
        email?: string | null;
        delegatedBy?: string;
        username?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const syncUserSession = (userData: {
        uid: string;
        name: string;
        phone: string;
        role?: string;
        roleType?: 'primary' | 'event';
        assignedEvents?: string[];
        profileImage?: string;
        email?: string | null;
        delegatedBy?: string;
        username?: string;
    }) => {
        setUser(userData);
        localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
    };

    useEffect(() => {
        let isMounted = true;
        let profileUnsubscribe: (() => void) | undefined;

        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (session?.user && isMounted) {
                    await handleUserSession(session.user);
                } else {
                    const storedUser = localStorage.getItem("wedding_guest_user");
                    if (storedUser && isMounted) {
                        try {
                            const parsed = JSON.parse(storedUser);
                            if (parsed && typeof parsed.uid === "string" && parsed.uid.startsWith("phone_")) {
                                setUser(parsed);
                            }
                        } catch (e) {
                            console.error("[Auth] Failed to parse guest session", e);
                        }
                    }
                    if (isMounted) setLoading(false);
                }
            } catch (err) {
                console.error("[Auth] Error getting session:", err);
                if (isMounted) setLoading(false);
            }
        };

        const handleUserSession = async (supabaseUser: any) => {
            try {
                const { getUserProfile, createUserProfile } = await import("@/lib/firestore");
                
                // Ensure profile exists in Supabase
                const name = supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "Wedding User";
                await createUserProfile(supabaseUser.id, name, supabaseUser.email || "");

                // Fetch fresh profile data
                const profile = await getUserProfile(supabaseUser.id);

                const userData = {
                    uid: supabaseUser.id,
                    name: profile?.name || name,
                    phone: profile?.phone || "No Phone",
                    role: profile?.role || "user",
                    roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary") as any,
                    assignedEvents: profile?.assignedEvents || [],
                    profileImage: profile?.profileImage,
                    email: supabaseUser.email,
                    delegatedBy: profile?.delegatedBy,
                    username: profile?.username || ""
                };

                if (isMounted) {
                    syncUserSession(userData);

                    const profileChannel = supabase
                        .channel(`profile-${supabaseUser.id}`)
                        .on('postgres_changes', {
                            event: '*',
                            schema: 'public',
                            table: 'profiles',
                            filter: `id=eq.${supabaseUser.id}`
                        }, async () => {
                            const updatedProfile = await getUserProfile(supabaseUser.id);
                            if (updatedProfile && isMounted) {
                                syncUserSession({
                                    uid: supabaseUser.id,
                                    name: updatedProfile.name || userData.name,
                                    phone: updatedProfile.phone || userData.phone,
                                    role: updatedProfile.role || userData.role,
                                    roleType: updatedProfile.roleType || userData.roleType,
                                    assignedEvents: updatedProfile.assignedEvents || userData.assignedEvents,
                                    profileImage: updatedProfile.profileImage || userData.profileImage,
                                    email: supabaseUser.email,
                                    delegatedBy: updatedProfile.delegatedBy,
                                    username: updatedProfile.username || ""
                                });
                            }
                        })
                        .subscribe();

                    profileUnsubscribe = () => {
                        supabase.removeChannel(profileChannel);
                    };
                }
            } catch (err) {
                console.error("[Auth] Error handling user session:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("[Auth] Auth state change event:", event);
            if (session?.user) {
                await handleUserSession(session.user);
            } else {
                if (profileUnsubscribe) profileUnsubscribe();
                const storedUser = localStorage.getItem("wedding_guest_user");
                if (storedUser && isMounted) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        if (parsed && typeof parsed.uid === "string" && parsed.uid.startsWith("phone_")) {
                            setLoading(false);
                            return; // Keep phone guest session intact
                        }
                    } catch (e) {
                        console.error("[Auth] Failed to parse guest session on auth change", e);
                    }
                }
                if (isMounted) {
                    setUser(null);
                    localStorage.removeItem("wedding_guest_user");
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            if (profileUnsubscribe) profileUnsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            console.log("Starting login flow for:", email);
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error("Login Error:", error);
            alert(`Login failed: ${error.message || "Invalid credentials"}`);
            return false;
        }
    };

    const signup = async (email: string, password: string, name: string) => {
        try {
            console.log("Starting signup flow for:", email);
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });

            if (error) throw error;

            if (data.user) {
                const { createUserProfile } = await import("@/lib/firestore");
                await createUserProfile(data.user.id, name, email);
            }
            return true;
        } catch (error: any) {
            console.error("Signup Error:", error);
            alert(`Signup failed: ${error.message}`);
            return false;
        }
    };

    const loginWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/profile`
                }
            });

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error("Google Login Error:", error);
            alert(`Google login failed: ${error.message}`);
            return false;
        }
    };

    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error("Reset Password Error:", error);
            alert(`Error resetting password: ${error.message}`);
            return false;
        }
    };

    const loginWithPhoneSimple = async (name: string, phone: string) => {
        try {
            console.log("Simple Phone login:", phone);
            const { getAllowedUser, createUserProfile, getUserProfile, logGuestLogin } = await import("@/lib/firestore");

            const phoneUid = `phone_${phone.replace(/\D/g, "")}`;
            const isMasterAdmin = phone === "8535029872";
            const allowedUser = await getAllowedUser(phone);

            if (!isMasterAdmin && !allowedUser) {
                return false;
            }

            const assignedRole = isMasterAdmin ? "admin" : (allowedUser?.role || "user");
            await createUserProfile(phoneUid, name || allowedUser?.name || "Guest", "", phone, assignedRole);
            const profile = await getUserProfile(phoneUid) as any;

            const userData = {
                uid: phoneUid,
                name: profile?.name || name || allowedUser?.name,
                phone: profile?.phone || phone,
                role: profile?.role || assignedRole,
                roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary") as any,
                assignedEvents: profile?.assignedEvents || [],
                profileImage: profile?.profileImage,
                email: null,
                delegatedBy: profile?.delegatedBy,
                username: profile?.username
            };

            setUser(userData);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            await logGuestLogin(userData.name, phone);
            return true;
        } catch (error: any) {
            console.error("Simple Phone Login Error:", error);
            alert(`Login failed: ${error.message}`);
            return false;
        }
    };

    const authWithEmailLogic = async (name: string, email: string, password: string, phoneStr: string = "") => {
        try {
            let sessionUser;
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("User not found")) {
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { name }
                        }
                    });

                    if (signUpError) throw signUpError;
                    sessionUser = signUpData.user;
                } else {
                    throw signInError;
                }
            } else {
                sessionUser = signInData.user;
            }

            if (!sessionUser) throw new Error("Authentication failed");

            const { createUserProfile, getUserProfile } = await import("@/lib/firestore");
            const existingProfile = await getUserProfile(sessionUser.id);
            const finalPhone = existingProfile?.phone || phoneStr;
            const finalName = existingProfile?.name || name;

            await createUserProfile(sessionUser.id, finalName, email, finalPhone, existingProfile?.role || "user");
            const profile = await getUserProfile(sessionUser.id);

            const userData = {
                uid: sessionUser.id,
                name: profile?.name || finalName,
                phone: profile?.phone || finalPhone,
                role: profile?.role || "user",
                roleType: profile?.roleType || "primary",
                assignedEvents: profile?.assignedEvents || [],
                profileImage: profile?.profileImage,
                email: email,
                delegatedBy: profile?.delegatedBy,
                loginMethod: phoneStr ? "phone" : "email",
                username: profile?.username
            };
            setUser(userData as any);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            return true;
        } catch (error: any) {
            console.error("Auth Error:", error);
            alert(`Authentication failed: ${error.message}`);
            return false;
        }
    };

    const authWithEmail = async (name: string, email: string, password: string) => {
        return await authWithEmailLogic(name, email, password, "");
    };

    const authWithPhone = async (name: string, phone: string, password: string) => {
        const fakeEmail = `${phone.replace(/\D/g, "")}@phone-login.local`;
        return await authWithEmailLogic(name, fakeEmail, password, phone);
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error signing out of Supabase:", error);
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
