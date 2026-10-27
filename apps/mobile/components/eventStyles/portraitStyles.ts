import { Fonts } from '../../constants/theme';

// Sunlit Portrait guest boxes on the warm paper (website: src/app/sunlit-portrait.css). Log-in prompt: white card with
// a hairline, ink pill button; empty gallery: muted brown text. The title's serif is set by the event screen.
export const portraitStyles: any = {
  portraitGuestSection: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E7DFD4' },
  portraitGuestTitle: { fontSize: 28, lineHeight: 34, color: '#1F1B17', textAlign: 'center' },
  portraitGuestSub: { fontSize: 14, lineHeight: 21, color: '#6B6158', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  portraitAccessBtn: { backgroundColor: '#1F1B17', paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  portraitAccessBtnText: { fontSize: 13, color: '#FFFFFF', fontFamily: Fonts.inter.bold, letterSpacing: 1.4, textTransform: 'uppercase' },
  portraitEmptyText: { fontSize: 22, color: '#6B6158', textAlign: 'center' },
};
