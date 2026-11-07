// Website and app (one copy): the themes hosts can pick right now. Decided 2026-11-06 (Sarthak): these five for
// every event type, in this order. In the picker, the event type's own other themes show greyed out as "Coming soon";
// themes hidden for good (HIDDEN_TEMPLATE_IDS) don't show at all. An event already on another theme keeps it.
// A platform that doesn't have one of these yet (the app has no Confetti Circle) just leaves it out.

export const ACTIVE_THEME_IDS: readonly string[] = ['royal', 'classic', 'portrait', 'hero', 'confetti'];

export const isThemeActive = (templateId?: string) => ACTIVE_THEME_IDS.includes(templateId || '');

interface Theme {
  id: string;
  category: string;
}

/** Themes to pick for an event: the active ones this platform has, in ACTIVE_THEME_IDS order. An event already on
 *  another theme sees that one first, as its current choice. */
export function pickableThemes<T extends Theme>(themes: readonly T[], currentTemplateId?: string): T[] {
  const active = ACTIVE_THEME_IDS
    .map((id) => themes.find((theme) => theme.id === id))
    .filter((theme): theme is T => !!theme);
  const current = currentTemplateId && !isThemeActive(currentTemplateId)
    ? themes.find((theme) => theme.id === currentTemplateId)
    : undefined;
  return current ? [current, ...active] : active;
}

/** The event type's own themes that can't be picked yet ("Coming soon"); `templateCategory` is the theme category
 *  the event type uses (Anniversary uses Wedding, Sports uses Other) */
export function comingSoonThemes<T extends Theme>(
  themes: readonly T[],
  templateCategory: string,
  isHiddenForGood: (templateId: string) => boolean,
  currentTemplateId?: string,
): T[] {
  return themes.filter((theme) =>
    theme.category === templateCategory
    && !isThemeActive(theme.id)
    && !isHiddenForGood(theme.id)
    && theme.id !== currentTemplateId);
}
