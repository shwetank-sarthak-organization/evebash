import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeModules } from 'react-native';

type GoogleSigninModule = {
  configure: (options: { webClientId: string; iosClientId: string }) => void;
  hasPlayServices: () => Promise<boolean> | boolean;
  signIn: () => Promise<any>;
};

let googleSigninModule: GoogleSigninModule | null | undefined;
let googleSigninConfigured = false;

const getGoogleSignin = async (): Promise<GoogleSigninModule | null> => {
  if (googleSigninModule !== undefined) return googleSigninModule;

  if (!NativeModules.RNGoogleSignin) {
    googleSigninModule = null;
    return googleSigninModule;
  }

  try {
    const module = await import('@react-native-google-signin/google-signin');
    googleSigninModule = module.GoogleSignin;
  } catch (err) {
    console.warn('[Auth] Google Sign-In native module is unavailable in this build:', err);
    googleSigninModule = null;
  }

  return googleSigninModule;
};

const configureGoogleSignin = async () => {
  const GoogleSignin = await getGoogleSignin();
  if (!GoogleSignin || googleSigninConfigured) return GoogleSignin;

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID_HERE',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'YOUR_IOS_CLIENT_ID_HERE',
  });
  googleSigninConfigured = true;

  return GoogleSignin;
};

const getAuthErrorMessage = (err: any, fallback: string) => {
  const rawMessage = typeof err?.message === 'string' ? err.message : '';
  const rawText = `${rawMessage} ${err?.name || ''} ${err?.code || ''}`;

  if (
    err?.status === 503 ||
    rawText.includes('network_request_failed') ||
    rawText.includes('Network request failed') ||
    rawText.includes('Supabase request timed out') ||
    rawText.includes('AuthRetryableFetchError')
  ) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  return rawMessage || fallback;
};

interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  roleType?: 'primary' | 'event';
  delegatedBy?: string;
  assignedEvents?: string[];
  profileImage?: string;
  phone?: string;
  shortlisted?: string[];
  username?: string;
  isPrivate?: boolean;
  createdAt?: any;
  location?: string;
  gender?: string;
  relationshipStatus?: string;
  persona?: string | string[];
  discoverable?: boolean;
  notificationPreferences?: any;
  birthday?: string;
  anniversaryDate?: string;
  subscriptionDuration?: string;
  planStartDate?: string;
  planEndDate?: string;
  displayName?: string;
  phoneNumber?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }>;
  authWithPhone: (name: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithApple: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[Auth] AuthProvider mounting...');
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configureGoogleSignin();

    let isMounted = true;
    let profileUnsubscribe: (() => void) | undefined;
    let authLoadingFallback: ReturnType<typeof setTimeout> | undefined;

    const finishAuthLoading = () => {
      if (authLoadingFallback) {
        clearTimeout(authLoadingFallback);
        authLoadingFallback = undefined;
      }
      if (isMounted) setLoading(false);
    };

    // Fetch initial session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // If it is a refresh token or invalid grant error, we want to clear the storage
          const isRefreshTokenError = 
            error.message?.includes('Refresh Token') || 
            error.message?.includes('invalid_grant') ||
            error.status === 400;
          
          if (isRefreshTokenError) {
            console.warn('[Auth] Stale or invalid refresh token found. Clearing session via signOut.');
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn('[Auth] Failed to sign out during session cleanup:', signOutErr);
            }
          }
          throw error;
        }
        if (session?.user && isMounted) {
          await handleUserSession(session.user);
        } else {
          finishAuthLoading();
        }
      } catch (err) {
        console.warn('[Auth] Error getting initial session (or handled session refresh failure):', err);
        finishAuthLoading();
      }
    };

    const handleUserSession = async (supabaseUser: SupabaseUser) => {
      try {
        // Stop any previous profile listener
        if (profileUnsubscribe) profileUnsubscribe();

        const fallbackName = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';
        if (isMounted) {
          setUser({
            uid: supabaseUser.id,
            name: fallbackName,
            displayName: fallbackName,
            email: supabaseUser.email || null,
            role: 'user',
            username: undefined,
            isPrivate: false,
          });
          finishAuthLoading();
        }

        // Ensure profile exists in 'profiles' table
        try {
          const { data: existingProfile, error: getErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', supabaseUser.id)
            .maybeSingle();

          if (getErr) throw getErr;

          if (!existingProfile) {
            const name = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';
            const { error: insertErr } = await supabase
              .from('profiles')
              .insert({
                id: supabaseUser.id,
                name,
                email: supabaseUser.email || null,
                role: 'user',
              });
            if (insertErr) throw insertErr;
          }
        } catch (docErr) {
          const nameVal = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';
          setUser({
            uid: supabaseUser.id,
            name: nameVal,
            displayName: nameVal,
            email: supabaseUser.email || null,
            role: 'user',
            username: undefined,
            isPrivate: false,
          });
          finishAuthLoading();
          return;
        }

        // Now, set up real-time listener for the profile
        console.log("[Auth] Setting up profile listener for:", supabaseUser.id);
        
        const fetchAndSetUser = async () => {
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', supabaseUser.id)
              .maybeSingle();
              
            if (error) throw error;
            if (profile && isMounted) {
              // Fetch assigned events
              const { data: assignments } = await supabase
                .from('profile_assigned_events')
                .select('event_id')
                .eq('profile_id', supabaseUser.id);
              const assignedEvents = (assignments || []).map(a => a.event_id);

              const nameVal = profile.name || supabaseUser.user_metadata?.name || 'User';
              setUser({
                uid: supabaseUser.id,
                name: nameVal,
                displayName: nameVal,
                email: profile.email || supabaseUser.email || null,
                role: profile.role || 'user',
                roleType: profile.role_type || (profile.delegated_by ? 'event' : 'primary'),
                delegatedBy: profile.delegated_by || undefined,
                assignedEvents: assignedEvents,
                profileImage: profile.profile_image || undefined,
                phone: profile.phone || undefined,
                phoneNumber: profile.phone || undefined,
                shortlisted: profile.shortlisted || [],
                username: profile.username || undefined,
                isPrivate: profile.is_private ?? false,
                createdAt: profile.created_at,
                location: profile.location || undefined,
                gender: profile.gender || undefined,
                relationshipStatus: profile.relationship_status || undefined,
                persona: profile.persona || undefined,
                discoverable: profile.discoverable ?? true,
                notificationPreferences: profile.notification_preferences || null,
                birthday: profile.birthday || undefined,
                anniversaryDate: profile.anniversary_date || undefined,
                subscriptionDuration: profile.subscription_duration || undefined,
                planStartDate: profile.plan_start_date || undefined,
                planEndDate: profile.plan_end_date || undefined,
              });
            }
            finishAuthLoading();
          } catch (err) {
            console.error("[Auth] Error fetching user profile:", err);
            finishAuthLoading();
          }
        };

        fetchAndSetUser();

        const profileChannel = supabase
          .channel(`profile-${supabaseUser.id}-${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${supabaseUser.id}` 
          }, () => {
            console.log("[Auth] Profile updated dynamically in Postgres");
            fetchAndSetUser();
          })
          .subscribe();

        profileUnsubscribe = () => {
          supabase.removeChannel(profileChannel);
        };
      } catch (err) {
        console.error('[Auth] handleUserSession error:', err);
        finishAuthLoading();
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange fired. Event:', event, 'User:', session?.user?.id || 'none');
      if (session?.user) {
        await handleUserSession(session.user);
      } else {
        if (profileUnsubscribe) profileUnsubscribe();
        if (isMounted) {
          setUser(null);
          finishAuthLoading();
        }
      }
    });

    return () => {
      isMounted = false;
      if (authLoadingFallback) clearTimeout(authLoadingFallback);
      subscription.unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      const message = getAuthErrorMessage(err, 'Login failed. Please try again.');
      return { success: false, error: message };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });
      if (error) throw error;

      const needsEmailVerification = !!(data.user && data.session === null);

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            email,
            role: 'user',
          });
        if (profileError) {
          console.warn("[Auth] Profile insert error on signup:", profileError);
        }
      }

      return { success: true, needsEmailVerification };
    } catch (err: any) {
      const message = getAuthErrorMessage(err, 'Sign up failed. Please try again.');
      return { success: false, error: message };
    }
  };

  const authWithPhone = async (
    name: string,
    phone: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone) {
      return { success: false, error: 'Please enter a valid phone number.' };
    }

    const phoneEmail = `${normalizedPhone}@phone-login.local`;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: phoneEmail,
        password: password,
        options: {
          data: {
            name,
            phone: normalizedPhone,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already exists')) {
          const loginResult = await login(phoneEmail, password);
          if (loginResult.success) return loginResult;
          return { success: false, error: 'This phone number already has an account. Check your password.' };
        }
        throw error;
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            email: phoneEmail,
            phone: normalizedPhone,
            role: 'user',
            role_type: 'primary',
          });
        if (profileError) {
          console.warn("[Auth] Profile insert error on phone signup:", profileError);
        }
      }

      return { success: true };
    } catch (err: any) {
      const message = getAuthErrorMessage(err, 'Phone sign in failed. Please try again.');
      return { success: false, error: message };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const GoogleSignin = await configureGoogleSignin();
      if (!GoogleSignin) {
        return {
          success: false,
          error: 'Google sign-in is not available in this app build. Rebuild the native app to enable it.',
        };
      }

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      // @ts-ignore - Handle both v10 and v11/12 return structures
      const idToken = response.data?.idToken || response.idToken;
      if (!idToken) throw new Error('No ID token present!');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.warn('Google sign-in failed:', err);
      return { success: false, error: getAuthErrorMessage(err, 'Google sign-in failed.') };
    }
  };

  const loginWithApple = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
        return { success: true };
      } else {
        throw new Error('No identity token.');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, error: 'User canceled.' };
      }
      return { success: false, error: getAuthErrorMessage(err, 'Apple sign-in failed.') };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: getAuthErrorMessage(err, 'Failed to send reset email.') };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Error during supabase.auth.signOut():', err);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, authWithPhone, loginWithGoogle, loginWithApple, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.warn('[Auth] useAuth was called outside AuthProvider. Returning loading state as fallback.');
    return {
      user: null,
      loading: true,
      login: async () => ({ success: false, error: 'Auth context not ready' }),
      signup: async () => ({ success: false, error: 'Auth context not ready' }),
      authWithPhone: async () => ({ success: false, error: 'Auth context not ready' }),
      loginWithGoogle: async () => ({ success: false, error: 'Auth context not ready' }),
      loginWithApple: async () => ({ success: false, error: 'Auth context not ready' }),
      resetPassword: async () => ({ success: false, error: 'Auth context not ready' }),
      logout: async () => {},
    };
  }
  return ctx;
}
