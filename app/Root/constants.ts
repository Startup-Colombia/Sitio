import { clickable, CSS, absoluteCenter } from 'fractal-core/core'

// Breakpoint responsive in pixels
export const BP = {
  sm: 480,
  md: 768,
}

export const textStyle: CSS = {
  fontFamily: '\'Open Sans\', sans-serif',
}

export const palette = {
  primary: '#1A69EE',
  primaryLight: '#367AEC',
  secondary: '#ee6f1a',
  secondaryLight: '#f2832e',
  textPrimary: '#302f2f',
  textSecondary: '#404040',
  textTertiary: '#5c5657',
  shadowGrey: 'rgba(197,207,235,1)',
  shadowLight: '#e8e7e7',
  shadowLighter: '#f2f2f2',
  borderLight: '#bfbfbf',
  borderGrey: '#ada8a9',
  actionColor: '#1dc763',
  actionColorLight: '#1bd668',
  // qualify
  red: '#ee1a1a',
  yellow: '#eed91a',
  green: '#45ee1a',
  // Colombia related
  redCol: '#CE1126',
}

export const createBtnStyle = (mainColor: string, lightColor: string, textColor: string): CSS => ({
  padding: '8px 10px',
  borderRadius: '4px',
  fontSize: '20px',
  color: textColor,
  backgroundColor: mainColor,
  border: 'none',
  outline: 'none',
  ...absoluteCenter,
  ...clickable,
  $nest: {
    '&:hover': {
      backgroundColor: lightColor,
    },
    '&:focus': {
      backgroundColor: lightColor,
    },
  },
})

export const buttonPrimaryStyle: CSS = createBtnStyle(palette.primary, palette.primaryLight, 'white')

export const buttonCancelStyle: CSS = createBtnStyle(palette.shadowLighter, palette.shadowLight, palette.textSecondary)

export const scrollBar: CSS = {
  $nest: {
    '&::-webkit-scrollbar': {
      width: '12px',
      height: '12px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: palette.shadowLighter,
      borderRadius: '7px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: palette.borderLight,
      borderRadius: '7px',
    },
  },
}
export const simpleInput: CSS = {
  ...textStyle,
  width: '80%',
  margin: '5px 0',
  minWidth: '300px',
  padding: '8px',
  fontSize: '18px',
  outline: 'none',
  border: 'none',
  color: palette.textPrimary,
  borderBottom: '1px solid ' + palette.borderLight,
  $nest: {
    '&:focus': {
      borderBottom: '1px solid ' + palette.primary,
    },
  },
}
