import React from 'react';
import { Text, View } from 'react-native';
import { Fonts, MidnightColors } from '../../constants/theme';
import type { TemplateTheme } from '../../constants/templates';

// The event type's own themes that can't be picked yet, under a theme picker's list (shared/themes/activeThemes.ts).
// Uses the picker's own row styles, greyed out and not tappable.
export function ComingSoonTemplates({ templates, isDark, styles }: {
  templates: TemplateTheme[];
  isDark: boolean;
  /** The picker's styles: templateRowCard, templateRowLeft, palettePreview, paletteAccentDot, templateRowText, templateRowName, templateRowDesc */
  styles: any;
}) {
  if (templates.length === 0) return null;
  return (
    <View>
      <Text style={{ marginTop: 18, marginBottom: 10, color: MidnightColors.slate400, fontSize: 11, letterSpacing: 1.4, fontFamily: Fonts.inter.bold }}>
        COMING SOON
      </Text>
      {templates.map((template) => (
        <View
          key={template.id}
          style={[styles.templateRowCard, { opacity: 0.5, borderColor: 'rgba(255,255,255,0.06)' }]}
          accessible
          accessibilityLabel={`${template.label}, coming soon`}
        >
          <View style={styles.templateRowLeft}>
            <View style={[styles.palettePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
              <View style={[styles.paletteAccentDot, { backgroundColor: template.accent }]} />
            </View>
            <View style={styles.templateRowText}>
              <Text style={styles.templateRowName}>{template.label}</Text>
              <Text style={styles.templateRowDesc} numberOfLines={1}>{template.desc}</Text>
            </View>
          </View>
          <Text style={{ color: MidnightColors.gold, fontSize: 11, fontFamily: Fonts.inter.semiBold }}>Coming soon</Text>
        </View>
      ))}
    </View>
  );
}
