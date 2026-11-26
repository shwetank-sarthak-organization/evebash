// The name shown for an event's owner (website and app): "You" for the owner themself, the email for old events
// whose created_by is an email, otherwise the name from their profile card (todo #50).
export function eventOwnerLabel(
  createdBy: string | null | undefined,
  currentUserIds: Array<string | null | undefined>,
  cardName?: string | null,
): string {
  if (!createdBy) return 'Unknown owner';
  if (currentUserIds.some(id => !!id && id === createdBy)) return 'You';
  if (createdBy.includes('@')) return createdBy;
  return cardName?.trim() || 'Unknown owner';
}
