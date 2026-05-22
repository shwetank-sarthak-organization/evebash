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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '../../../constants/theme';

interface GalleryDescriptionModalProps {
  visible: boolean;
  onClose: () => void;
  activeSubEvent: any;
  galleryDescText: string;
  setGalleryDescText: (val: string) => void;
  onSave: () => void;
  selectedTemplate: any;
  styles: any;
}

export function GalleryDescriptionModal({
  visible,
  onClose,
  activeSubEvent,
  galleryDescText,
  setGalleryDescText,
  onSave,
  selectedTemplate,
  styles
}: GalleryDescriptionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
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
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Gallery Message</Text>
              <Text style={styles.headerGreeting}>
                For: {activeSubEvent ? activeSubEvent.title : 'Home Gallery'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gallery Welcome Message</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    minHeight: 120,
                    textAlignVertical: 'top',
                    padding: 12,
                    backgroundColor: MidnightColors.deepSlate,
                    borderRadius: 8,
                    color: '#fff'
                  }
                ]}
                value={galleryDescText}
                onChangeText={setGalleryDescText}
                placeholder="Write a beautiful welcome message for this gallery..."
                placeholderTextColor={MidnightColors.slate700}
                multiline
                numberOfLines={5}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: selectedTemplate.accent, marginTop: 12 }]}
              onPress={onSave}
            >
              <Text style={[styles.submitBtnText, { color: '#000', fontWeight: 'bold' }]}>
                Save Message
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
