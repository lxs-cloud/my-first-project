import Anthropic from '@anthropic-ai/sdk';
import { translateDescription } from './translator';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export async function summarizeArticle(
  title: string,
  description?: string
): Promise<{ en: string; zh: string }> {
  const anthropic = getClient();
  if (!anthropic) {
    return translateDescription(description);
  }

  const text = description || '';
  if (!text && !title) {
    return { en: '(No summary available)', zh: '(暂无摘要)' };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Summarize this article in exactly one sentence in English, then one sentence in Chinese. Output ONLY two lines:
EN: <one sentence English summary>
ZH: <one sentence Chinese summary>

Title: ${title}
Description: ${text}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return translateDescription(description);
    }

    const lines = content.text.trim().split('\n');
    let en = '';
    let zh = '';

    for (const line of lines) {
      if (line.startsWith('EN:')) en = line.slice(3).trim();
      else if (line.startsWith('ZH:')) zh = line.slice(3).trim();
    }

    if (en && zh) return { en, zh };
    return translateDescription(description);
  } catch {
    return translateDescription(description);
  }
}
