import { uz } from '../i18n/uz';
import { ru } from '../i18n/ru';
import { en } from '../i18n/en';
export type Lang = 'uz' | 'ru' | 'en';
export const LANGS: Lang[] = ['uz', 'ru', 'en'];
export const LANG_NAMES: Record<Lang, string> = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' };
const dicts: Record<Lang, Record<string, string>> = { uz, ru, en };
export const isLang = (x: any): x is Lang => LANGS.includes(x);

// Markazlashgan tarjima: avval DB dagi tahrirlangan matn (overrides), keyin lug'at, keyin zaxira til (uz), keyin kalit.
export function makeT(lang: Lang, overrides: Record<string, string> = {}) {
  return (key: string, vars?: Record<string, string | number>): string => {
    let s = overrides[key] ?? dicts[lang][key] ?? dicts.uz[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
export const dictKeys = () => Object.keys(dicts.uz);
export const getDict = (l: Lang) => dicts[l];
