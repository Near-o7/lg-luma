import type { Language } from './types';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import messages from './messages.json';

export type MessageKey = keyof typeof messages;

export function translate(
  language: Language,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  let message: string = messages[key][language] ?? messages[key].en;
  for (const [name, value] of Object.entries(values ?? {}))
    message = message.replaceAll(`{${name}}`, String(value));
  return message;
}

export const localeFor = (language: Language) =>
  language === 'de' ? 'de-DE' : language === 'zh' ? 'zh-CN' : 'en-US';

const LanguageContext = createContext<Language>('en');

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = localeFor(language);
  }, [language]);
  return createElement(LanguageContext.Provider, { value: language }, children);
}

export function useTranslation() {
  const language = useContext(LanguageContext);
  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values),
    [language],
  );
  return { language, locale: localeFor(language), t };
}

export function categoryLabel(language: Language, category: string) {
  const key = `category${category}` as MessageKey;
  return translate(language, key);
}

export function wallpaperLabel(language: Language, id: string, fallback: string) {
  const keys: Record<string, MessageKey> = {
    slate: 'slate',
    midnight: 'midnight',
    prism: 'prism',
    dunes: 'monumentValley',
    'san-francisco': 'sanFrancisco',
    summit: 'summit',
    forest: 'forest',
    yosemite: 'yosemite',
    'northern-lights': 'northernLights',
  };
  const key = keys[id];
  return key ? translate(language, key) : fallback;
}
