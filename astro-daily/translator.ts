const DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isChinese(text: string): boolean {
  const chineseChars = text.match(/[一-鿿㐀-䶿]/g);
  if (!chineseChars) return false;
  return chineseChars.length / text.length > 0.3;
}

function isEnglish(text: string): boolean {
  const englishChars = text.match(/[a-zA-Z]/g);
  if (!englishChars) return false;
  return englishChars.length / text.length > 0.4;
}

function isGarbledTranslation(original: string, translated: string): boolean {
  if (!translated || translated === original) return true;
  if (translated.toLowerCase() === original.toLowerCase()) return true;
  if (translated === 'Sorry, did not find any translation') return true;

  // 检测日期被打乱的情况（如 "2027 Feb 06" 翻译后年份被拆开）
  const yearMatches = original.match(/\d{4}/g);
  if (yearMatches) {
    for (const year of yearMatches) {
      // 如果原文有完整年份，但翻译中年份字符被拆散到不同位置
      const yearInTranslated = translated.match(new RegExp(`${year}`));
      if (!yearInTranslated) {
        // 年份完全消失或被拆开，可能是乱翻译
        const digits = year.split('');
        const scattered = digits.every(d => translated.includes(d));
        if (scattered && !translated.includes(year)) return true;
      }
    }
  }

  // 翻译结果如果比原文短太多（不到20%），可能有问题
  if (translated.length < original.length * 0.15 && original.length > 20) return true;

  return false;
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) return response;
    } catch {
      if (i < retries - 1) await sleep(1000);
    }
  }
  return null;
}

async function translateWithGoogle(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.slice(0, 500))}`;
  const response = await fetchWithRetry(url);
  if (!response) return null;

  try {
    const data = await response.json() as any[][];
    if (!data || !data[0]) return null;
    const translated = data[0].map((seg: any[]) => seg[0]).join('');
    if (isGarbledTranslation(text, translated)) return null;
    return translated;
  } catch {
    return null;
  }
}

async function translateWithMyMemory(text: string, langpair: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${langpair}`;
  const response = await fetchWithRetry(url);
  if (!response) return null;

  try {
    const data = await response.json() as { responseData: { translatedText: string; match: number } };
    const translated = data.responseData?.translatedText;
    const match = data.responseData?.match;
    if (!translated) return null;
    if (match !== undefined && match < 0.3) return null;
    if (isGarbledTranslation(text, translated)) return null;
    return translated;
  } catch {
    return null;
  }
}

async function translateEnToZh(text: string): Promise<string> {
  const googleResult = await translateWithGoogle(text, 'en', 'zh-CN');
  if (googleResult) return googleResult;

  await sleep(DELAY_MS);

  const myMemoryResult = await translateWithMyMemory(text, 'en|zh-CN');
  if (myMemoryResult) return myMemoryResult;

  return text;
}

async function translateZhToEn(text: string): Promise<string> {
  const googleResult = await translateWithGoogle(text, 'zh-CN', 'en');
  if (googleResult) return googleResult;

  await sleep(DELAY_MS);

  const myMemoryResult = await translateWithMyMemory(text, 'zh-CN|en');
  if (myMemoryResult) return myMemoryResult;

  return text;
}

export async function translateTitle(title: string): Promise<{
  en: string;
  zh: string;
}> {
  if (!title) return { en: '', zh: '' };

  if (isChinese(title)) {
    const en = await translateZhToEn(title);
    return { en, zh: title };
  } else if (isEnglish(title)) {
    const zh = await translateEnToZh(title);
    return { en: title, zh };
  }

  return { en: title, zh: title };
}

export async function translateDescription(description: string | undefined): Promise<{
  en: string;
  zh: string;
}> {
  const text = description || '(No summary available)';

  if (text === '(No summary available)' || text === '(暂无摘要)') {
    return { en: '(No summary available)', zh: '(暂无摘要)' };
  }

  if (isChinese(text)) {
    const en = await translateZhToEn(text);
    return { en, zh: text };
  } else if (isEnglish(text)) {
    const zh = await translateEnToZh(text);
    return { en: text, zh };
  }

  return { en: text, zh: text };
}
