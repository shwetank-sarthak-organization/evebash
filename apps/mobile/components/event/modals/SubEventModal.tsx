import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  TouchableOpacity,
  View,
  Text,
  TextInput,
  Platform
} from 'react-native';
import { MidnightColors } from '../../../constants/theme';

interface SubEventModalProps {
  visible: boolean;
  onClose: () => void;
  newSubTitle: string;
  setNewSubTitle: (val: string) => void;
  onSave: () => void;
  updating: boolean;
  styles: any;
}

export function SubEventModal({
  visible,
  onClose,
  newSubTitle,
  setNewSubTitle,
  onSave,
  updating,
  styles
}: SubEventModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>New Gallery</Text>
          <TextInput
            style={styles.input}
            value={newSubTitle}
            onChangeText={setNewSubTitle}
            placeholder="e.g. Wedding Reception"
            placeholderTextColor={MidnightColors.slate400}
            autoFocus
          />
          <TouchableOpacity style={styles.submitBtn} onPress={onSave} disabled={updating}>
            <Text style={styles.submitBtnText}>
              {updating ? 'Creating...' : 'Create Gallery'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
