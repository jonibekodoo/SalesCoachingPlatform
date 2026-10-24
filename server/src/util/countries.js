// Supported countries: the company's country decides the language of the calls and of every result text.
export const COUNTRIES = [
  { code: 'UZ', name: 'Oʻzbekiston', language: 'Uzbek', languageCode: 'uz', note: 'Latin script, with oʻ, gʻ and ʼ' },
  { code: 'RU', name: 'Rossiya', language: 'Russian', languageCode: 'ru' },
  { code: 'KZ', name: 'Qozogʻiston', language: 'Kazakh', languageCode: 'kk', note: 'Calls may mix Kazakh and Russian; answer in Kazakh' },
  { code: 'KG', name: 'Qirgʻiziston', language: 'Kyrgyz', languageCode: 'ky', note: 'Calls may mix Kyrgyz and Russian; answer in Kyrgyz' },
  { code: 'TJ', name: 'Tojikiston', language: 'Tajik', languageCode: 'tg' },
  { code: 'TM', name: 'Turkmaniston', language: 'Turkmen', languageCode: 'tk' },
  { code: 'AZ', name: 'Ozarbayjon', language: 'Azerbaijani', languageCode: 'az' },
  { code: 'TR', name: 'Turkiya', language: 'Turkish', languageCode: 'tr' },
  { code: 'US', name: 'AQSH', language: 'English', languageCode: 'en' },
  { code: 'GB', name: 'Buyuk Britaniya', language: 'English', languageCode: 'en' },
  { code: 'DE', name: 'Germaniya', language: 'German', languageCode: 'de' },
  { code: 'FR', name: 'Fransiya', language: 'French', languageCode: 'fr' },
  { code: 'ES', name: 'Ispaniya', language: 'Spanish', languageCode: 'es' },
  { code: 'IT', name: 'Italiya', language: 'Italian', languageCode: 'it' },
  { code: 'PL', name: 'Polsha', language: 'Polish', languageCode: 'pl' },
  { code: 'UA', name: 'Ukraina', language: 'Ukrainian', languageCode: 'uk' },
  { code: 'AE', name: 'BAA', language: 'Arabic', languageCode: 'ar' },
  { code: 'SA', name: 'Saudiya Arabistoni', language: 'Arabic', languageCode: 'ar' },
  { code: 'IN', name: 'Hindiston', language: 'Hindi', languageCode: 'hi', note: 'Calls may mix Hindi and English (Hinglish); answer in Hindi' },
  { code: 'PK', name: 'Pokiston', language: 'Urdu', languageCode: 'ur' },
  { code: 'CN', name: 'Xitoy', language: 'Chinese (Simplified)', languageCode: 'zh' },
  { code: 'JP', name: 'Yaponiya', language: 'Japanese', languageCode: 'ja' },
  { code: 'KR', name: 'Janubiy Koreya', language: 'Korean', languageCode: 'ko' },
  { code: 'ID', name: 'Indoneziya', language: 'Indonesian', languageCode: 'id' },
  { code: 'BR', name: 'Braziliya', language: 'Portuguese (Brazil)', languageCode: 'pt' },
];

export const DEFAULT_COUNTRY = 'UZ';

export const findCountry = (code) => COUNTRIES.find((c) => c.code === String(code || '').toUpperCase());

export const isValidCountry = (code) => !!findCountry(code);
