import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { albumApi, type AlbumRoles, type AlbumSummary } from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles, AlbumStatusChip, ProgressBar } from './albumUi';
import { AlbumWorkspace } from './AlbumWorkspace';
import { RolePicker, rolesComplete } from './RolePicker';

const STEPS = [
  ['Upload the pages', 'The photographer adds each page design: one image per page or per spread.'],
  ['The client reviews', 'They pin comments on photos to replace, enlarge or edit, by text or voice note.'],
  ['Send new versions', 'Fix what was asked and send the changed pages back, round after round.'],
  ['Approved for print', 'Once every page is approved, the album is locked with the date.'],
] as const;

/** The event's Album tab: album page proofs (owner and admins only). */
export function AlbumProofsPanel({ eventId, initialAlbumId }: { eventId: string; initialAlbumId?: string }) {
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialAlbumId ?? null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [roles, setRoles] = useState<Partial<AlbumRoles>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlbums((await albumApi.list(eventId)).albums);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load albums.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (initialAlbumId) setOpenId(initialAlbumId); }, [initialAlbumId]);

  if (openId) {
    return <AlbumWorkspace albumId={openId} onBack={() => { setOpenId(null); void load(); }} />;
  }

  const create = async () => {
    if (!title.trim() || !rolesComplete(roles)) return;
    setSaving(true);
    try {
      const { album } = await albumApi.create(eventId, title.trim(), roles);
      setCreating(false);
      setTitle('');
      setRoles({});
      setOpenId(album.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the album.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={albumStyles.heading}>Album Proofs</Text>
        <Text style={albumStyles.body}>Share album page designs, collect changes on each page and get final approval, all in one place.</Text>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {creating ? (
        <View style={styles.createCard}>
          <Text style={albumStyles.eyebrow}>Album name</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Wedding Album" placeholderTextColor={MidnightColors.slate600} maxLength={80} autoFocus style={albumStyles.input} returnKeyType="done" />
          <RolePicker eventId={eventId} value={roles} onChange={setRoles} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <AlbumButton label="Cancel" onPress={() => { setCreating(false); setTitle(''); setRoles({}); }} style={{ flex: 1 }} />
            <AlbumButton kind="primary" label="Create" busy={saving} disabled={!title.trim() || !rolesComplete(roles)} onPress={create} style={{ flex: 1 }} />
          </View>
        </View>
      ) : albums && albums.length > 0 && (
        <AlbumButton kind="primary" icon="add" label="New album" onPress={() => setCreating(true)} />
      )}

      {!albums && !error ? (
        <ActivityIndicator color={MidnightColors.gold} style={{ marginVertical: 32 }} />
      ) : albums && albums.length === 0 && !creating ? (
        <View style={[albumStyles.card, { padding: 18, gap: 14 }]}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={styles.iconBox}><MaterialIcons name="photo-album" size={28} color={MidnightColors.gold} /></View>
            <Text style={[albumStyles.serifTitle, { textAlign: 'center' }]}>Proof the album here, not on WhatsApp</Text>
            <Text style={[albumStyles.body, { textAlign: 'center' }]}>Every comment stays pinned to the photo it is about, every version is kept, and the final approval is on record.</Text>
          </View>
          {STEPS.map(([heading, text], i) => (
            <View key={heading} style={styles.step}>
              <Text style={styles.stepNumber}>STEP {i + 1}</Text>
              <Text style={styles.stepTitle}>{heading}</Text>
              <Text style={albumStyles.small}>{text}</Text>
            </View>
          ))}
          <AlbumButton kind="primary" icon="add" label="Create the first album" onPress={() => setCreating(true)} />
        </View>
      ) : albums && (
        albums.map((album) => (
          <Pressable key={album.id} onPress={() => setOpenId(album.id)} style={albumStyles.card} accessibilityRole="button" accessibilityLabel={`Open ${album.title}`}>
            <View style={styles.cover}>
              {album.coverThumbnailUrl
                ? <Image source={{ uri: album.coverThumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
                : <MaterialIcons name="photo-album" size={36} color={MidnightColors.slate700} />}
            </View>
            <View style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={[albumStyles.serifTitle, { flex: 1, fontSize: 19 }]} numberOfLines={1}>{album.title}</Text>
                <AlbumStatusChip status={album.status} />
              </View>
              <ProgressBar value={album.approvedCount} total={album.pageCount} />
              <Text style={albumStyles.small}>
                {album.approvedCount}/{album.pageCount} approved
                {album.currentRound > 0 ? ` · Round ${album.currentRound}` : ''}
                {album.openRequestCount > 0 ? <Text style={{ color: '#FDA4AF' }}> · {album.openRequestCount} to do</Text> : null}
                {album.myDraftCount > 0 ? <Text style={{ color: '#E8C9A0' }}> · {album.myDraftCount} unsent comments</Text> : null}
                {!album.rolesAssigned
                  ? <Text style={{ color: '#E8C9A0' }}> · Roles not assigned</Text>
                  : album.myRole !== 'viewer' ? ` · You: ${album.myRole === 'photographer' ? 'Photographer' : 'Client'}` : null}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: '#FECDD3', backgroundColor: 'rgba(251,113,133,0.1)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.25)', borderRadius: 14, padding: 12, fontSize: 13, fontFamily: Fonts.outfit.semiBold },
  createCard: { borderWidth: 1, borderColor: 'rgba(202,156,104,0.4)', backgroundColor: 'rgba(202,156,104,0.05)', borderRadius: 18, padding: 14, gap: 10 },
  iconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(202,156,104,0.1)', alignItems: 'center', justifyContent: 'center' },
  step: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 12, gap: 3 },
  stepNumber: { color: MidnightColors.gold, fontSize: 10, fontFamily: Fonts.outfit.extraBold },
  stepTitle: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.outfit.extraBold },
  cover: { aspectRatio: 2, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
