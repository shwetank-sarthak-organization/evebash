import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { albumApi, type AlbumDetail, type AlbumRoleCandidate, type AlbumRoles } from '../../lib/albumApi';
import { Fonts, MidnightColors } from '../../constants/theme';
import { AlbumButton, albumStyles } from './albumUi';

const cache = new Map<string, AlbumRoleCandidate[]>();

export const rolesComplete = (roles: Partial<AlbumRoles>): roles is AlbumRoles =>
  Boolean(roles.photographerId) && Boolean(roles.clientIds?.length);

function Person({ person, selected, disabled, multi, onPress }: {
  person: AlbumRoleCandidate;
  selected: boolean;
  disabled?: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.person, selected && styles.personSelected, disabled && { opacity: 0.4 }]}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
    >
      <MaterialIcons
        name={multi ? (selected ? 'check-box' : 'check-box-outline-blank') : selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={20}
        color={selected ? MidnightColors.gold : MidnightColors.slate600}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
        {!!person.email && <Text style={albumStyles.small} numberOfLines={1}>{person.email}</Text>}
      </View>
      <Text style={[styles.badge, person.isHost && styles.hostBadge]}>{person.isHost ? 'HOST' : 'ADMIN'}</Text>
    </TouchableOpacity>
  );
}

/**
 * Picks the album's photographer (one) and clients (one or more) from the event host and guests with Admin Access.
 * Nobody can hold both roles.
 */
export function RolePicker({ eventId, value, onChange }: {
  eventId: string;
  value: Partial<AlbumRoles>;
  onChange: (roles: Partial<AlbumRoles>) => void;
}) {
  const [candidates, setCandidates] = useState<AlbumRoleCandidate[] | null>(cache.get(eventId) ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cache.has(eventId)) return;
    albumApi.candidates(eventId)
      .then(({ candidates }) => { cache.set(eventId, candidates); setCandidates(candidates); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the guest list."));
  }, [eventId]);

  if (error) return <Text style={[albumStyles.body, { color: MidnightColors.dangerSoft }]}>{error}</Text>;
  if (!candidates) return <ActivityIndicator color={MidnightColors.gold} style={{ marginVertical: 16 }} />;

  const clients = value.clientIds ?? [];
  const toggleClient = (id: string) =>
    onChange({ ...value, clientIds: clients.includes(id) ? clients.filter((c) => c !== id) : [...clients, id] });

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text style={albumStyles.eyebrow}>Photographer · uploads pages and sends them for review</Text>
        {candidates.map((person) => (
          <Person
            key={person.id}
            person={person}
            selected={value.photographerId === person.id}
            disabled={clients.includes(person.id)}
            onPress={() => onChange({ ...value, photographerId: person.id })}
          />
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={albumStyles.eyebrow}>Client · comment, approve and send feedback (one or more)</Text>
        {candidates.map((person) => (
          <Person
            key={person.id}
            person={person}
            multi
            selected={clients.includes(person.id)}
            disabled={value.photographerId === person.id}
            onPress={() => toggleClient(person.id)}
          />
        ))}
      </View>
      {candidates.length < 2 && (
        <Text style={styles.hint}>
          Only the host can be picked right now. Add the photographer or the client as guests and turn on Admin Access in Permissions, then come back.
        </Text>
      )}
    </View>
  );
}

/** "Assign roles" for albums made before roles existed, and "Change roles" from the album menu. */
export function RolesModal({ eventId, albumId, initial, title, onClose, onSaved }: {
  eventId: string;
  albumId: string;
  initial: Partial<AlbumRoles>;
  title: string;
  onClose: () => void;
  onSaved: (album: AlbumDetail) => void;
}) {
  const insets = useSafeAreaInsets();
  const [roles, setRoles] = useState<Partial<AlbumRoles>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!rolesComplete(roles)) return;
    setSaving(true);
    setError('');
    try {
      onSaved((await albumApi.setRoles(albumId, roles)).album);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the roles.");
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => !saving && onClose()}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={albumStyles.eyebrow}>Album roles</Text>
            <Text style={albumStyles.heading}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} disabled={saving} style={{ padding: 8 }} accessibilityLabel="Close">
            <MaterialIcons name="close" size={24} color={MidnightColors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
          <Text style={albumStyles.body}>Pick from the event host and guests with Admin Access.</Text>
          <RolePicker eventId={eventId} value={roles} onChange={setRoles} />
          {!!error && <Text style={[albumStyles.body, { color: MidnightColors.dangerSoft }]}>{error}</Text>}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <AlbumButton label="Cancel" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <AlbumButton kind="primary" label="Save roles" busy={saving} disabled={!rolesComplete(roles)} onPress={save} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MidnightColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  personSelected: { borderColor: MidnightColors.gold, backgroundColor: 'rgba(202,156,104,0.1)' },
  name: { color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.outfit.bold },
  badge: { color: MidnightColors.slate300, backgroundColor: 'rgba(255,255,255,0.1)', fontSize: 9, fontFamily: Fonts.outfit.extraBold, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  hostBadge: { color: '#E8C9A0', backgroundColor: 'rgba(202,156,104,0.15)' },
  hint: { color: '#E8C9A0', fontSize: 12, fontFamily: Fonts.outfit.semiBold, lineHeight: 18, borderWidth: 1, borderColor: 'rgba(202,156,104,0.25)', backgroundColor: 'rgba(202,156,104,0.06)', borderRadius: 14, padding: 12 },
});
