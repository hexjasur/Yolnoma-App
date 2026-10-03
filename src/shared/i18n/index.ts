import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import localizationConfig from "@/config/localization.json";
import enCommon from "./locales/en/common.json";
import ruCommon from "./locales/ru/common.json";
import esCommon from "./locales/es/common.json";
import zhCommon from "./locales/zh/common.json";

export type AppLanguage =
  (typeof localizationConfig.supportedLanguages)[number]["code"];

const LANGUAGE_STORAGE_KEY = "yolnoma_language";
const supportedLanguages = localizationConfig.supportedLanguages.map(
  ({ code }) => code,
) as AppLanguage[];

function getInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    ) as AppLanguage | null;
    if (stored && supportedLanguages.includes(stored)) return stored;
  } catch {
    // Storage may be unavailable during an embedded startup.
  }

  const browserLanguage = navigator.language.split("-")[0] as AppLanguage;
  return supportedLanguages.includes(browserLanguage)
    ? browserLanguage
    : localizationConfig.defaultLanguage;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    ru: { common: ruCommon },
    es: { common: esCommon },
    zh: { common: zhCommon },
  },
  lng: getInitialLanguage(),
  fallbackLng: localizationConfig.defaultLanguage,
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export function setAppLanguage(language: AppLanguage): void {
  if (!supportedLanguages.includes(language)) return;
  void i18n.changeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage may be unavailable; i18next still updates in memory.
  }
}

export function getSupportedLanguages() {
  return localizationConfig.supportedLanguages;
}

export { i18n };
export default i18n;
