import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  createTranslator,
  loadLocaleBundle,
  loadSettings,
  type Translator
} from "@metro/shared-utils";

const APP_ID = "frontend";
const LOCALE_STORAGE_KEY = "metro-locale";

type I18nContextValue = {
  lang: string;
  supportedLocales: string[];
  setLocale: (lang: string) => void;
  t: Translator;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveInitialLocale(supported: string[], fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && supported.includes(stored)) {
    return stored;
  }
  const browser = window.navigator.language?.split("-")[0];
  if (browser && supported.includes(browser)) {
    return browser;
  }
  return fallback;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const settings = useMemo(() => loadSettings(APP_ID), []);
  const supported = Array.isArray(settings.supportedLocales) && settings.supportedLocales.length > 0 ? settings.supportedLocales : ["en"];
  const fallback = typeof settings.defaultLocale === "string" && settings.defaultLocale.length > 0 ? settings.defaultLocale : supported[0];
  const initialLocale = resolveInitialLocale(supported, fallback);

  const [lang, setLang] = useState(initialLocale);

  const translator = useMemo(() => {
    const bundles = loadLocaleBundle(APP_ID, lang);
    const fallbackBundles = lang === fallback ? undefined : { locale: fallback, bundles: loadLocaleBundle(APP_ID, fallback) };
    return createTranslator({ locale: lang, bundles, fallback: fallbackBundles });
  }, [lang, fallback]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, lang);
    }
  }, [lang]);

  const setLocale = useCallback(
    (next: string) => {
      if (supported.includes(next)) {
        setLang(next);
        return;
      }
      setLang(fallback);
    },
    [supported, fallback]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, supportedLocales: supported, setLocale, t: translator }),
    [lang, supported, setLocale, translator]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("I18nProvider is missing in the component tree.");
  }
  return ctx;
}
