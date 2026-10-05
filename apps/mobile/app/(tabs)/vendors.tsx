import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/Button';
import { useAppTheme } from '@/context/ThemeContext';
import { MidnightColors } from '@/constants/theme';

const CATEGORIES = [
  'Photographer',
  'Videographer',
  'Decorator',
  'Caterer',
  'Venue',
  'Makeup Artist',
  'DJ / Music',
  'Event Planner',
  'Other',
] as const;

const PERKS: { icon: IconSymbolName; title: string; text: string }[] = [
  { icon: 'person.2.fill', title: 'Reach event hosts', text: 'Get discovered by hosts planning weddings, parties and celebrations.' },
  { icon: 'photo.on.rectangle', title: 'Showcase your work', text: 'Build a portfolio straight from the events you cover.' },
  { icon: 'checkmark.seal.fill', title: 'Early partner perks', text: 'Vendors who join now get priority listing at launch.' },
];

const EMPTY_FORM = {
  businessName: '',
  contactName: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  notes: '',
};

type FormField = keyof typeof EMPTY_FORM;

export default function VendorsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [category, setCategory] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.businessName.trim() || !form.contactName.trim() || !form.city.trim() || !form.phone.trim()) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    if (!category) {
      setSubmitError('Please choose a category.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/vendor-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category, source: 'mobile' }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to submit right now.');
      }

      setForm(EMPTY_FORM);
      setCategory('');
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (
    field: FormField,
    label: string,
    placeholder: string,
    options: { keyboardType?: KeyboardTypeOptions; autoCapitalize?: 'none' | 'words' | 'sentences'; multiline?: boolean } = {},
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, options.multiline && styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        keyboardType={options.keyboardType}
        autoCapitalize={options.autoCapitalize}
        multiline={options.multiline}
        textAlignVertical={options.multiline ? 'top' : undefined}
        value={form[field]}
        onChangeText={(value) => updateField(field, value)}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.mainContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <IconSymbol name="sparkles" size={14} color={colors.gold} />
            <Text style={styles.badgeText}>COMING SOON</Text>
          </View>
          <Text style={styles.title}>EveBash Vendors</Text>
          <Text style={styles.subtitle}>
            {`We're building a home for the best event vendors. Register your interest and we'll reach out before launch.`}
          </Text>
        </View>

        <View style={styles.card}>
          {PERKS.map((perk) => (
            <View key={perk.title} style={styles.perkItem}>
              <View style={styles.iconBox}>
                <IconSymbol name={perk.icon} size={22} color={colors.gold} />
              </View>
              <View style={styles.perkTextContainer}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkText}>{perk.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {submitted ? (
            <View style={styles.successState}>
              <IconSymbol name="checkmark.circle.fill" size={48} color={colors.gold} />
              <Text style={styles.formTitle}>{`You're on the list`}</Text>
              <Text style={styles.formSubtitle}>Thanks for registering. Our team will contact you soon.</Text>
              <Button title="Register another business" variant="secondary" onPress={() => setSubmitted(false)} />
            </View>
          ) : (
            <>
              <Text style={styles.formTitle}>Join as a Vendor</Text>
              <Text style={styles.formSubtitle}>Fields marked * are required.</Text>

              {renderInput('businessName', 'BUSINESS NAME *', 'Pixel Stories Studio', { autoCapitalize: 'words' })}
              {renderInput('contactName', 'YOUR NAME *', 'Your full name', { autoCapitalize: 'words' })}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CATEGORY *</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((item) => {
                    const selected = item === category;
                    return (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setCategory(item);
                          setSubmitError('');
                        }}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {renderInput('city', 'CITY *', 'Dehradun', { autoCapitalize: 'words' })}
              {renderInput('phone', 'PHONE *', '+91 98765 43210', { keyboardType: 'phone-pad' })}
              {renderInput('email', 'EMAIL', 'you@example.com', { keyboardType: 'email-address', autoCapitalize: 'none' })}
              {renderInput('website', 'INSTAGRAM / WEBSITE', '@yourstudio', { autoCapitalize: 'none' })}
              {renderInput('notes', 'ANYTHING ELSE?', 'Services, price range, cities you cover...', { multiline: true })}

              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

              <Button title="Register Interest" icon="paperplane.fill" onPress={handleSubmit} loading={submitting} style={{ marginTop: 8 }} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(202, 156, 104, 0.12)',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gold,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.slate400,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.deepSlate,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(202, 156, 104, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  perkTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  perkText: {
    fontSize: 14,
    color: colors.slate400,
    lineHeight: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.slate400,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.slate400,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: isDark ? colors.slate900 : colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
  },
  textArea: {
    minHeight: 110,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: isDark ? colors.slate900 : colors.background,
  },
  chipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(202, 156, 104, 0.16)',
  },
  chipText: {
    fontSize: 14,
    color: colors.slate400,
  },
  chipTextSelected: {
    color: colors.gold,
    fontWeight: '600',
  },
  successState: {
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#be123c',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
});
