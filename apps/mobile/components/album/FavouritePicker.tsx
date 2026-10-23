import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { albumApi, type AlbumPhoto } from '../../lib/albumApi';
import { MidnightColors } from '../../constants/theme';
import { albumStyles } from './albumUi';

const cache = new Map<string, AlbumPhoto[]>();
const COLUMNS = 3;

/** The client's favourites (their album picks), to choose the photo that should go in instead. */
export function FavouritePicker({ albumId, selectedId, onPick, onClose }: {
  albumId: string;
  selectedId: string | null;
  onPick: (photo: AlbumPhoto) => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(cache.get(albumId) ?? null);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = (width - 32 - (COLUMNS - 1) * 6) / COLUMNS;

  useEffect(() => {
    if (cache.has(albumId)) return;
    albumApi.favourites(albumId)
      .then(({ photos }) => { cache.set(albumId, photos); setPhotos(photos); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load favourites."));
  }, [albumId]);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={albumStyles.eyebrow}>Replace with</Text>
            <Text style={albumStyles.heading}>Pick from favourites</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close">
            <MaterialIcons name="close" size={24} color={MidnightColors.text} />
          </TouchableOpacity>
        </View>
        {error ? (
          <Text style={[albumStyles.body, { color: MidnightColors.dangerSoft, padding: 16 }]}>{error}</Text>
        ) : !photos ? (
          <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 40 }} />
        ) : photos.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="favorite-border" size={32} color={MidnightColors.gold} />
            <Text style={[albumStyles.body, { textAlign: 'center' }]}>
              No favourites yet. Mark photos as favourites in the galleries, then pick one here. You can also describe the photo you want in the comment.
            </Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            numColumns={COLUMNS}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 6 }}
            columnWrapperStyle={{ gap: 6 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={[styles.tile, { width: size, height: size }, item.id === selectedId && styles.selected]}
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === selectedId }}
              >
                {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MidnightColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  close: { padding: 8 },
  empty: { alignItems: 'center', gap: 12, padding: 32 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: MidnightColors.gold },
});
