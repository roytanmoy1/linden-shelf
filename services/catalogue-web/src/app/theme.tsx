import { createLightTheme, FluentProvider } from '@fluentui/react-components';
import type { ReactNode } from 'react';

const theme = {
  ...createLightTheme({
    10: '#020504', 20: '#071D16', 30: '#0B2C22', 40: '#0F3B2E',
    50: '#124B39', 60: '#155744', 70: '#17624B', 80: '#17624B',
    90: '#327A60', 100: '#4C9176', 110: '#68A88D', 120: '#86BDA4',
    130: '#A5D1BC', 140: '#C4E4D4', 150: '#E1F2E9', 160: '#F3FAF6',
  }),
  fontFamilyBase: '"IBM Plex Sans", "Segoe UI", sans-serif',
  colorNeutralForeground1: '#202823',
  colorNeutralForeground2: '#59645E',
  colorNeutralBackground1: '#FFFFFF',
  colorNeutralBackground2: '#F5F7F6',
  colorNeutralStroke1: '#C9D1CC',
};

export function CatalogueTheme({ children }: { children: ReactNode }) {
  return <FluentProvider theme={theme} className="catalogue-app">{children}</FluentProvider>;
}