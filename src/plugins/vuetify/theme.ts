import type { VuetifyOptions } from 'vuetify'
import { resolveVuetifyTheme } from '@core/utils/vuetify'
import { themeConfig } from '@themeConfig'

// Brand primary (Alpha POS design system). The handoff bundle's tokens.css is
// the canonical source: light --primary = #3A5BDB, dark --primary = #6E8BFF.
// Keep this in sync with src/styles/tokens.css.
export const staticPrimaryColor = '#3A5BDB'
export const staticPrimaryColorDark = '#6E8BFF'

const theme: VuetifyOptions['theme'] = {
  defaultTheme: resolveVuetifyTheme(),
  themes: {
    light: {
      dark: false,
      colors: {
        // Core
        'primary': localStorage.getItem(`${themeConfig.app.title}-lightThemePrimaryColor`) || staticPrimaryColor,
        'on-primary': '#FFFFFF',
        'secondary': '#586172',
        'on-secondary': '#FFFFFF',
        'success': '#15935A',
        'on-success': '#FFFFFF',
        'info': '#1180BE',
        'on-info': '#FFFFFF',
        'warning': '#B26A00',
        'on-warning': '#FFFFFF',
        'error': '#C8372A',
        'on-error': '#FFFFFF',
        'background': '#F4F6F8',
        'on-background': '#0F1722',
        'surface': '#FFFFFF',
        'on-surface': '#0F1722',

        // Extended surfaces / lines (token mirrors)
        'bg-subtle': '#EEF1F4',
        'surface-2': '#F8FAFB',
        'surface-inset': '#F1F4F7',
        'border': '#E4E7EC',
        'border-strong': '#D3D8E0',

        // Text scale
        'text-secondary': '#586172',
        'text-tertiary': '#8A929E',
        'text-disabled': '#B4BAC4',

        // Primary tints
        'primary-hover': '#2E49B8',
        'primary-active': '#263EA0',
        'primary-weak': '#EDF0FD',
        'primary-weak-2': '#DEE4FB',
        'primary-border': '#C7D1F7',

        // Semantic tints
        'success-strong': '#0F7A4A',
        'success-weak': '#E6F4EC',
        'success-border': '#BDE3CD',
        'warning-strong': '#8A5200',
        'warning-weak': '#FBF0DD',
        'warning-border': '#F0D7A6',
        'error-strong': '#A82C21',
        'error-weak': '#FBEBE9',
        'error-border': '#F1C8C3',
        'info-strong': '#0E6A9E',
        'info-weak': '#E6F3FA',
        'info-border': '#BCE0F1',
        'neutral-weak': '#EEF1F4',
        'neutral-border': '#DCE1E8',

        // Chart palette — fixed semantics across ALL charts
        'chart-revenue': '#3A5BDB',
        'chart-expense': '#E0823C',
        'chart-cash': '#15935A',
        'chart-card': '#3A5BDB',
        'chart-grid': '#EAEDF1',
        'chart-axis': '#9AA2AE',
        'chart-track': '#EEF1F5',
        'chart-target': '#8A929E',

        // Categorical
        'c1': '#3A5BDB',
        'c2': '#15935A',
        'c3': '#E0823C',
        'c4': '#6E8BFF',
        'c5': '#9AA3B2',

        // Legacy Sneat keys kept for components we have not restyled yet
        'grey-50': '#FAFAFA',
        'grey-100': '#EBEEF0',
        'grey-200': '#EEEEEE',
        'grey-300': '#E0E0E0',
        'grey-400': '#BDBDBD',
        'grey-500': '#9E9E9E',
        'grey-600': '#757575',
        'grey-700': '#616161',
        'grey-800': '#424242',
        'grey-900': '#212121',
        'perfect-scrollbar-thumb': '#DBDADE',
        'skin-bordered-background': '#FFFFFF',
        'skin-bordered-surface': '#FFFFFF',
      },

      variables: {
        // Sneat-era misc (kept until shell restyle replaces them)
        'code-color': '#d400ff',
        'overlay-scrim-background': '#0F1722',
        'overlay-scrim-opacity': 0.42,
        'border-color': '#E4E7EC',
        'snackbar-background': '#0F1722',
        'snackbar-color': '#FFFFFF',
        'tooltip-background': '#0F1722',
        'tooltip-opacity': 0.95,

        'shadow-key-umbra-opacity': 'rgba(16, 24, 40, 0.07)',
        'shadow-key-penumbra-opacity': 'rgba(16, 24, 40, 0.05)',
        'shadow-key-ambient-opacity': 'rgba(16, 24, 40, 0.04)',
      },
    },
    dark: {
      dark: true,
      colors: {
        'primary': localStorage.getItem(`${themeConfig.app.title}-darkThemePrimaryColor`) || staticPrimaryColorDark,
        'on-primary': '#0B1020',
        'secondary': '#9AA4B2',
        'on-secondary': '#0B1020',
        'success': '#36C07E',
        'on-success': '#0B1020',
        'info': '#45A8E0',
        'on-info': '#0B1020',
        'warning': '#E5A53B',
        'on-warning': '#0B1020',
        'error': '#EF6A5B',
        'on-error': '#0B1020',
        'background': '#0E1219',
        'on-background': '#E8EBF1',
        'surface': '#161B24',
        'on-surface': '#E8EBF1',

        'bg-subtle': '#0A0D13',
        'surface-2': '#1B212C',
        'surface-inset': '#11161E',
        'border': '#262E3B',
        'border-strong': '#323C4C',

        'text-secondary': '#9AA4B2',
        'text-tertiary': '#6B7585',
        'text-disabled': '#4B5563',

        'primary-hover': '#819AFF',
        'primary-active': '#5C7BF5',
        'primary-weak': '#1C2640',
        'primary-weak-2': '#243154',
        'primary-border': '#34467A',

        'success-strong': '#45CE8C',
        'success-weak': '#14271E',
        'success-border': '#1F4733',
        'warning-strong': '#F0B557',
        'warning-weak': '#2A2113',
        'warning-border': '#4A3A1B',
        'error-strong': '#F48376',
        'error-weak': '#2C1714',
        'error-border': '#50271F',
        'info-strong': '#5FB7EA',
        'info-weak': '#11242F',
        'info-border': '#1E3D4F',
        'neutral-weak': '#1E2530',
        'neutral-border': '#2C3543',

        'chart-revenue': '#6E8BFF',
        'chart-expense': '#E89A5C',
        'chart-cash': '#36C07E',
        'chart-card': '#6E8BFF',
        'chart-grid': '#232B38',
        'chart-axis': '#5B6572',
        'chart-track': '#222A36',
        'chart-target': '#6B7585',

        'c1': '#6E8BFF',
        'c2': '#36C07E',
        'c3': '#E89A5C',
        'c4': '#9DB0FF',
        'c5': '#7E8A9C',

        'grey-50': '#2A2E42',
        'grey-100': '#444463',
        'grey-200': '#4A5072',
        'grey-300': '#5E6692',
        'grey-400': '#7983BB',
        'grey-500': '#8692D0',
        'grey-600': '#AAB3DE',
        'grey-700': '#B6BEE3',
        'grey-800': '#CFD3EC',
        'grey-900': '#E7E9F6',
        'perfect-scrollbar-thumb': '#4A5072',
        'skin-bordered-background': '#161B24',
        'skin-bordered-surface': '#161B24',
      },
      variables: {
        'code-color': '#d400ff',
        'overlay-scrim-background': '#03060C',
        'overlay-scrim-opacity': 0.6,
        'border-color': '#262E3B',
        'snackbar-background': '#E8EBF1',
        'snackbar-color': '#0B1020',
        'tooltip-background': '#1B212C',
        'tooltip-opacity': 0.95,

        'shadow-key-umbra-opacity': 'rgba(0, 0, 0, 0.5)',
        'shadow-key-penumbra-opacity': 'rgba(0, 0, 0, 0.4)',
        'shadow-key-ambient-opacity': 'rgba(0, 0, 0, 0.4)',
      },
    },
  },
}

export default theme
