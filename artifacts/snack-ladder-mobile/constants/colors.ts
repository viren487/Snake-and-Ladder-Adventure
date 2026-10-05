/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const palette = {
  text: '#fff4d2',
  tint: '#f5c653',
  background: '#171b2c',
  foreground: '#fff4d2',
  card: '#202636',
  cardForeground: '#fff4d2',
  primary: '#f5c653',
  primaryForeground: '#202536',
  secondary: '#303a50',
  secondaryForeground: '#fff4d2',
  muted: '#2a3142',
  mutedForeground: '#aeb7c9',
  accent: '#63c98f',
  accentForeground: '#16261f',
  destructive: '#e87870',
  destructiveForeground: '#fff4d2',
  border: '#514938',
  input: '#30394a',
  boardGreen: '#92d76b',
  boardCream: '#f5d779',
  boardBlue: '#78cbd1',
  boardDark: '#282a35',
  boardInk: '#243327',
  boardFrame: '#a9662e',
  boardFrameLight: '#f1c56a',
  ladderInk: '#9b5828',
  snakeInk: '#bd4e46',
  transparentBorder: 'rgba(40, 42, 53, 0.35)',
  tokenBlue: '#4db7df',
  tokenCoral: '#ef806f',
  tokenGreen: '#69c47d',
  tokenPurple: '#a787e4',
};

const colors = {
  light: { ...palette },
  dark: { ...palette },
  radius: 14,
};

export default colors;
