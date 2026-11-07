import { avatarColors } from './theme';

export const initial = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

/** Avatar colour by join order, so each flatmate keeps a stable colour. */
export const avatarColor = (index: number): string => avatarColors[index % avatarColors.length]!;

/** Subtitle under a resident's name in the member list. `now` is injected so it is testable. */
export function joinedLabel(joinedAt: string, now: Date, isCreator: boolean): string {
  if (isCreator) return 'Created the room';
  const minutes = Math.floor((now.getTime() - new Date(joinedAt).getTime()) / 60_000);
  if (minutes < 2) return 'Joined just now';
  if (minutes < 60) return `Joined ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Joined ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `Joined ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** "Maya is already in" / "Maya, Alex are already in"; empty when nobody is listed. */
export function alreadyInLabel(names: string[]): string {
  if (names.length === 0) return '';
  return names.length === 1 ? `${names[0]} is already in` : `${names.join(', ')} are already in`;
}
