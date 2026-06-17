import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  TouchableOpacity,
  View,
  Text,
  TextInput,
  Platform,
  Keyboard,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MidnightColors } from '../../../constants/theme';
import { IconSymbol } from '../../ui/icon-symbol';

interface SubEventModalProps {
  visible: boolean;
  onClose: () => void;
  newSubTitle: string;
  setNewSubTitle: (val: string) => void;
  subDate: string;
  subDateValue: Date;
  showSubDatePicker: boolean;
  setShowSubDatePicker: (visible: boolean) => void;
  onSubDateChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onSave: () => void;
  updating: boolean;
  styles: any;
}

export function SubEventModal({
  visible,
  onClose,
  newSubTitle,
  setNewSubTitle,
  subDate,
  subDateValue,
  showSubDatePicker,
  setShowSubDatePicker,
  onSubDateChange,
  onSave,
  updating,
  styles
}: SubEventModalProps) {
  const savePressRef = React.useRef(false);
  const canSave = newSubTitle.trim().length > 0 && subDate.trim().length > 0 && !updating;

  React.useEffect(() => {
    if (!updating) {
      savePressRef.current = false;
    }
  }, [updating]);

  const handleSave = () => {
    if (!canSave || savePressRef.current) return;
    savePressRef.current = true;
    Keyboard.dismiss();
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, { position: 'relative' }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.modalBackdrop]} />
        <View pointerEvents="auto" style={[styles.modalContent, { zIndex: 10, elevation: 24 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 18 }}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>New Sub-Gallery</Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close new sub-gallery"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)'
              }}
            >
              <Text style={{ color: '#fff', fontSize: 22, lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={newSubTitle}
            onChangeText={setNewSubTitle}
            placeholder="Sub-gallery name"
            placeholderTextColor={MidnightColors.slate400}
            autoFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={handleSave}
          />
          <View style={{ width: '100%', marginTop: 14 }}>
            <Text style={styles.inputLabel}>Sub-Gallery Date</Text>
            <TouchableOpacity
              style={{
                minHeight: 56,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onPress={() => {
                Keyboard.dismiss();
                setShowSubDatePicker(true);
              }}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <IconSymbol name="calendar" size={18} color={MidnightColors.gold} />
                <Text style={{ color: '#fff', fontSize: 16, flex: 1 }}>{subDate}</Text>
              </View>
              <IconSymbol name="chevron.down" size={18} color={MidnightColors.slate400} />
            </TouchableOpacity>
            {showSubDatePicker && (
              <DateTimePicker
                value={subDateValue}
                mode="date"
                display="spinner"
                onChange={onSubDateChange}
                themeVariant="dark"
              />
            )}
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, !canSave && { opacity: 0.55 }]}
            onPressIn={handleSave}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {updating ? <ActivityIndicator size="small" color={MidnightColors.background} /> : null}
              <Text style={styles.submitBtnText}>
              {updating ? 'Creating...' : 'Create Sub-Gallery'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
