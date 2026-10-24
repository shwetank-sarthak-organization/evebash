import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, useWindowDimensions, type GestureResponderEvent } from 'react-native';
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
  /** Royal Emerald: its Cinzel font, loaded by the event screen (components/royal/royalFonts.ts) */
  royalFontFamily?: string;
}

/** Event Partners is hidden until Phase 2 (it comes with EB Business and EB Network). */
export const SHOW_EVENT_PARTNERS = false;

const SPORTS_HEADER_TEMPLATE_IDS = [
  'bohemian',
  'diamond',
  'blush',
  'garden',
  'midnight_glam',
  'cinematic',
  'modern_lounge',
  'elegant_night',
  'polaroid',
  'editorial',
  'vibrant',
  'zen',
];

const SPORTS_HEADER_THEMES: Record<string, any> = {
  bohemian: { background: '#f5ead8', text: '#2f241b', muted: '#755f4a', accent: '#c76633', activeText: '#fff7eb', tabBg: 'rgba(255,247,235,0.84)', border: 'rgba(199,102,51,0.24)' },
  diamond: { background: '#060a12', text: '#e5edf7', muted: '#9fb3c8', accent: '#b9d8f2', activeText: '#06111f', tabBg: 'rgba(238,242,247,0.08)', border: 'rgba(185,216,242,0.28)' },
  blush: { background: '#fff3ee', text: '#4a2725', muted: '#9a6b64', accent: '#d9796f', activeText: '#ffffff', tabBg: 'rgba(255,250,246,0.8)', border: 'rgba(217,121,111,0.25)' },
  garden: { background: '#e8eee5', text: '#1a3322', muted: '#526b50', accent: '#587c43', activeText: '#fdfbf7', tabBg: 'rgba(253,251,247,0.82)', border: 'rgba(88,124,67,0.25)' },
  midnight_glam: { background: '#050508', text: '#fff7e6', muted: '#d6bf94', accent: '#cca43b', activeText: '#0a0a0c', tabBg: 'rgba(255,247,230,0.08)', border: 'rgba(204,164,59,0.32)' },
  cinematic: { background: '#0d0d0d', text: '#f4f4f4', muted: '#b8b8b8', accent: '#ef4444', activeText: '#ffffff', tabBg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  modern_lounge: { background: '#efe7dc', text: '#2b211b', muted: '#756353', accent: '#7a563b', activeText: '#fffaf2', tabBg: 'rgba(255,250,242,0.82)', border: 'rgba(122,86,59,0.24)' },
  elegant_night: { background: '#07101f', text: '#f5eddc', muted: '#d4b474', accent: '#d4b474', activeText: '#07101f', tabBg: 'rgba(245,237,220,0.08)', border: 'rgba(212,180,116,0.3)' },
  polaroid: { background: '#f7efe1', text: '#3f2a1e', muted: '#806653', accent: '#b45309', activeText: '#fffaf0', tabBg: 'rgba(255,250,240,0.82)', border: 'rgba(180,83,9,0.24)' },
  editorial: { background: '#fafaf7', text: '#111827', muted: '#57534e', accent: '#111827', activeText: '#ffffff', tabBg: 'rgba(255,255,255,0.86)', border: 'rgba(17,24,39,0.14)' },
  vibrant: { background: '#08111f', text: '#FFF7EB', muted: '#cbd5e1', accent: '#f97316', activeText: '#1B211F', tabBg: 'rgba(248,250,252,0.08)', border: 'rgba(249,115,22,0.3)' },
  zen: { background: '#f1eee6', text: '#44403c', muted: '#78716c', accent: '#66785f', activeText: '#fffaf2', tabBg: 'rgba(255,252,246,0.82)', border: 'rgba(102,120,95,0.22)' },
};

// Height of a tab in the Royal Emerald bar, so the Collections menu opens below it
const COLLECTIONS_TAB_HEIGHT = 40;

const getSportsHeaderTheme = (templateId?: string) => SPORTS_HEADER_THEMES[templateId || ''] || SPORTS_HEADER_THEMES.bohemian;

export function ThemeHeader({
  event,
  selectedTemplate,
  activeSubEvent,
  subEvents,
  handleSubEventChange,
  styles,
  royalFontFamily,
}: ThemeHeaderProps) {
  // Website navbar links: Cinzel, gold when chosen
  const royalTabText = (active: boolean) => isRoyalFont && { fontFamily: royalFontFamily, fontWeight: 'normal' as const, letterSpacing: 1.6, color: active ? '#f3d68f' : '#cdb48a' };
  const templateId = event?.templateId;
  const isRoyal = templateId === 'royal';
  const isRoyalFont = isRoyal && !!royalFontFamily;
  const { width: windowWidth } = useWindowDimensions();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collectionsAnchor, setCollectionsAnchor] = useState<{ x: number; y: number } | null>(null);
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
  const isSportsTemplate = event?.category === 'Sports' && SPORTS_HEADER_TEMPLATE_IDS.includes(templateId || '');
  const sportsHeaderTheme = getSportsHeaderTheme(templateId);
  const isGarden = templateId === 'garden' && !isSportsTemplate;
  const isBohemian = templateId === 'bohemian' && !isSportsTemplate;
  const isMuseum = templateId === 'museum';
  const isBrutalist = templateId === 'brutalist';
  const isTechSleek = templateId === 'tech_sleek';
  const isExecutive = templateId === 'executive';
  const isThemeHeader = isRoyal || isClassic || isHero || isEthereal || isGarden;

  const birthdayTextColor = isSportsTemplate ? sportsHeaderTheme.text : (isScrapbook ? selectedTemplate.text : (isNeon ? '#f8f7ff' : (isPastel ? '#6c5d59' : (isPop ? '#231f20' : (isGoldenYears ? '#5b432c' : (isVintageNoir ? '#F2E7D2' : (isRoseGarden ? '#562733' : (isMinimalLove ? '#4a2f1d' : (isCyberTech ? '#00f0ff' : (isRetroArcade ? '#231f20' : (isNeonCarnival ? '#d946ef' : (isMuseum ? '#9b7a44' : (isBrutalist ? '#111113' : (isTechSleek ? '#7dd3fc' : (isExecutive ? '#e8d8b8' : '#cca43b')))))))))))))));

  const birthdayActiveText = isScrapbook ? styles.scrapbookVisitorTabTextActive : (isNeon ? styles.neonVisitorTabTextActive : (isPastel ? styles.pastelVisitorTabTextActive : (isPop ? styles.popVisitorTabTextActive : (isGoldenYears ? styles.goldenVisitorTabTextActive : (isVintageNoir ? styles.vintageVisitorTabTextActive : (isRoseGarden ? styles.roseVisitorTabTextActive : (isMinimalLove ? styles.minimalVisitorTabTextActive : (isCyberTech ? styles.cyberVisitorTabTextActive : (isRetroArcade ? styles.retroArcadeVisitorTabTextActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabTextActive : (isMuseum ? styles.museumVisitorTabTextActive : (isBrutalist ? styles.brutalistVisitorTabTextActive : (isTechSleek ? styles.techSleekVisitorTabTextActive : (isExecutive ? styles.executiveVisitorTabTextActive : styles.visitorTabTextActive))))))))))))));

  const birthdayActiveTab = isScrapbook ? styles.scrapbookVisitorTabActive : (isNeon ? styles.neonVisitorTabActive : (isPastel ? styles.pastelVisitorTabActive : (isPop ? styles.popVisitorTabActive : (isGoldenYears ? styles.goldenVisitorTabActive : (isVintageNoir ? styles.vintageVisitorTabActive : (isRoseGarden ? styles.roseVisitorTabActive : (isMinimalLove ? styles.minimalVisitorTabActive : (isCyberTech ? styles.cyberVisitorTabActive : (isRetroArcade ? styles.retroArcadeVisitorTabActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabActive : (isMuseum ? styles.museumVisitorTabActive : (isBrutalist ? styles.brutalistVisitorTabActive : (isTechSleek ? styles.techSleekVisitorTabActive : (isExecutive ? styles.executiveVisitorTabActive : styles.visitorTabActive))))))))))))));

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
    isMuseum && styles.museumVisitorTab,
    isBrutalist && styles.brutalistVisitorTab,
    isTechSleek && styles.techSleekVisitorTab,
    isExecutive && styles.executiveVisitorTab,
    isSportsTemplate && [styles.sportsVisitorTab, { backgroundColor: sportsHeaderTheme.tabBg, borderColor: sportsHeaderTheme.border }],
  ];

  const resolvedActiveText = isSportsTemplate ? { color: sportsHeaderTheme.activeText } : birthdayActiveText;
  const resolvedActiveTab = isSportsTemplate
    ? [styles.sportsVisitorTab, { backgroundColor: sportsHeaderTheme.accent, borderColor: sportsHeaderTheme.accent, shadowColor: sportsHeaderTheme.accent }]
    : birthdayActiveTab;

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
    ? (isGarden ? '#FFFFFF' : (isHero ? '#cca43b' : (isRoyal ? '#fff' : (isEthereal ? selectedTemplate.accent : (isClassic ? '#2C352E' : '#cca43b')))))
    : (isGarden ? '#64748b' : (isHero ? '#CDB89E' : selectedTemplate.muted));

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
      isSportsTemplate ? 'HOME' : isBohemian ? 'HOME' : (
        (isCyberTech || isNeonCarnival) ? (isActive ? '[ HOME ]' : '  HOME  ') : (
          isRetroArcade ? 'HOME' : (isAcademicEditorial ? '01 / HOME' : 'Home')
        )
      )
    ) : (
      isSportsTemplate ? title.toUpperCase() : (isCyberTech || isNeonCarnival) ? (isActive ? `[ ${title.toUpperCase()} ]` : `  ${title.toUpperCase()}  `) : (
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
        isMuseum && styles.museumVisitorTabText,
        isBrutalist && styles.brutalistVisitorTabText,
        isTechSleek && styles.techSleekVisitorTabText,
        isExecutive && styles.executiveVisitorTabText,
        isSportsTemplate && [styles.sportsVisitorTabText, { color: sportsHeaderTheme.text }],
        !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.bodyMedium, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
        royalTabText(isActive),
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
        isActive && !isThemeHeader && !isAcademicEditorial && resolvedActiveText
      ]}>
        {displayTitle}
      </Text>
    );
  };

  const renderUnderline = (isActive: boolean) => {
    if (isRoyal && isActive) return (
      <View style={{ alignItems: 'center', marginTop: 3 }}>
        <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
        <View style={{ width: 4, height: 4, marginTop: 2, backgroundColor: selectedTemplate.accent, transform: [{ rotate: '45deg' }] }} />
      </View>
    );
    if (isClassic && isActive) return (
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: 32, height: 1.2, backgroundColor: '#596653' }} />
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
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Home gallery"
        key={sub ? sub.id : 'home'}
        style={[
          styles.visitorTab,
          isThemeHeader ? themeHeaderTab(isActive) : [...birthdayTabStyles, isActive && resolvedActiveTab],
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
                  ? (isSportsTemplate ? sportsHeaderTheme.activeText : (isCyberTech ? '#00f0ff' : (isScrapbook ? '#263331' : ((isMuseum || isBrutalist) ? '#f8f6ef' : (isTechSleek ? '#03101f' : (isExecutive ? '#111827' : '#cca43b'))))))
                  : (isSportsTemplate ? sportsHeaderTheme.accent : (isCyberTech ? 'rgba(0, 240, 255, 0.5)' : (isScrapbook ? selectedTemplate.accent : (isMuseum ? '#9b7a44' : (isBrutalist ? '#111113' : (isTechSleek ? '#7dd3fc' : (isExecutive ? '#d4b474' : '#cca43b')))))))
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
  const isFindYouActive = activeSubEvent?.id === 'find-you';
  const isCollectionActive = !!activeSubEvent && subEvents.some((sub) => sub.id === activeSubEvent.id);
  // The menu opens just under the tapped tab. The touch point is used because the pinned bar is moved by a native
  // animation, which measuring the tab on Android doesn't include.
  const openCollections = (event: GestureResponderEvent) => {
    const { pageX, pageY, locationY } = event.nativeEvent;
    setCollectionsAnchor({ x: pageX, y: pageY - locationY + COLLECTIONS_TAB_HEIGHT });
    setCollectionsOpen(true);
  };

  return (
    <View style={[
      styles.visitorHeaderContainer,
      isRoyal && (isRoyalFont
        ? { height: 60, marginTop: 0, marginBottom: 0, backgroundColor: '#021a15', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(202,156,105,0.3)' }
        : { height: 70, marginTop: 12, marginBottom: 0 }),
      isClassic && { height: 60, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', backgroundColor: '#FCFCFA' },
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
      isMuseum && styles.museumVisitorHeaderContainer,
      isBrutalist && styles.brutalistVisitorHeaderContainer,
      isTechSleek && styles.techSleekVisitorHeaderContainer,
      isExecutive && styles.executiveVisitorHeaderContainer,
      isSportsTemplate && [styles.sportsVisitorHeaderContainer, { backgroundColor: sportsHeaderTheme.background, borderBottomColor: sportsHeaderTheme.border }],
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
          isMuseum && styles.museumVisitorHeaderContent,
          isBrutalist && styles.brutalistVisitorHeaderContent,
          isTechSleek && styles.techSleekVisitorHeaderContent,
          isExecutive && styles.executiveVisitorHeaderContent,
          isSportsTemplate && styles.sportsVisitorHeaderContent,
          isAcademicEditorial && { paddingHorizontal: 12 },
          isGarden && { flexGrow: 1, flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 4, gap: 4 },
          isBohemian && { paddingHorizontal: 16, gap: 8, alignItems: 'center' as const },
          isRoyalFont && { flexGrow: 1, justifyContent: 'space-evenly' as const, alignItems: 'center' as const },
        ]}
      >
        {/* Home Tab */}
        {renderTab(null, !activeSubEvent)}

        {/* Sub-event Tabs; Royal Emerald groups them under Collections, like the website's navbar */}
        {isRoyalFont ? subEvents.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Collections"
            accessibilityState={{ expanded: collectionsOpen }}
            style={[styles.visitorTab, themeHeaderTab(isCollectionActive)]}
            onPress={openCollections}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.visitorTabText, royalTabText(isCollectionActive)]}>COLLECTIONS</Text>
              <IconSymbol name="chevron.down" size={12} color={isCollectionActive ? '#f3d68f' : '#cdb48a'} />
            </View>
            {renderUnderline(isCollectionActive)}
          </TouchableOpacity>
        ) : subEvents.map((sub, idx) =>
          renderTab(sub, activeSubEvent?.id === sub.id, idx)
        )}

        {/* Event Partners Tab: hidden until Phase 2 (comes with EB Business and EB Network); set SHOW_EVENT_PARTNERS to bring it back */}
        {SHOW_EVENT_PARTNERS && (
        <TouchableOpacity
          style={[
            styles.visitorTab,
            isThemeHeader ? themeHeaderTab(isPartnersActive) : [...birthdayTabStyles, isPartnersActive && resolvedActiveTab],
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
              isMuseum && styles.museumVisitorTabText,
              isBrutalist && styles.brutalistVisitorTabText,
              isTechSleek && styles.techSleekVisitorTabText,
              isExecutive && styles.executiveVisitorTabText,
              isSportsTemplate && [styles.sportsVisitorTabText, { color: sportsHeaderTheme.text }],
              !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.bodyMedium, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
              royalTabText(isPartnersActive),
              isAcademicEditorial && {
                fontFamily: selectedTemplate.serifBold,
                fontSize: 13,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.5,
                color: isPartnersActive ? selectedTemplate.accent : selectedTemplate.muted,
              },
              isPartnersActive && !isThemeHeader && !isAcademicEditorial && resolvedActiveText,
            ]}>
              {(isCyberTech || isNeonCarnival) ? (isPartnersActive ? '[ PARTNERS ]' : '  PARTNERS  ') : (
                isRetroArcade ? 'PARTNERS 🤝' : (
                  isAcademicEditorial ? `${String(subEvents.length + 3).padStart(2, '0')} / PARTNERS` : (
                    (isSportsTemplate || isMuseum || isBrutalist || isTechSleek || isExecutive) ? 'Partners' : <>Event Partners <Text style={{ fontSize: 10 }}>🤝</Text></>
                  )
                )
              )}
            </Text>
          )}
          {renderUnderline(isPartnersActive)}
        </TouchableOpacity>
        )}

        {/* Find You Tab */}
        <TouchableOpacity
          style={[
            styles.visitorTab,
            isThemeHeader ? themeHeaderTab(isFindYouActive) : [...birthdayTabStyles, isFindYouActive && resolvedActiveTab],
            isAcademicEditorial && academicTabStyle,
            isBohemian && [styles.bohemianVisitorTab, isFindYouActive && styles.bohemianVisitorTabActive],
          ]}
          onPress={() => handleSubEventChange({ id: 'find-you', title: 'Find You' } as any)}
        >
          {isBohemian ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isFindYouActive && <BohemianEqualizer accentColor={selectedTemplate.accent} styles={styles} />}
              <Text style={[
                styles.visitorTabText,
                {
                  fontFamily: selectedTemplate.serifFont,
                  fontSize: 13,
                  color: isFindYouActive ? '#431407' : 'rgba(67, 20, 7, 0.65)',
                  fontWeight: 'bold' as any,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1.2,
                }
              ]}>FIND YOU 📸</Text>
            </View>
          ) : (
            <Text style={[
              styles.visitorTabText,
              { color: isThemeHeader ? themeTextColor(isFindYouActive) : birthdayTextColor },
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
              isMuseum && styles.museumVisitorTabText,
              isBrutalist && styles.brutalistVisitorTabText,
              isTechSleek && styles.techSleekVisitorTabText,
              isExecutive && styles.executiveVisitorTabText,
              isSportsTemplate && [styles.sportsVisitorTabText, { color: sportsHeaderTheme.text }],
              !isSportsTemplate && selectedTemplate.useSerif && { fontFamily: selectedTemplate.bodyMedium, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
              royalTabText(isFindYouActive),
              isAcademicEditorial && {
                fontFamily: selectedTemplate.serifBold,
                fontSize: 13,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.5,
                color: isFindYouActive ? selectedTemplate.accent : selectedTemplate.muted,
              },
              isFindYouActive && !isThemeHeader && !isAcademicEditorial && resolvedActiveText,
            ]}>
              {(isCyberTech || isNeonCarnival) ? (isFindYouActive ? '[ FIND YOU ]' : '  FIND YOU  ') : (
                isRetroArcade ? 'FIND YOU 📸' : (
                  isAcademicEditorial ? `${String(subEvents.length + 4).padStart(2, '0')} / FIND YOU` : (
                    (isSportsTemplate || isMuseum || isBrutalist || isTechSleek || isExecutive || isRoyalFont) ? 'Find You' : <>Find You <Text style={{ fontSize: 10 }}>📸</Text></>
                  )
                )
              )}
            </Text>
          )}
          {renderUnderline(isFindYouActive)}
        </TouchableOpacity>
      </ScrollView>

      {/* Royal Emerald Collections menu: the albums, under the Collections tab */}
      {isRoyalFont && collectionsOpen && (
        // statusBarTranslucent: the modal then uses the same coordinates as the touch
        <Modal transparent visible statusBarTranslucent animationType="fade" onRequestClose={() => setCollectionsOpen(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setCollectionsOpen(false)} accessibilityLabel="Close collections">
            <View
              style={{
                position: 'absolute',
                top: (collectionsAnchor?.y ?? 100) + 6,
                left: Math.min(Math.max(12, (collectionsAnchor?.x ?? 0) - 120), windowWidth - 252),
                width: 240,
                maxHeight: 360,
                paddingVertical: 6,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(202,156,105,0.55)',
                backgroundColor: '#021a15',
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <ScrollView>
                {subEvents.map((sub) => {
                  const active = activeSubEvent?.id === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setCollectionsOpen(false);
                        handleSubEventChange(sub);
                      }}
                      style={{
                        marginHorizontal: 6,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: active ? 'rgba(202,156,105,0.16)' : 'transparent',
                      }}
                    >
                      <Text numberOfLines={1} style={[{ fontSize: 13, textTransform: 'uppercase' }, royalTabText(active)]}>{sub.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

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
