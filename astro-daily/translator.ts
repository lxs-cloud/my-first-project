async function translateText(text: string): Promise<string> {
  if (!text || text === '(暂无摘要)') return text;

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) throw new Error('Translation API error');

    const data = await response.json() as { responseData: { translatedText: string } };
    const translated = data.responseData?.translatedText;

    if (translated && translated !== text && translated !== 'Sorry, did not find any translation') {
      return translated;
    }
  } catch (error) {
    console.warn(`Translation failed for: "${text.slice(0, 50)}..."`);
  }

  return text;
}

export async function translateTitle(title: string): Promise<{
  en: string;
  zh: string;
}> {
  const en = title || '';
  const zh = await translateText(en);

  return { en, zh };
}

export async function translateDescription(description: string | undefined): Promise<{
  en: string;
  zh: string;
}> {
  const en = description || '(No summary available)';
  const zh = await translateText(en);

  return { en, zh };
}
