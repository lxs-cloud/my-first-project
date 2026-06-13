export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  source: 'arXiv' | 'ESO' | 'NASA NEA' | 'APOD' | 'NADC' | 'ESA' | 'HubbleSite' | 'Astrobites' | 'Sky & Telescope' | 'CMSE' | 'SkyWatcher' | 'EclipseWise';
  description?: string;
}

export interface ScrapResult {
  articles: Article[];
  error?: string;
}
