import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  TextInput,
} from 'react-native';
import { useAppTheme } from '../../../context/ThemeContext';
import { useAndroidKeyboardHeight } from '../../../hooks/use-android-keyboard-height';

interface RenameEventModalProps {
  visible: boolean;
  onClose: () => void;
  editTitle: string;
  setEditTitle: (val: string) => void;
  editTitleAlign: 'left' | 'center' | 'right';
  setEditTitleAlign?: (val: 'left' | 'center' | 'right') => void;
  onSave: () => void;
  updating: boolean;
  styles: any;
}

export function RenameEventModal({
  visible,
  onClose,
  editTitle,
  setEditTitle,
  onSave,
  updating,
  styles
}: RenameEventModalProps) {
  const { colors, isDark } = useAppTheme();
  // Android: a Modal doesn't shrink for the keyboard, so lift the pop-up above it (#243; 0 on iOS)
  const keyboardHeight = useAndroidKeyboardHeight(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Event Title</Text>

          <TextInput
            style={[
              styles.input,
              {
                minHeight: 90,
                textAlignVertical: 'top',
                paddingTop: 12,
              }
            ]}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Event Name"
            placeholderTextColor={isDark ? colors.slate400 : colors.slate600}
            multiline
            blurOnSubmit={false}
          />

          <Text style={{ fontSize: 11, color: colors.slate400, marginTop: 6, marginBottom: 12 }}>
            Tip: Press Enter / Return to add a new line.
          </Text>

          <TouchableOpacity style={styles.submitBtn} onPress={onSave} disabled={updating}>
            <Text style={styles.submitBtnText}>
              {updating ? 'Updating...' : 'Save Title'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
