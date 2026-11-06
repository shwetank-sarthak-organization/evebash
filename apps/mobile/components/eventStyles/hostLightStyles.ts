import { StyleSheet } from 'react-native';
import { MidnightColors } from '../../constants/theme';

type EventStyles = Record<string, any>;

/**
 * The host's event screen in the light look (todo #1). Guests and the dark look keep `styles` (eventStyles.ts)
 * exactly as they are; the light host view uses this copy, where only the host's panels, text and lines change.
 * Anything drawn on a photo (cover controls, gallery cards and badges, the reposition and zoom bars, the floating
 * back button) keeps the dark colours.
 */
export function makeHostLightStyles(base: EventStyles, c: typeof MidnightColors): EventStyles {
  const with_ = (key: string, colors: object) => ({ ...base[key], ...colors });
  return {
    ...base,
    ...StyleSheet.create({
      // Host tabs and section titles
      tabBar: with_('tabBar', { borderBottomColor: c.cardBorder }),
      activeTab: with_('activeTab', { borderBottomColor: c.gold }),
      activeTabText: with_('activeTabText', { color: c.gold }),
      tabText: with_('tabText', { color: c.slate600 }),
      sectionTitle: with_('sectionTitle', { color: c.white }),
      addBtnText: with_('addBtnText', { color: c.gold }),
      emptyText: with_('emptyText', { color: c.slate400 }),
      badge: with_('badge', { borderColor: c.background }),
      // Permissions
      permissionsGroupLabel: with_('permissionsGroupLabel', { color: c.slate600 }),
      richPermCard: with_('richPermCard', { backgroundColor: c.card, borderColor: c.cardBorder }),
      richPermIconBox: with_('richPermIconBox', { backgroundColor: c.tint(0.04), borderColor: c.tint(0.06) }),
      richPermLabel: with_('richPermLabel', { color: c.slate400 }),
      richPermDesc: with_('richPermDesc', { color: c.slate600 }),
      customToggle: with_('customToggle', { backgroundColor: c.tint(0.1) }),
      customToggleThumb: with_('customToggleThumb', { backgroundColor: c.slate400 }),
      customToggleThumbActive: with_('customToggleThumbActive', { backgroundColor: c.gold }),
      premiumDoneText: with_('premiumDoneText', { color: c.onAccent }),
      // Access requests and the member details popup
      requestCardItem: with_('requestCardItem', { backgroundColor: c.card, borderColor: c.cardBorder }),
      requestName: with_('requestName', { color: c.white }),
      requestPhone: with_('requestPhone', { color: c.slate600 }),
      avatarTextSmall: with_('avatarTextSmall', { color: c.gold }),
      premiumModalBackdrop: with_('premiumModalBackdrop', { backgroundColor: c.modalBackdrop }),
      premiumModalContent: with_('premiumModalContent', { borderColor: c.cardBorder, shadowColor: c.shadow, shadowOpacity: 0.2 }),
      premiumModalHeader: with_('premiumModalHeader', { backgroundColor: c.tint(0.02) }),
      premiumModalTitle: with_('premiumModalTitle', { color: c.white }),
      premiumModalSub: with_('premiumModalSub', { color: c.gold }),
      closeModalCircle: with_('closeModalCircle', { backgroundColor: c.tint(0.05) }),
      closeModalText: with_('closeModalText', { color: c.slate400 }),
      userInfoPanel: with_('userInfoPanel', { backgroundColor: c.tint(0.025), borderColor: c.tint(0.06) }),
      userInfoDetailRow: with_('userInfoDetailRow', { backgroundColor: c.card }),
      userInfoDetailLabel: with_('userInfoDetailLabel', { color: c.slate400 }),
      userInfoDetailValue: with_('userInfoDetailValue', { color: c.white }),
      // Design tab
      designCard: with_('designCard', { backgroundColor: c.card, borderColor: c.cardBorder, shadowColor: c.shadow }),
      designLabel: with_('designLabel', { color: c.slate400 }),
      designValue: with_('designValue', { color: c.white }),
      // Popups: share, join ID, category, delete
      modalBackdrop: with_('modalBackdrop', { backgroundColor: c.modalBackdrop }),
      modalContent: with_('modalContent', { backgroundColor: c.deepSlate }),
      modalTitle: with_('modalTitle', { color: c.white }),
      shareModalContent: with_('shareModalContent', { backgroundColor: c.deepSlate }),
      shareActionBtn: with_('shareActionBtn', { backgroundColor: c.goldFill }),
      shareActionText: with_('shareActionText', { color: c.onAccent }),
      joinIdBox: with_('joinIdBox', { backgroundColor: c.tint(0.03) }),
      joinIdLabel: with_('joinIdLabel', { color: c.slate400 }),
      joinIdValue: with_('joinIdValue', { color: c.gold }),
      // The QR code sits on a white card in both looks
      qrLabel: with_('qrLabel', { color: MidnightColors.background }),
      categoryOption: with_('categoryOption', { backgroundColor: c.tint(0.03), borderColor: c.tint(0.08) }),
      categoryText: with_('categoryText', { color: c.slate400 }),
      activeCategoryText: with_('activeCategoryText', { color: c.gold }),
      categoryCheckBadge: with_('categoryCheckBadge', { backgroundColor: c.goldFill }),
      deleteMainText: with_('deleteMainText', { color: c.danger }),
      // Form popups (rename, sub-gallery, gallery message) and the template list
      headerGreeting: with_('headerGreeting', { color: c.slate400 }),
      inputLabel: with_('inputLabel', { color: c.slate400 }),
      input: with_('input', { backgroundColor: c.tint(0.03), color: c.white, borderColor: c.cardBorder }),
      submitBtn: with_('submitBtn', { backgroundColor: c.goldFill }),
      submitBtnText: with_('submitBtnText', { color: c.onAccent }),
      templateRowCard: with_('templateRowCard', { backgroundColor: c.card }),
      activeTemplateRowCard: with_('activeTemplateRowCard', { backgroundColor: c.tint(0.04) }),
      palettePreview: with_('palettePreview', { borderColor: c.tint(0.12) }),
      templateRowName: with_('templateRowName', { color: c.white }),
      templateRowDesc: with_('templateRowDesc', { color: c.slate400 }),
    }),
  };
}
