import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

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
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  authWithPhone: (name: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchOrCreateProfile(firebaseUser: FirebaseUser): Promise<AppUser> {
  const db = getFirestore();
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  const name =
    snap.data()?.name ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'Guest';

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid: firebaseUser.uid,
        name,
        email: firebaseUser.email,
        role: 'user',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    uid: firebaseUser.uid,
    name,
    email: firebaseUser.email,
    role: snap.data()?.role || 'user',
    profileImage: snap.data()?.profileImage,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[Auth] AuthProvider mounting...');
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired. User:', firebaseUser?.uid || 'none');
      if (firebaseUser) {
        // Stop any previous profile listener
        if (profileUnsubscribe) profileUnsubscribe();

        const db = getFirestore();
        const profileRef = doc(db, 'users', firebaseUser.uid);

        // First, ensure profile exists
        const snap = await getDoc(profileRef);
        if (!snap.exists()) {
          const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
          await setDoc(profileRef, {
            uid: firebaseUser.uid,
            name,
            email: firebaseUser.email,
            role: 'user',
            createdAt: serverTimestamp(),
          }, { merge: true });
        }

        // Now, set up real-time listener for the profile
        console.log("[Auth] Setting up profile listener for:", firebaseUser.uid);
        profileUnsubscribe = onSnapshot(profileRef, (profileSnap) => {
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            console.log("[Auth] Profile updated:", data.role);
            setUser({
              uid: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || 'User',
              email: data.email || firebaseUser.email,
              role: data.role || 'user',
              roleType: data.roleType || (data.delegatedBy ? 'event' : 'primary'),
              delegatedBy: data.delegatedBy,
              assignedEvents: data.assignedEvents || [],
              profileImage: data.profileImage,
              phone: data.phone,
              shortlisted: data.shortlisted || [],
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("[Auth] Profile listener error:", error);
          setLoading(false);
        });
      } else {
        if (profileUnsubscribe) profileUnsubscribe();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        return { success: false, error: 'Invalid email or password.' };
      }
      if (code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        return { success: false, error: 'An account with this email already exists.' };
      }
      return { success: false, error: 'Sign up failed. Please try again.' };
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
      const credential = await createUserWithEmailAndPassword(auth, phoneEmail, password);
      await updateProfile(credential.user, { displayName: name });

      const db = getFirestore();
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        name,
        email: phoneEmail,
        phone: normalizedPhone,
        role: 'user',
        roleType: 'primary',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      }, { merge: true });

      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';

      if (code === 'auth/email-already-in-use') {
        const loginResult = await login(phoneEmail, password);
        if (loginResult.success) return loginResult;
        return { success: false, error: 'This phone number already has an account. Check your password.' };
      }

      return { success: false, error: 'Phone sign in failed. Please try again.' };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, authWithPhone, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
