import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  TextInput,
} from 'react-native';
import { MidnightColors } from '../../../constants/theme';

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
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
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
            placeholderTextColor={MidnightColors.slate400}
            multiline
            blurOnSubmit={false}
          />

          <Text style={{ fontSize: 11, color: MidnightColors.slate400, marginTop: 6, marginBottom: 12 }}>
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
