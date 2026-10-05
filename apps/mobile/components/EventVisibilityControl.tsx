import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function EventVisibilityControl({ eventId, onChanged }: { eventId: string; onChanged: (isPublic: boolean) => void }) {
  const [isPublic, setIsPublic] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setAllowed(false); setError(''); setConfirmPublic(false);
    void (async () => {
      const [permission, event] = await Promise.all([
        supabase.rpc('can_manage_event_visibility', { p_event_id: eventId }),
        supabase.from('events').select('is_public').eq('id', eventId).single(),
      ]);
      if (permission.error || event.error) throw permission.error || event.error;
      if (active) { setAllowed(permission.data === true); setIsPublic(event.data.is_public === true); }
    })().catch(() => { if (active) setError('Unable to load visibility settings. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId, retry]);
  const save = async (next: boolean) => {
    if (!allowed || saving) return;
    setSaving(true); setError('');
    try {
      const { data, error } = await supabase.rpc('set_event_public_viewing', { event_id: eventId, public_viewing: next });
      if (error || typeof data !== 'boolean') throw error || new Error('Invalid response');
      setIsPublic(data); setConfirmPublic(false); onChanged(data);
    } catch { setError('Unable to change visibility. Check your event admin access and try again.'); }
    finally { setSaving(false); }
  };
  if (!loading && !allowed && !error) return null;
  return <View style={{ padding: 14, borderWidth: 1, borderColor: '#64748b', borderRadius: 12, marginVertical: 12 }}>
    <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 10 }}>Event visibility</Text>
    {loading ? <ActivityIndicator color="#CA9C68" /> : allowed && <>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[false, true].map(value => <TouchableOpacity key={String(value)} accessibilityRole="radio" accessibilityState={{ selected: isPublic === value, disabled: saving }} disabled={saving} onPress={() => { if (value === isPublic) { setConfirmPublic(false); return; } if (value) setConfirmPublic(true); else void save(false); }} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: isPublic === value ? '#CA9C68' : '#334155' }}><Text style={{ textAlign: 'center', color: isPublic === value ? '#0f172a' : '#fff' }}>{value ? 'Public' : 'Private'}</Text></TouchableOpacity>)}
      </View>
      <Text style={{ color: '#cbd5e1', marginTop: 10 }}>{isPublic ? 'Anyone with the link can view this event and its sub-galleries. Upload permissions stay separate.' : 'Guests need approval to view this event through its shared link.'}</Text>
      {confirmPublic && <View style={{ marginTop: 12, gap: 10 }}><Text style={{ color: '#fff' }}>Make this event and its sub-galleries viewable by anyone with the link?</Text><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void save(true)} style={{ padding: 12, backgroundColor: '#CA9C68', borderRadius: 8 }}><Text style={{ color: '#0f172a', textAlign: 'center' }}>Make public</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => setConfirmPublic(false)} style={{ padding: 12 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Cancel</Text></TouchableOpacity></View>}
      {saving && <ActivityIndicator color="#CA9C68" style={{ marginTop: 10 }} />}
    </>}
    {!!error && <><Text accessibilityRole="alert" style={{ color: '#fca5a5', marginTop: 10 }}>{error}</Text>{!allowed && <TouchableOpacity accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={{ padding: 12 }}><Text style={{ color: '#fff' }}>Retry</Text></TouchableOpacity>}</>}
  </View>;
}
