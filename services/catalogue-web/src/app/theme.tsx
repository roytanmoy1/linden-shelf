import { createLightTheme, FluentProvider } from '@fluentui/react-components';
import type { ReactNode } from 'react';

const theme = {
  ...createLightTheme({
    10: '#071A11', 20: '#0D2B1C', 30: '#103726', 40: '#12422D',
    50: '#154D36', 60: '#14533B', 70: '#155B41', 80: '#176348',
    90: '#287452', 100: '#418765', 110: '#5A9A7B', 120: '#7CAF95',
    130: '#A0C5AF', 140: '#BED8C8', 150: '#DCEBE0', 160: '#F0F7F2',
  }),
  fontFamilyBase: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontSizeBase300: '15px',
  lineHeightBase300: '22px',
  borderRadiusMedium: '6px',
  colorBrandBackground: 'var(--primary)',
  colorBrandBackgroundHover: 'var(--primary-hover)',
  colorBrandBackgroundPressed: 'var(--ink)',
  colorBrandForeground1: 'var(--primary)',
  colorNeutralForeground1: 'var(--text)',
  colorNeutralForeground2: 'var(--muted)',
  colorNeutralBackground1: 'var(--paper)',
  colorNeutralBackground2: 'var(--surface)',
  colorNeutralStroke1: 'var(--border)',
  colorNeutralStrokeAccessible: 'var(--control-border)',
};

export function CatalogueTheme({ children }: { children: ReactNode }) {
  return <FluentProvider theme={theme} className="enquiry-theme">{children}</FluentProvider>;
}