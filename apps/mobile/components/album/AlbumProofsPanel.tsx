import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { albumApi, type AlbumRoles, type AlbumSummary } from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles, AlbumStatusChip, ProgressBar } from './albumUi';
import { AlbumWorkspace } from './AlbumWorkspace';
import { RolePicker, rolesComplete } from './RolePicker';
import { albumNextStep, type AlbumNextStepTone } from '../../../../shared/text/albumNextStep';

const STEPS = [
  ['Upload the pages', 'The photographer adds each page design: one image per page or per spread.'],
  ['The client reviews', 'They pin comments on photos to replace, enlarge or edit, by text or voice note.'],
  ['Send new versions', 'Fix what was asked and send the changed pages back, round after round.'],
  ['Approved for print', 'Once every page is approved, the album is locked with the date.'],
] as const;

const NEXT_STEP: Record<AlbumNextStepTone, { color: string; background: string; icon: keyof typeof MaterialIcons.glyphMap | null }> = {
  action: { color: '#E8C9A0', background: 'rgba(202,156,104,0.1)', icon: null },
  urgent: { color: '#FECDD3', background: 'rgba(251,113,133,0.1)', icon: 'chat-bubble-outline' },
  waiting: { color: MidnightColors.slate400, background: 'rgba(255,255,255,0.04)', icon: 'schedule' },
  done: { color: '#A7F3D0', background: 'rgba(52,211,153,0.1)', icon: 'check-circle-outline' },
};

function AlbumCard({ album, onOpen }: { album: AlbumSummary; onOpen: () => void }) {
  const next = albumNextStep(album);
  const role = album.myRole === 'viewer' ? null : `You: ${album.myRole === 'photographer' ? 'Photographer' : 'Client'}`;
  const look = next ? NEXT_STEP[next.tone] : null;
  return (
    <Pressable onPress={onOpen} style={[albumStyles.card, styles.card]} accessibilityRole="button" accessibilityLabel={`Open ${album.title}`}>
      <View style={styles.cover}>
        {album.coverThumbnailUrl ? (
          <Image source={{ uri: album.coverThumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : album.pageCount > 0 ? (
          <MaterialIcons name="photo-album" size={36} color={MidnightColors.slate700} />
        ) : (
          <View style={styles.emptyCover}>
            {album.myRole === 'photographer'
              ? <><MaterialIcons name="add" size={22} color={MidnightColors.gold} /><Text style={styles.emptyCoverText}>Add pages</Text></>
              : <><MaterialIcons name="photo-album" size={26} color={MidnightColors.slate700} /><Text style={[styles.emptyCoverText, { color: MidnightColors.slate400 }]}>No pages yet</Text></>}
          </View>
        )}
        <View style={styles.coverChip}><AlbumStatusChip status={album.status} /></View>
        {album.pageCount > 0 ? (
          <View style={styles.pageStrip}>
            <MaterialIcons name="collections" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.pageStripText}>{album.pageCount} {album.pageCount === 1 ? 'page' : 'pages'}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <Text style={[albumStyles.serifTitle, { fontSize: 21 }]} numberOfLines={1}>{album.title}</Text>
        <View style={{ gap: 6 }}>
          {album.pageCount > 0 ? <ProgressBar value={album.approvedCount} total={album.pageCount} /> : null}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {album.pageCount > 0
                ? <><Text style={{ color: MidnightColors.text }}>{album.approvedCount}</Text> of {album.pageCount} approved</>
                : 'No pages yet'}
            </Text>
            <Text style={styles.meta}>{[album.currentRound > 0 ? `Round ${album.currentRound}` : null, role].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        {next && look ? (
          <View style={[styles.nextStep, { backgroundColor: look.background }]}>
            {look.icon ? <MaterialIcons name={look.icon} size={16} color={look.color} /> : null}
            <Text style={[styles.nextStepText, { color: look.color }]} numberOfLines={1}>{next.label}</Text>
            {next.tone === 'action' || next.tone === 'urgent' ? <MaterialIcons name="arrow-forward" size={16} color={look.color} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

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
          <AlbumCard key={album.id} album={album} onOpen={() => setOpenId(album.id)} />
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
  card: { borderColor: 'rgba(220,181,121,0.26)' },
  cover: { aspectRatio: 1.5, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emptyCover: { ...StyleSheet.absoluteFillObject, margin: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(202,156,104,0.4)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyCoverText: { color: '#E8C9A0', fontSize: 13, fontFamily: Fonts.outfit.bold },
  coverChip: { position: 'absolute', top: 12, right: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.75)' },
  pageStrip: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.7)' },
  pageStripText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: Fonts.outfit.bold },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 2 },
  meta: { color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.outfit.semiBold },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  nextStepText: { flex: 1, fontSize: 13, fontFamily: Fonts.outfit.bold },
});
