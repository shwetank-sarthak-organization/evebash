import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '../../constants/theme';

interface GatedAccessPanelProps {
  event: any;
  selectedTemplate: any;
  isThemeDark: boolean;
  guestStatus: string | null;
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  user: any;
  updating: boolean;
  handleGuestAccess: () => void;
  handleRequestAccessAgain: () => void;
  styles: any;
}

export function GatedAccessPanel({
  event,
  selectedTemplate,
  isThemeDark,
  guestStatus,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  user,
  updating,
  handleGuestAccess,
  handleRequestAccessAgain,
  styles
}: GatedAccessPanelProps) {
  const templateId = event?.templateId;
  const isRoyal = templateId === 'royal';
  const isClassic = templateId === 'classic';
  const isHero = templateId === 'hero';
  const isEthereal = templateId === 'ethereal';
  const isScrapbook = templateId === 'scrapbook';
  const isNeon = templateId === 'neon';
  const isPastel = templateId === 'pastel';
  const isPop = templateId === 'pop';
  const isGoldenYears = templateId === 'golden_years';
  const isVintageNoir = templateId === 'vintage';
  const isRoseGarden = templateId === 'rose';
  const isMinimalLove = templateId === 'minimal_love';
  const isCyberTech = templateId === 'cyber_tech';
  const isRetroArcade = templateId === 'retro_arcade';
  const isAcademicEditorial = templateId === 'academic_editorial';
  const isNeonCarnival = templateId === 'neon_carnival';
  const isGarden = templateId === 'garden';

  const btnTextColor = isThemeDark || isRoyal || isHero ? '#000000' : '#ffffff';

  return (
    <View style={[
      styles.gatedCard,
      {
        backgroundColor: selectedTemplate.panel,
        borderColor: isClassic ? 'rgba(0,0,0,0.05)' : selectedTemplate.accentBg,
        borderRadius: selectedTemplate.radius,
      },
      isScrapbook && styles.scrapbookInfoBox,
      isNeon && styles.neonInfoBox,
      isPastel && styles.pastelInfoBox,
      isPop && styles.popInfoBox,
      isGoldenYears && styles.goldenInfoBox,
      isVintageNoir && styles.vintageInfoBox,
      isRoseGarden && styles.roseInfoBox,
      isMinimalLove && styles.minimalInfoBox,
      isCyberTech && styles.cyberInfoBox,
      isRetroArcade && styles.retroArcadeInfoBox,
      isNeonCarnival && styles.neonCarnivalInfoBox,
      isGarden && styles.gardenInfoBox,
      isClassic && {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
      },
      isRoyal && {
        borderWidth: 1,
        borderColor: 'rgba(204, 164, 59, 0.35)',
        borderRadius: 12,
        padding: 10,
      },
      isHero && {
        borderWidth: 0.8,
        borderColor: '#cca43b',
        borderRadius: 4,
        padding: 12,
      },
      isEthereal && {
        borderWidth: 1,
        borderColor: selectedTemplate.accent + '4d',
        borderRadius: 2,
        padding: 8,
      },
      isAcademicEditorial && {
        borderWidth: 1,
        borderColor: selectedTemplate.text,
        borderRadius: 0,
        padding: 6,
      }
    ]}>
      <View style={[
        styles.gatedInner,
        isScrapbook && styles.scrapbookInfoInner,
        isNeon && styles.neonInfoInner,
        isPastel && styles.pastelInfoInner,
        isPop && styles.popInfoInner,
        isGoldenYears && styles.goldenInfoInner,
        isVintageNoir && styles.vintageInfoInner,
        isRoseGarden && styles.roseInfoInner,
        isMinimalLove && styles.minimalInfoInner,
        isCyberTech && styles.cyberInfoInner,
        isRetroArcade && styles.retroArcadeInfoInner,
        isNeonCarnival && styles.neonCarnivalInfoInner,
        isGarden && styles.gardenInfoInner,
        isRoyal && {
          borderWidth: 1,
          borderColor: 'rgba(204, 164, 59, 0.15)',
          borderRadius: 8,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center' as const,
        },
        isHero && {
          borderWidth: 0.8,
          borderColor: 'rgba(204, 164, 59, 0.25)',
          borderRadius: 2,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center' as const,
        },
        isEthereal && {
          borderWidth: 0.5,
          borderColor: selectedTemplate.accent + '33',
          borderRadius: 1,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center' as const,
        },
        isAcademicEditorial && {
          borderWidth: 0.5,
          borderColor: selectedTemplate.text + '26',
          borderRadius: 0,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center' as const,
          backgroundColor: selectedTemplate.background,
        }
      ]}>
        {guestStatus === 'pending' ? (
          <View style={styles.gatedContentCenter}>
            <View style={[styles.gatedIconWrapper, { backgroundColor: selectedTemplate.accentBg }]}>
              <IconSymbol name="clock.fill" size={32} color={selectedTemplate.accent} />
            </View>
            <Text style={[
              styles.gatedTitle,
              { color: selectedTemplate.text },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
            ]}>
              Request Pending
            </Text>
            <Text style={[
              styles.gatedDesc,
              { color: selectedTemplate.muted },
              selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
            ]}>
              Your access request has been sent to the host. You will be able to view photos and write in the guestbook once approved.
            </Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: selectedTemplate.accentBg, borderColor: selectedTemplate.accent }
            ]}>
              <Text style={[styles.statusBadgeText, { color: selectedTemplate.accent }]}>
                Pending Approval
              </Text>
            </View>
          </View>
        ) : guestStatus === 'rejected' ? (
          <View style={styles.gatedContentCenter}>
            <View style={[styles.gatedIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <IconSymbol name="shield.fill" size={32} color="#ef4444" />
            </View>
            <Text style={[
              styles.gatedTitle,
              { color: selectedTemplate.text },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
            ]}>
              Access Restricted
            </Text>
            <Text style={[
              styles.gatedDesc,
              { color: selectedTemplate.muted },
              selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
            ]}>
              Your request to join this private gallery was declined by the host. Please check your details and try again.
            </Text>
            <TouchableOpacity
              style={[
                styles.gatedBtn,
                { backgroundColor: selectedTemplate.accent, borderRadius: selectedTemplate.radius || 12 }
              ]}
              onPress={handleRequestAccessAgain}
            >
              <Text style={[styles.gatedBtnText, { color: btnTextColor }]}>
                Request Access Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.gatedIconWrapper, { backgroundColor: selectedTemplate.accentBg }]}>
              <IconSymbol name="lock.fill" size={32} color={selectedTemplate.accent} />
            </View>
            <Text style={[
              styles.gatedTitle,
              { color: selectedTemplate.text },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
            ]}>
              Private Event
            </Text>
            <Text style={[
              styles.gatedDesc,
              { color: selectedTemplate.muted },
              selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
            ]}>
              This event is private. Please request access to view the event memories.
            </Text>

            {!user && (
              <View style={{ width: '100%', marginTop: 8 }}>
                <TextInput
                  style={[
                    styles.gatedInput,
                    {
                      backgroundColor: isThemeDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                      borderColor: isThemeDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                      color: selectedTemplate.text,
                    }
                  ]}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Your Name"
                  placeholderTextColor={selectedTemplate.muted}
                />
                <TextInput
                  style={[
                    styles.gatedInput,
                    {
                      backgroundColor: isThemeDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                      borderColor: isThemeDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                      color: selectedTemplate.text,
                    }
                  ]}
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                  placeholder="Phone Number"
                  placeholderTextColor={selectedTemplate.muted}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.gatedBtn,
                { backgroundColor: selectedTemplate.accent, borderRadius: selectedTemplate.radius || 12 },
                updating && { opacity: 0.7 }
              ]}
              onPress={handleGuestAccess}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color={btnTextColor} />
              ) : (
                <Text style={[styles.gatedBtnText, { color: btnTextColor }]}>
                  Request Access
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
