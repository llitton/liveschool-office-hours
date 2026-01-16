/**
 * Design Tokens
 *
 * These are the only values allowed in the app.
 * No random px values, no one-off colors.
 */

// =============================================================================
// SPACING
// =============================================================================
// Only use these values. No 10px, 18px, 28px.
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  12: '48px',
  16: '64px',
} as const;

// Tailwind classes for spacing (use these in className)
export const sp = {
  0: '0',
  1: '1',      // 4px
  2: '2',      // 8px
  3: '3',      // 12px
  4: '4',      // 16px
  6: '6',      // 24px
  8: '8',      // 32px
  12: '12',    // 48px
  16: '16',    // 64px
} as const;

// =============================================================================
// COLORS
// =============================================================================
export const colors = {
  // Brand
  brand: {
    primary: '#101E57',      // Navy - headers, primary buttons, key text
    accent: '#6F71EE',       // Purple - links, active states, highlights
    accentHover: '#5B5DD6',  // Purple hover
    accentLight: '#EEF0FF',  // Purple tint for backgrounds
  },

  // Neutral
  neutral: {
    50: '#FAFAFA',           // Subtle backgrounds
    100: '#F6F6F9',          // Page background
    200: '#E0E0E0',          // Borders
    300: '#D0D5DD',          // Disabled borders
    400: '#98A2B3',          // Placeholder text
    500: '#667085',          // Muted text
    600: '#475467',          // Secondary text
    900: '#101E57',          // Primary text (same as brand.primary)
  },

  // Semantic
  success: {
    bg: '#ECFDF5',
    text: '#059669',
    border: '#A7F3D0',
  },
  warning: {
    bg: '#FEF3C7',
    text: '#D97706',
    border: '#FCD34D',
  },
  error: {
    bg: '#FEF2F2',
    text: '#DC2626',
    border: '#FECACA',
  },

  // Background
  white: '#FFFFFF',
  pageBg: '#F6F6F9',
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const typography = {
  // Page title - used once per page
  pageTitle: 'text-[24px] font-bold text-[#101E57] leading-tight',

  // Section title - card headers, section headers
  sectionTitle: 'text-[16px] font-semibold text-[#101E57]',

  // Body text
  body: 'text-[14px] text-[#101E57]',
  bodyMuted: 'text-[14px] text-[#667085]',

  // Small text - labels, hints, metadata
  small: 'text-[13px] text-[#667085]',
  smallMuted: 'text-[13px] text-[#98A2B3]',

  // Labels - form labels, uppercase labels
  label: 'text-[13px] font-medium text-[#101E57]',
  labelMuted: 'text-[12px] font-medium text-[#667085] uppercase tracking-wide',
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================
export const radius = {
  sm: 'rounded-lg',     // 8px - buttons, inputs, small elements
  md: 'rounded-xl',     // 12px - cards, modals
  lg: 'rounded-2xl',    // 16px - large cards, hero sections
  full: 'rounded-full', // Pills, avatars
} as const;

// =============================================================================
// SHADOWS
// =============================================================================
export const shadows = {
  none: 'shadow-none',
  card: 'shadow-sm',    // Very subtle, for cards
  dropdown: 'shadow-lg', // Dropdowns, popovers
} as const;

// =============================================================================
// BORDERS
// =============================================================================
export const borders = {
  default: 'border border-[#E0E0E0]',
  subtle: 'border border-[#F0F0F0]',
  focus: 'ring-2 ring-[#6F71EE]/20 border-[#6F71EE]',
} as const;

// =============================================================================
// LAYOUT
// =============================================================================
export const layout = {
  // Page container
  pageMaxWidth: 'max-w-7xl',
  pageNarrowMaxWidth: 'max-w-5xl',
  pagePadding: 'px-4 py-8',

  // Content widths
  formMaxWidth: 'max-w-2xl',
  readingMaxWidth: 'max-w-[720px]',
} as const;

// =============================================================================
// COMPONENT STYLES (pre-composed)
// =============================================================================
export const components = {
  // Cards
  card: `bg-white ${radius.md} ${borders.default}`,
  cardHover: `bg-white ${radius.md} ${borders.default} hover:border-[#6F71EE]/30 transition`,
  cardCallout: `bg-[#FAFAFA] ${radius.md} ${borders.default}`,

  // Page layout
  pageContainer: `${layout.pageMaxWidth} mx-auto ${layout.pagePadding}`,
  pageContainerNarrow: `${layout.pageNarrowMaxWidth} mx-auto ${layout.pagePadding}`,

  // Section
  sectionHeader: 'flex items-center justify-between mb-6',
} as const;

// =============================================================================
// BUTTON VARIANTS
// =============================================================================
export const buttonVariants = {
  primary: `
    inline-flex items-center justify-center gap-2
    bg-[#101E57] text-white
    px-5 py-2.5 rounded-lg
    font-medium text-[14px]
    hover:bg-[#1a2d6e] transition
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  secondary: `
    inline-flex items-center justify-center gap-2
    bg-white text-[#101E57]
    border border-[#E0E0E0]
    px-5 py-2.5 rounded-lg
    font-medium text-[14px]
    hover:bg-[#F6F6F9] transition
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  tertiary: `
    inline-flex items-center justify-center gap-2
    text-[#6F71EE]
    px-3 py-2 rounded-lg
    font-medium text-[14px]
    hover:bg-[#6F71EE]/10 transition
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  destructive: `
    inline-flex items-center justify-center gap-2
    bg-white text-[#DC2626]
    border border-[#FECACA]
    px-5 py-2.5 rounded-lg
    font-medium text-[14px]
    hover:bg-[#FEF2F2] transition
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  ghost: `
    inline-flex items-center justify-center gap-2
    text-[#667085]
    px-3 py-2 rounded-lg
    font-medium text-[14px]
    hover:text-[#101E57] hover:bg-[#F6F6F9] transition
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),
} as const;

// =============================================================================
// BADGE VARIANTS
// =============================================================================
export const badgeVariants = {
  // Status badges
  active: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#ECFDF5] text-[#059669]',
  inactive: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#F6F6F9] text-[#667085]',
  draft: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#D97706]',
  error: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#FEF2F2] text-[#DC2626]',

  // Info badges
  new: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#EEF0FF] text-[#6F71EE]',
  count: 'px-2 py-0.5 text-xs font-medium rounded-full bg-[#F6F6F9] text-[#667085]',
} as const;

// =============================================================================
// INPUT STYLES
// =============================================================================
export const inputStyles = {
  base: `
    w-full px-4 py-2.5
    border border-[#E0E0E0] rounded-lg
    bg-white text-[#101E57]
    placeholder:text-[#98A2B3]
    focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]
    disabled:bg-[#F6F6F9] disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  error: `
    w-full px-4 py-2.5
    border border-[#DC2626] rounded-lg
    bg-white text-[#101E57]
    placeholder:text-[#98A2B3]
    focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]
  `.replace(/\s+/g, ' ').trim(),

  label: 'block text-[13px] font-medium text-[#101E57] mb-1.5',
  helper: 'text-[13px] text-[#667085] mt-1.5',
  errorText: 'text-[13px] text-[#DC2626] mt-1.5',
} as const;
