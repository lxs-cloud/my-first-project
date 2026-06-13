export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  source: 'TechCrunch' | 'The Verge' | 'Hacker News';
  description?: string;
}

export interface FetchResult {
  articles: Article[];
  error?: string;
}
