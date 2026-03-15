import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEs from '../../public/locales/es/common.json';
import authEs from '../../public/locales/es/auth.json';
import commonEn from '../../public/locales/en/common.json';
import authEn from '../../public/locales/en/auth.json';

i18n.use(initReactI18next).init({
  resources: {
    es: { common: commonEs, auth: authEs },
    en: { common: commonEn, auth: authEn },
  },
  lng: 'es',
  fallbackLng: 'es',
  ns: ['common', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
