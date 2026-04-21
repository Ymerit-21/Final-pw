/**
 * Architect App — Design Token System
 * Two complete palettes: light & dark.
 * All colour values used across the app live here.
 */

export const Palette = {
  light: {
    // Backgrounds
    bg:       '#F2F2F7',
    card:     '#FFFFFF',
    cardAlt:  '#F2F2F7',
    elevated: '#FFFFFF',

    // Text
    text:     '#000000',
    subtext:  '#8E8E93',
    label:    '#3A3A3C',

    // Borders & dividers
    border:   '#E5E5EA',
    divider:  '#F2F2F7',

    // Inputs
    inputBg:  '#F2F2F7',
    inputText:'#000000',
    placeholder: '#C6C6C8',

    // Navigation
    tabBar:   'rgba(255,255,255,0.92)',
    tabIcon:  '#A0A0A0',

    // Accent (stays the same in both modes)
    accent:   '#D9F15D',
    accentFg: '#000000',

    // Semantic
    danger:   '#FF3B30',
    success:  '#32D74B',
    info:     '#007AFF',
    warning:  '#FF9500',

    // Template compatibility
    background: '#F2F2F7',
    tint:       '#D9F15D',
    icon:       '#000000',
    tabIconDefault: '#A0A0A0',
    tabIconSelected: '#D9F15D',

    // Chip / tag backgrounds
    chipBg:   '#E5E5EA',
    chipText: '#000000',

    // Icon box tint backgrounds (semi-transparent accents)
    incomeBg: '#E1F8E8',
    expenseBg:'#FFEEEE',
  },

  dark: {
    // Backgrounds
    bg:       '#000000',
    card:     '#1C1C1E',
    cardAlt:  '#2C2C2E',
    elevated: '#2C2C2E',

    // Text
    text:     '#FFFFFF',
    subtext:  '#8E8E93',
    label:    '#EBEBF5',

    // Borders & dividers
    border:   '#38383A',
    divider:  '#2C2C2E',

    // Inputs
    inputBg:  '#2C2C2E',
    inputText:'#FFFFFF',
    placeholder: '#636366',

    // Navigation
    tabBar:   'rgba(28,28,30,0.96)',
    tabIcon:  '#636366',

    // Accent (same in both modes)
    accent:   '#D9F15D',
    accentFg: '#000000',

    // Semantic
    danger:   '#FF3B30',
    success:  '#32D74B',
    info:     '#0A84FF',
    warning:  '#FF9F0A',

    // Template compatibility
    background: '#000000',
    tint:       '#D9F15D',
    icon:       '#FFFFFF',
    tabIconDefault: '#636366',
    tabIconSelected: '#D9F15D',

    // Chip / tag backgrounds
    chipBg:   '#3A3A3C',
    chipText: '#FFFFFF',

    // Icon box tint backgrounds
    incomeBg: '#0D2B14',
    expenseBg:'#2B0D0D',
  },
} as const;

export const Colors = Palette;

export const Fonts = {
  rounded: 'Inter_700Bold',
  header: 'KodeMono_700Bold',
  body: 'Poppins_400Regular',
  mono: 'KodeMono_400Regular',
};

export interface AppTheme {
  bg: string;
  card: string;
  cardAlt: string;
  elevated: string;
  text: string;
  subtext: string;
  label: string;
  border: string;
  divider: string;
  inputBg: string;
  inputText: string;
  placeholder: string;
  tabBar: string;
  tabIcon: string;
  accent: string;
  accentFg: string;
  danger: string;
  success: string;
  info: string;
  warning: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  chipBg: string;
  chipText: string;
  incomeBg: string;
  expenseBg: string;
}
