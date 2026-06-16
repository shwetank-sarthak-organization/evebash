import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { logGuestLogin } from '@/lib/database';

export function useGuestAccess(
  id: string,
  user: any,
  isOwner: boolean,
  isPrivilegedViewer: boolean,
  event: any,
  setUpdating: (val: boolean) => void
) {
  const [guestStatus, setGuestStatus] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submittedIdentifier, setSubmittedIdentifier] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setGuestName(user.name || '');
      const identifier = user.phone || user.email || user.uid || '';
      setGuestPhone(identifier);
      setSubmittedIdentifier(identifier);
    }
  }, [user]);

  useEffect(() => {
    const loadStoredGuestInfo = async () => {
      if (!user) {
        try {
          const storedName = await AsyncStorage.getItem('@guest_name');
          const storedPhone = await AsyncStorage.getItem('@guest_phone');
          if (storedName) setGuestName(storedName);
          if (storedPhone) {
            setGuestPhone(storedPhone);
            setSubmittedIdentifier(storedPhone);
          }
        } catch (e) {
          console.error('[EventDetail] Failed to load guest info from storage:', e);
        }
      }
    };
    loadStoredGuestInfo();
  }, [user]);

  useEffect(() => {
    if (!id || isOwner || isPrivilegedViewer) {
      return;
    }

    let channel: any = null;
    let isActive = true;

    const checkGuestAccess = async () => {
      const identifiers: string[] = [];
      if (user) {
        if (user.phone) identifiers.push(user.phone);
        if (user.email) identifiers.push(user.email);
        if (user.uid) identifiers.push(user.uid);
      } else if (submittedIdentifier) {
        const normalized = submittedIdentifier.replace(/\D/g, '');
        if (normalized) identifiers.push(normalized);
      }

      if (identifiers.length === 0) {
        if (isActive) setGuestStatus(null);
        return;
      }

      let foundLogId: string | null = null;
      let foundStatus: string | null = null;

      for (const identifier of identifiers) {
        const logId = `${identifier}_${id}`;
        try {
          const { data, error } = await supabase
            .from('guests')
            .select('status')
            .eq('id', logId)
            .maybeSingle();

          if (!error && data) {
            foundLogId = logId;
            foundStatus = data.status || 'pending';
            break;
          }
        } catch (err) {
          console.error('[GuestCheck] Error fetching document:', err);
        }
      }

      if (!isActive) return;

      if (foundLogId && foundStatus) {
        setGuestStatus(foundStatus);
        
        // Listen to changes in guests status using Supabase real-time Websockets
        channel = supabase
          .channel(`guest-status-${foundLogId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'guests', filter: `id=eq.${foundLogId}` },
            (payload) => {
              if (payload.new && payload.new.status && isActive) {
                setGuestStatus(payload.new.status);
              }
            }
          )
          .subscribe();
      } else {
        setGuestStatus(null);
      }
    };

    checkGuestAccess();

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [id, user, submittedIdentifier, isOwner, isPrivilegedViewer]);

  const handleGuestAccess = async () => {
    const nameToSubmit = user ? (user.name || guestName || 'Guest') : guestName.trim();
    const rawPhone = user ? (user.phone || user.email || user.uid) : guestPhone.trim();

    if (!nameToSubmit) {
      Alert.alert("Error", "Please enter your name.");
      return;
    }
    if (!rawPhone) {
      Alert.alert("Error", "Please enter your phone number or email.");
      return;
    }

    const normalizedIdentifier = (!user && !rawPhone.includes('@'))
      ? rawPhone.replace(/\D/g, '')
      : rawPhone;

    if (!normalizedIdentifier) {
      Alert.alert("Error", "Invalid phone number or email.");
      return;
    }

    setUpdating(true);
    try {
      const success = await logGuestLogin(
        nameToSubmit,
        normalizedIdentifier,
        id,
        event?.parentId || event?.id,
        event?.title,
        event?.createdBy,
        'pending'
      );
      if (success) {
        if (!user) {
          try {
            await AsyncStorage.setItem('@guest_name', nameToSubmit);
            await AsyncStorage.setItem('@guest_phone', normalizedIdentifier);
          } catch (e) {
            console.error('[GuestAccess] Failed to save credentials to AsyncStorage:', e);
          }
        }
        setSubmittedIdentifier(normalizedIdentifier);
        const logId = `${normalizedIdentifier}_${id}`;
        setGuestStatus('pending');
        
        // Dynamic one-time listener setup for status updates
        const setupChannel = supabase
          .channel(`guest-status-new-${logId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'guests', filter: `id=eq.${logId}` },
            (payload) => {
              if (payload.new && payload.new.status) {
                setGuestStatus(payload.new.status);
              }
            }
          )
          .subscribe();
      } else {
        Alert.alert("Error", "Failed to send access request.");
      }
    } catch (err) {
      console.error('[GuestAccess] Request error:', err);
      Alert.alert("Error", "An error occurred while sending the request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestAccessAgain = () => {
    setGuestStatus(null);
    setSubmittedIdentifier(null);
  };

  return {
    guestStatus,
    setGuestStatus,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    submittedIdentifier,
    setSubmittedIdentifier,
    handleGuestAccess,
    handleRequestAccessAgain,
  };
}
