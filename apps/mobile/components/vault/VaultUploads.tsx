import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { VaultApiError } from '@/lib/vaultApi';
import { formatBytes } from '@/lib/vaultFiles';
import { UploadCancelToken, uploadVaultFile, type VaultUploadSource } from '@/lib/vaultUpload';

type UploadTask = {
  id: string;
  source: VaultUploadSource;
  folderId: string | null;
  loaded: number;
  status: 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';
  error?: string;
  token: UploadCancelToken;
};

// Two at a time keeps phones responsive and memory low while large files upload in parts.
const PARALLEL_FILES = 2;

export function useVaultUploads(onUploaded: () => void) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const running = useRef(0);
  const queue = useRef<UploadTask[]>([]);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const update = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }, []);

  const pump = useCallback(function pumpQueue() {
    while (running.current < PARALLEL_FILES && queue.current.length > 0) {
      const task = queue.current.shift()!;
      if (task.token.cancelled) continue;
      running.current += 1;
      update(task.id, { status: 'uploading' });
      uploadVaultFile(task.source, task.folderId, (loaded) => update(task.id, { loaded }), task.token)
        .then(() => {
          update(task.id, { status: 'done', loaded: task.source.sizeBytes });
          onUploadedRef.current();
        })
        .catch((error: unknown) => {
          if (task.token.cancelled) return update(task.id, { status: 'cancelled' });
          update(task.id, { status: 'error', error: error instanceof VaultApiError ? error.message : 'Upload failed. Please try again.' });
        })
        .finally(() => {
          running.current -= 1;
          pumpQueue();
        });
    }
  }, [update]);

  const upload = useCallback((sources: VaultUploadSource[], folderId: string | null) => {
    const created = sources.map((source): UploadTask => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source, folderId, loaded: 0, status: 'queued', token: new UploadCancelToken(),
    }));
    setTasks((current) => [...current, ...created]);
    queue.current.push(...created);
    pump();
  }, [pump]);

  const cancel = useCallback((id: string) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      void task.token.cancel();
      return task.status === 'queued' ? { ...task, status: 'cancelled' } : task;
    }));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((current) => current.filter((task) => task.status === 'queued' || task.status === 'uploading'));
  }, []);

  return { tasks, upload, cancel, clearFinished };
}

export function UploadTray({ tasks, onCancel, onClear }: { tasks: UploadTask[]; onCancel: (id: string) => void; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  if (tasks.length === 0) return null;
  const active = tasks.filter((task) => task.status === 'queued' || task.status === 'uploading').length;
  const failed = tasks.filter((task) => task.status === 'error').length;

  return (
    <View style={styles.tray} accessibilityLabel="Uploads">
      <View style={styles.trayHeader}>
        <Text style={styles.trayTitle} accessibilityLiveRegion="polite">
          {active > 0 ? `Uploading ${active} ${active === 1 ? 'file' : 'files'}… Keep the app open.` : failed > 0 ? `${failed} ${failed === 1 ? 'upload' : 'uploads'} failed` : 'Uploads complete'}
        </Text>
        {active === 0 && (
          <TouchableOpacity onPress={onClear} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setCollapsed((value) => !value)} accessibilityRole="button" accessibilityLabel={collapsed ? 'Show uploads' : 'Hide uploads'} hitSlop={8}>
          <IconSymbol name={collapsed ? 'chevron.up' : 'chevron.down'} size={18} color={MidnightColors.slate400} />
        </TouchableOpacity>
      </View>
      {!collapsed && (
        <ScrollView style={{ maxHeight: 220 }}>
          {tasks.map((task) => {
            const percent = task.source.sizeBytes ? Math.round((task.loaded / task.source.sizeBytes) * 100) : task.status === 'done' ? 100 : 0;
            return (
              <View key={task.id} style={styles.taskRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.taskName} numberOfLines={1}>{task.source.name}</Text>
                  {task.status === 'done' && <IconSymbol name="checkmark.circle.fill" size={16} color="#34d399" />}
                  {task.status === 'error' && <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#f87171" />}
                  {(task.status === 'queued' || task.status === 'uploading') && (
                    <TouchableOpacity onPress={() => onCancel(task.id)} accessibilityRole="button" accessibilityLabel={`Cancel ${task.source.name}`} hitSlop={8}>
                      <IconSymbol name="xmark" size={14} color={MidnightColors.slate400} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.taskMeta, task.status === 'error' && { color: '#fca5a5' }]}>
                  {task.status === 'error' ? task.error
                    : task.status === 'cancelled' ? 'Cancelled'
                    : task.status === 'queued' ? `Waiting · ${formatBytes(task.source.sizeBytes)}`
                    : task.status === 'done' ? formatBytes(task.source.sizeBytes)
                    : `${formatBytes(task.loaded)} of ${formatBytes(task.source.sizeBytes)} · ${percent}%`}
                </Text>
                {task.status === 'uploading' && (
                  <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
                    <View style={[styles.fill, { width: `${percent}%` }]} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#141B22', overflow: 'hidden' },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  trayTitle: { flex: 1, color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  clear: { color: MidnightColors.slate400, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  taskRow: { paddingHorizontal: 14, paddingVertical: 10 },
  taskName: { flex: 1, color: '#E2E8F0', fontSize: 13, fontFamily: 'Inter_400Regular' },
  taskMeta: { color: MidnightColors.slate400, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: MidnightColors.gold },
});
