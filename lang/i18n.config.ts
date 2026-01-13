import zh from "./locales/zh-CN.json";
import en from "./locales/en-US.json";
import jp from "./locales/ja-JP.json";
import kr from "./locales/ko-KR.json";

export default defineI18nConfig(() => ({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": zh,
    "en": en,
    "ja-JP": jp,
    "ko-KR": kr,
  },
  fallbackLocale: "zh-CN",
}));
