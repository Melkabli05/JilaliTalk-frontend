const ENGLISH = [
  'Hey everyone! 👋',
  "What's the topic?",
  'Good vibes only ✨',
] as const;

const FRENCH = [
  'Salut tout le monde ! 👋',
  "C'est quoi le sujet ?",
  'Bonne humeur garantie ! 😄',
] as const;

const ARABIC = [
  'مرحبًا بالجميع! 👋',
  'ما هو الموضوع؟',
  'تحياتي 🌹',
] as const;

export function getStarterComments(langId: number): readonly string[] {
  if (langId === 13 || langId === 13001) return ARABIC;
  if (langId === 8 || langId === 8001) return FRENCH;
  return ENGLISH;
}
