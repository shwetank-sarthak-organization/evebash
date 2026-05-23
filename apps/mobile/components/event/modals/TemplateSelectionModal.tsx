import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors, Fonts } from '../../../constants/theme';
import { getTemplatesForEventCategory } from '../../../constants/templates';

interface TemplateSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  event: any;
  handleUpdateTemplate: (id: string) => void;
  styles: any;
}

export function TemplateSelectionModal({
  visible,
  onClose,
  event,
  handleUpdateTemplate,
  styles
}: TemplateSelectionModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const category = event?.category || 'Wedding';
  const templates = getTemplatesForEventCategory(category);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, width: '100%' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold }}>Choose Style</Text>
              <Text style={{ color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.regular, marginTop: 4 }}>
                Select a design template for this {category} event.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeModalCircle, { marginTop: 2 }]}
              onPress={onClose}
            >
              <IconSymbol name="xmark" size={20} color={MidnightColors.gold} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {templates.map((template) => {
              const isActive = (event?.templateId || 'hero') === template.id;
              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateRowCard,
                    isActive && styles.activeTemplateRowCard,
                    { borderColor: isActive ? template.accent : 'rgba(255,255,255,0.06)' }
                  ]}
                  onPress={() => handleUpdateTemplate(template.id)}
                >
                  <View style={styles.templateRowLeft}>
                    <View style={[styles.palettePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
                      <View style={[styles.paletteAccentDot, { backgroundColor: template.accent }]} />
                    </View>
                    
                    <View style={styles.templateRowText}>
                      <Text style={[styles.templateRowName, isActive && { color: template.accent }]}>
                        {template.label}
                      </Text>
                      <Text style={styles.templateRowDesc} numberOfLines={1}>
                        {template.desc}
                      </Text>
                    </View>
                  </View>

                  {isActive && (
                    <View style={[styles.templateCheckCircle, { backgroundColor: template.accent }]}>
                      <IconSymbol name="checkmark" size={10} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {templates.length === 0 && (
              <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20 }}>No templates available.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
