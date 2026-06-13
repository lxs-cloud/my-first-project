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

  const yearMatches = original.match(/\d{4}/g);
  if (yearMatches) {
    for (const year of yearMatches) {
      const yearInTranslated = translated.match(new RegExp(`${year}`));
      if (!yearInTranslated) {
        const digits = year.split('');
        const scattered = digits.every(d => translated.includes(d));
        if (scattered && !translated.includes(year)) return true;
      }
    }
  }

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
    return { en: title, zh: title };
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
    return { en: text, zh: text };
  } else if (isEnglish(text)) {
    const zh = await translateEnToZh(text);
    return { en: text, zh };
  }

  return { en: text, zh: text };
}
