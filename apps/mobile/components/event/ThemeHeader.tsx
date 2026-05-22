import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '../../constants/theme';
import { BohemianEqualizer } from './BohemianEqualizer';

interface ThemeHeaderProps {
  event: any;
  selectedTemplate: any;
  activeSubEvent: any;
  subEvents: any[];
  handleSubEventChange: (sub: any) => void;
  styles: any;
}

export function ThemeHeader({
  event,
  selectedTemplate,
  activeSubEvent,
  subEvents,
  handleSubEventChange,
  styles,
}: ThemeHeaderProps) {
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
  const isBohemian = templateId === 'bohemian';
  const isThemeHeader = isRoyal || isClassic || isHero || isEthereal || isGarden;

  const birthdayTextColor = isScrapbook ? selectedTemplate.text : (isNeon ? '#f8f7ff' : (isPastel ? '#6c5d59' : (isPop ? '#231f20' : (isGoldenYears ? '#5b432c' : (isVintageNoir ? '#F2E7D2' : (isRoseGarden ? '#562733' : (isMinimalLove ? '#4a2f1d' : (isCyberTech ? '#00f0ff' : (isRetroArcade ? '#231f20' : (isNeonCarnival ? '#d946ef' : '#cca43b'))))))))));

  const birthdayActiveText = isScrapbook ? styles.scrapbookVisitorTabTextActive : (isNeon ? styles.neonVisitorTabTextActive : (isPastel ? styles.pastelVisitorTabTextActive : (isPop ? styles.popVisitorTabTextActive : (isGoldenYears ? styles.goldenVisitorTabTextActive : (isVintageNoir ? styles.vintageVisitorTabTextActive : (isRoseGarden ? styles.roseVisitorTabTextActive : (isMinimalLove ? styles.minimalVisitorTabTextActive : (isCyberTech ? styles.cyberVisitorTabTextActive : (isRetroArcade ? styles.retroArcadeVisitorTabTextActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabTextActive : styles.visitorTabTextActive))))))))));

  const birthdayActiveTab = isScrapbook ? styles.scrapbookVisitorTabActive : (isNeon ? styles.neonVisitorTabActive : (isPastel ? styles.pastelVisitorTabActive : (isPop ? styles.popVisitorTabActive : (isGoldenYears ? styles.goldenVisitorTabActive : (isVintageNoir ? styles.vintageVisitorTabActive : (isRoseGarden ? styles.roseVisitorTabActive : (isMinimalLove ? styles.minimalVisitorTabActive : (isCyberTech ? styles.cyberVisitorTabActive : (isRetroArcade ? styles.retroArcadeVisitorTabActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabActive : styles.visitorTabActive))))))))));

  const birthdayTabStyles = [
    isScrapbook && styles.scrapbookVisitorTab,
    isNeon && styles.neonVisitorTab,
    isPastel && styles.pastelVisitorTab,
    isPop && styles.popVisitorTab,
    isGoldenYears && styles.goldenVisitorTab,
    isVintageNoir && styles.vintageVisitorTab,
    isRoseGarden && styles.roseVisitorTab,
    isMinimalLove && styles.minimalVisitorTab,
    isCyberTech && styles.cyberVisitorTab,
    isRetroArcade && styles.retroArcadeVisitorTab,
    isNeonCarnival && styles.neonCarnivalVisitorTab,
  ];

  const themeHeaderTab = (active: boolean) => ({
    backgroundColor: isHero ? (active ? 'rgba(204, 164, 59, 0.08)' : 'transparent')
      : isGarden ? (active ? '#2E6F40' : 'transparent') : 'transparent',
    borderWidth: isHero ? 0.8 : isGarden ? (active ? 0 : 0) : 0,
    borderColor: 'transparent',
    borderRadius: isHero ? 4 : isGarden ? 999 : 0,
    paddingHorizontal: isGarden ? 12 : 16,
    paddingVertical: isHero ? 8 : isGarden ? 8 : 6,
    flexDirection: isHero ? 'row' as const : 'column' as const,
    gap: 2,
    marginHorizontal: isHero ? 4 : isGarden ? 0 : 0,
    alignSelf: 'center' as const,
  });

  const themeTextColor = (active: boolean) => active
    ? (isGarden ? '#FFFFFF' : (isHero ? '#cca43b' : (isRoyal ? '#fff' : (isEthereal ? selectedTemplate.accent : '#cca43b'))))
    : (isGarden ? '#64748b' : (isHero ? '#94a3b8' : selectedTemplate.muted));

  const academicTabStyle = {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 0,
  };

  const renderTabText = (tab: any, isActive: boolean, indexStr?: string) => {
    const title = tab?.title ?? 'Home';
    const isHome = !tab;
    const displayTitle = isHome ? (
      isBohemian ? 'HOME' : (
        (isCyberTech || isNeonCarnival) ? (isActive ? '[ HOME ]' : '  HOME  ') : (
          isRetroArcade ? 'HOME' : (isAcademicEditorial ? '01 / HOME' : 'Home')
        )
      )
    ) : (
      (isCyberTech || isNeonCarnival) ? (isActive ? `[ ${title.toUpperCase()} ]` : `  ${title.toUpperCase()}  `) : (
        isRetroArcade ? title.toUpperCase() : (
          isAcademicEditorial ? `${indexStr} / ${title.toUpperCase()}` : title
        )
      )
    );

    return (
      <Text style={[
        styles.visitorTabText,
        { color: isThemeHeader ? themeTextColor(isActive) : birthdayTextColor },
        isScrapbook && styles.scrapbookVisitorTabText,
        isNeon && styles.neonVisitorTabText,
        isPastel && styles.pastelVisitorTabText,
        isPop && styles.popVisitorTabText,
        isGoldenYears && styles.goldenVisitorTabText,
        isVintageNoir && styles.vintageVisitorTabText,
        isRoseGarden && styles.roseVisitorTabText,
        isMinimalLove && styles.minimalVisitorTabText,
        isCyberTech && styles.cyberVisitorTabText,
        isNeonCarnival && styles.neonCarnivalVisitorTabText,
        isRetroArcade && styles.retroArcadeVisitorTabText,
        selectedTemplate.useSerif && { fontFamily: selectedTemplate.bodyMedium, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
        isAcademicEditorial && {
          fontFamily: selectedTemplate.serifBold,
          fontSize: 13,
          textTransform: 'uppercase' as const,
          letterSpacing: 1.5,
          color: isActive ? selectedTemplate.accent : selectedTemplate.muted,
        },
        isBohemian && {
          fontFamily: selectedTemplate.serifFont,
          fontSize: 13,
          color: isActive ? '#431407' : 'rgba(67, 20, 7, 0.65)',
          fontWeight: 'bold' as any,
          textTransform: 'uppercase' as const,
          letterSpacing: 1.2,
        },
        isActive && !isThemeHeader && !isAcademicEditorial && birthdayActiveText
      ]}>
        {displayTitle}
      </Text>
    );
  };

  const renderUnderline = (isActive: boolean) => {
    if (isRoyal && isActive) return (
      <View style={{ alignItems: 'center', marginTop: 3 }}>
        <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
        <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
      </View>
    );
    if (isClassic && isActive) return (
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: 32, height: 1.2, backgroundColor: '#cca43b' }} />
      </View>
    );
    if (isEthereal && isActive) return (
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: selectedTemplate.accent, fontFamily: selectedTemplate.serifItalic }}>❦</Text>
      </View>
    );
    if (isAcademicEditorial && isActive) return (
      <View style={{ width: '100%', height: 2, backgroundColor: selectedTemplate.accent, marginTop: 4 }} />
    );
    return null;
  };

  const renderTab = (sub: any, isActive: boolean, idx?: number) => {
    const indexStr = idx !== undefined ? String(idx + 2).padStart(2, '0') : undefined;
    const onPress = () => handleSubEventChange(sub);

    return (
      <TouchableOpacity
        key={sub ? sub.id : 'home'}
        style={[
          styles.visitorTab,
          isThemeHeader ? themeHeaderTab(isActive) : [...birthdayTabStyles, isActive && birthdayActiveTab],
          isAcademicEditorial && academicTabStyle,
          isBohemian && [styles.bohemianVisitorTab, isActive && styles.bohemianVisitorTabActive],
        ]}
        onPress={onPress}
      >
        {isBohemian ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isActive && <BohemianEqualizer accentColor={selectedTemplate.accent} styles={styles} />}
            {renderTabText(sub, isActive, indexStr)}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!sub && !isThemeHeader && !isAcademicEditorial && !isBohemian && (
              <IconSymbol
                name="house.fill"
                size={14}
                color={isActive
                  ? (isCyberTech ? '#00f0ff' : (isScrapbook ? '#263331' : '#cca43b'))
                  : (isCyberTech ? 'rgba(0, 240, 255, 0.5)' : (isScrapbook ? selectedTemplate.accent : '#cca43b'))
                }
              />
            )}
            {renderTabText(sub, isActive, indexStr)}
          </View>
        )}
        {renderUnderline(isActive)}
      </TouchableOpacity>
    );
  };

  const isPartnersActive = activeSubEvent?.id === 'event-partners';

  return (
    <View style={[
      styles.visitorHeaderContainer,
      isRoyal && { height: 70, marginTop: 12, marginBottom: 0 },
      isClassic && { height: 60, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', backgroundColor: '#FAF9F6' },
      isHero && { height: 64, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000000' },
      isEthereal && { height: 60, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: selectedTemplate.accent + '26', backgroundColor: selectedTemplate.background },
      isAcademicEditorial && { height: 52, marginTop: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: selectedTemplate.text + '1a', backgroundColor: selectedTemplate.background },
      isGarden && {
        height: 54, marginTop: -27, marginBottom: 8, marginHorizontal: 0, paddingHorizontal: 16,
        alignSelf: 'stretch' as const, borderRadius: 999, backgroundColor: '#FFFFFF',
        borderWidth: 1, borderColor: '#2E6F40',
        shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, zIndex: 10,
      },
      isBohemian && { height: 72, marginTop: 0, marginBottom: 8, backgroundColor: selectedTemplate.background },
      isScrapbook && styles.scrapbookVisitorHeaderContainer,
      isNeon && styles.neonVisitorHeaderContainer,
      isPastel && styles.pastelVisitorHeaderContainer,
      isPop && styles.popVisitorHeaderContainer,
      isGoldenYears && styles.goldenVisitorHeaderContainer,
      isVintageNoir && styles.vintageVisitorHeaderContainer,
      isRoseGarden && styles.roseVisitorHeaderContainer,
      isMinimalLove && styles.minimalVisitorHeaderContainer,
      isCyberTech && styles.cyberVisitorHeaderContainer,
      isRetroArcade && styles.retroArcadeVisitorHeaderContainer,
      isNeonCarnival && styles.neonCarnivalVisitorHeaderContainer,
    ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.visitorHeaderContent,
          isScrapbook && styles.scrapbookVisitorHeaderContent,
          isNeon && styles.neonVisitorHeaderContent,
          isPastel && styles.pastelVisitorHeaderContent,
          isPop && styles.popVisitorHeaderContent,
          isGoldenYears && styles.goldenVisitorHeaderContent,
          isVintageNoir && styles.vintageVisitorHeaderContent,
          isRoseGarden && styles.roseVisitorHeaderContent,
          isMinimalLove && styles.minimalVisitorHeaderContent,
          isCyberTech && styles.cyberVisitorHeaderContent,
          isRetroArcade && styles.retroArcadeVisitorHeaderContent,
          isNeonCarnival && styles.neonCarnivalVisitorHeaderContent,
          isAcademicEditorial && { paddingHorizontal: 12 },
          isGarden && { flexGrow: 1, flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 4, gap: 4 },
          isBohemian && { paddingHorizontal: 16, gap: 8, alignItems: 'center' as const },
        ]}
      >
        {/* Home Tab */}
        {renderTab(null, !activeSubEvent)}

        {/* Sub-event Tabs */}
        {subEvents.map((sub, idx) =>
          renderTab(sub, activeSubEvent?.id === sub.id, idx)
        )}

        {/* Event Partners Tab */}
        <TouchableOpacity
          style={[
            styles.visitorTab,
            isThemeHeader ? themeHeaderTab(isPartnersActive) : [...birthdayTabStyles, isPartnersActive && birthdayActiveTab],
            isAcademicEditorial && academicTabStyle,
            isBohemian && [styles.bohemianVisitorTab, isPartnersActive && styles.bohemianVisitorTabActive],
          ]}
          onPress={() => handleSubEventChange({ id: 'event-partners', title: 'Event Partners' } as any)}
        >
          {isBohemian ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isPartnersActive && <BohemianEqualizer accentColor={selectedTemplate.accent} styles={styles} />}
              <Text style={[
                styles.visitorTabText,
                {
                  fontFamily: selectedTemplate.serifFont,
                  fontSize: 13,
                  color: isPartnersActive ? '#431407' : 'rgba(67, 20, 7, 0.65)',
                  fontWeight: 'bold' as any,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1.2,
                }
              ]}>PARTNERS</Text>
            </View>
          ) : (
            <Text style={[
              styles.visitorTabText,
              { color: isThemeHeader ? themeTextColor(isPartnersActive) : birthdayTextColor },
              isScrapbook && styles.scrapbookVisitorTabText,
              isNeon && styles.neonVisitorTabText,
              isPastel && styles.pastelVisitorTabText,
              isPop && styles.popVisitorTabText,
              isGoldenYears && styles.goldenVisitorTabText,
              isVintageNoir && styles.vintageVisitorTabText,
              isRoseGarden && styles.roseVisitorTabText,
              isMinimalLove && styles.minimalVisitorTabText,
              isCyberTech && styles.cyberVisitorTabText,
              isNeonCarnival && styles.neonCarnivalVisitorTabText,
              isRetroArcade && styles.retroArcadeVisitorTabText,
              selectedTemplate.useSerif && { fontFamily: selectedTemplate.bodyMedium, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
              isAcademicEditorial && {
                fontFamily: selectedTemplate.serifBold,
                fontSize: 13,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.5,
                color: isPartnersActive ? selectedTemplate.accent : selectedTemplate.muted,
              },
              isPartnersActive && !isThemeHeader && !isAcademicEditorial && birthdayActiveText,
            ]}>
              {(isCyberTech || isNeonCarnival) ? (isPartnersActive ? '[ PARTNERS ]' : '  PARTNERS  ') : (
                isRetroArcade ? 'PARTNERS 🤝' : (
                  isAcademicEditorial ? `${String(subEvents.length + 2).padStart(2, '0')} / PARTNERS` : (
                    <>Event Partners <Text style={{ fontSize: 10 }}>🤝</Text></>
                  )
                )
              )}
            </Text>
          )}
          {renderUnderline(isPartnersActive)}
        </TouchableOpacity>
      </ScrollView>

      {/* Bohemian Guitar String Divider */}
      {isBohemian && (
        <View style={styles.bohemianTabsDividerContainer}>
          <View style={[styles.bohemianGuitarString, { backgroundColor: selectedTemplate.text + '12', height: 1, marginBottom: 2 }]} />
          <View style={[styles.bohemianGuitarString, { backgroundColor: selectedTemplate.text + '25', height: 1 }]} />
        </View>
      )}
    </View>
  );
}
