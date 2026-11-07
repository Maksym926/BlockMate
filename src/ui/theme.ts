// Flatmate design system tokens (Shared Space App Flows canvas, light theme).
export const color = {
  surface0: '#f5f6f3',
  surface1: '#ffffff',
  surface2: '#eceee9',
  ink: '#14201b',
  inkMuted: '#55645c',
  hairline: '#dfe3dc',
  brand: '#0b7a68',
  brandInk: '#ffffff',
  brandTint: '#dff3ee',
  brandTintInk: '#075a4c',
  warnTint: '#fdf0d5',
  warnTintInk: '#7a4a05',
  danger: '#c0392b',
  dangerTint: '#fde4e0',
  dangerTintInk: '#9a2a1b',
  avatarInk: '#14201b',
  white: '#ffffff',
  scannerBackdrop: '#0f1311',
} as const;

export const avatarColors = ['#ff7a59', '#4aa3ff', '#a596ff', '#ffc247', '#4cd4a0'] as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const font = {
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6 },
} as const;
