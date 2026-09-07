export const premiumColors = {
  canvas: '#FCFDFE',
  surface: '#FFFFFF',
  navy: '#0C1628',
  navyRaised: '#26354C',
  text: '#0C1628',
  textMuted: '#758196',
  textSubtle: '#98A2B3',
  border: '#E9EDF2',
  borderStrong: '#DCE2E8',
  imagePlaceholder: '#EEF2F6',
  imagePlaceholderBorder: '#E2E8F0',
  imagePlaceholderText: '#536074',
  successSurface: '#E8F5EE',
  successText: '#26734D',
  warningSurface: '#FFF7ED',
  warningText: '#9A3412',
  errorSurface: '#FEF3F2',
  errorText: '#B42318',
} as const;

export const premiumSpacing = {
  xs: 5,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const premiumRadii = {
  control: 17,
  card: 22,
  cardLarge: 24,
  hero: 28,
  heroLarge: 30,
  pill: 999,
} as const;

export const premiumTouch = {
  minimum: 44,
  primary: 54,
} as const;

export const premiumElevation = {
  soft: {
    shadowColor: '#0B1323',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  hero: {
    shadowColor: '#0B1323',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
} as const;
