import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { POLICY_VERSION, POLICY_PENDING_KEY, matchesAcceptanceIntent } from '../../../shared/legal/acceptance';

export function PolicyAcceptanceGate({ userId, onSignOut, children }: { userId?: string; onSignOut: () => void; children: React.ReactNode }) {
  const [acceptedUser, setAcceptedUser] = useState('');
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  useEffect(() => {
    let active = true;
    setAcceptedUser(''); setChecked(false); setReady(false); setError('');
    if (!userId) return;
    void (async () => {
      const { data, error } = await supabase.rpc('get_policy_acceptance');
      if (error) throw error;
      if (data?.version !== POLICY_VERSION || typeof data?.accepted !== 'boolean') throw new Error('Please update the app to review the latest policies.');
      if (!active) return;
      if (data.accepted) { setAcceptedUser(userId); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;
      const intent = await AsyncStorage.getItem(POLICY_PENDING_KEY).catch(() => null);
      if (email && sessionData.session?.user.id === userId && matchesAcceptanceIntent(intent, email)) {
        const { error: saveError } = await supabase.rpc('accept_current_policies', { p_version: POLICY_VERSION, p_platform: platform, p_accepted: true });
        if (saveError) throw saveError;
        await AsyncStorage.removeItem(POLICY_PENDING_KEY).catch(() => undefined);
        if (active) setAcceptedUser(userId);
      } else if (active) setReady(true);
    })().catch(() => { if (active) setError('We could not check your policy acceptance. Please retry.'); });
    return () => { active = false; };
  }, [userId, retry, platform]);
  const accept = async () => {
    if (!checked || busy || !ready || !userId) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('accept_current_policies', { p_version: POLICY_VERSION, p_platform: platform, p_accepted: true });
      if (error) throw error;
      setAcceptedUser(userId);
    } catch { setError('Your acceptance could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  const open = (path: string) => { void Linking.openURL(`https://www.evebash.com/${path}`).catch(() => setError('Unable to open this policy. Please try again.')); };
  return <>{children}<Modal visible={Boolean(userId && acceptedUser !== userId)} animationType="fade" onRequestClose={() => {}}>
    <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, paddingVertical: 64 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>Before you continue</Text>
      <Text style={{ color: '#cbd5e1', marginVertical: 20, lineHeight: 24 }}>Please review EveBash’s terms and privacy information. This does not grant optional permissions for Find You or marketing.</Text>
      <View style={{ gap: 16 }}>
        <Pressable accessibilityRole="link" onPress={() => open('terms-and-conditions')}><Text style={{ color: '#CA9C68', textDecorationLine: 'underline' }}>Read Terms &amp; Conditions</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => open('privacy-policy')}><Text style={{ color: '#CA9C68', textDecorationLine: 'underline' }}>Read Privacy Policy</Text></Pressable>
        {ready ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => setChecked(!checked)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 16 }}><Text style={{ color: '#CA9C68', fontSize: 24 }}>{checked ? '☑' : '☐'}</Text><Text style={{ flex: 1, color: '#fff', lineHeight: 24 }}>I agree to the Terms &amp; Conditions and acknowledge the Privacy Policy.</Text></Pressable> : !error && <Text accessibilityRole="text" style={{ color: '#fff' }}>Checking policy acceptance…</Text>}
        {!!error && <Text accessibilityRole="alert" style={{ color: '#fca5a5' }}>{error}</Text>}
        {!ready && error ? <Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={{ padding: 16 }}><Text style={{ color: '#fff' }}>Retry</Text></Pressable> : <Pressable accessibilityRole="button" disabled={!ready || !checked || busy} onPress={() => void accept()} style={{ backgroundColor: '#CA9C68', padding: 16, borderRadius: 12, opacity: !ready || !checked || busy ? 0.4 : 1 }}><Text style={{ color: '#0f172a', textAlign: 'center', fontWeight: '700' }}>{busy ? 'Saving…' : 'Accept and continue'}</Text></Pressable>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={onSignOut} style={{ padding: 16 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Sign out</Text></Pressable>
      </View>
    </ScrollView>
  </Modal></>;
}
