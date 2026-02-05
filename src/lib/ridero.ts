import { BookData } from './types';

export async function parseRideroPage(url: string): Promise<BookData> {
  // Fetch the page
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Ridero page: ${response.status}`);
  }

  const html = await response.text();

  // Extract data using regex (simple approach for MVP)
  const title = extractMeta(html, 'og:title') || extractTag(html, 'h1') || 'Без названия';
  const description = extractMeta(html, 'og:description') || '';
  const coverUrl = extractMeta(html, 'og:image') || '';

  // Extract structured data from JSON-LD if available
  const jsonLd = extractJsonLd(html);

  // Try to extract from page content
  const author = jsonLd?.author?.name || extractAuthor(html) || 'Неизвестный автор';
  const genre = extractGenre(html) || 'Художественная литература';
  const pages = extractPages(html) || 0;
  const ageRating = extractAgeRating(html) || '12+';
  const rating = extractRating(html);
  const reviewCount = extractReviewCount(html);
  const authorBio = extractAuthorBio(html);

  return {
    title: cleanTitle(title),
    author,
    genre,
    description: cleanDescription(description),
    pages,
    ageRating,
    rating,
    reviewCount,
    authorBio,
    coverUrl,
  };
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
  const match = html.match(regex);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function extractAuthor(html: string): string | null {
  // Look for author in various places
  const patterns = [
    /class=["'][^"']*author[^"']*["'][^>]*>([^<]+)</i,
    /Автор[:\s]*<[^>]+>([^<]+)</i,
    /itemprop=["']author["'][^>]*>([^<]+)</i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractGenre(html: string): string | null {
  const patterns = [
    /Жанр[:\s]*<[^>]+>([^<]+)</i,
    /class=["'][^"']*genre[^"']*["'][^>]*>([^<]+)</i,
    /itemprop=["']genre["'][^>]*>([^<]+)</i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractPages(html: string): number {
  const patterns = [
    /(\d+)\s*(?:страниц|стр\.?|pages)/i,
    /Объём[:\s]*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

function extractAgeRating(html: string): string | null {
  const match = html.match(/(\d+)\+/);
  return match ? match[0] : null;
}

function extractRating(html: string): number | undefined {
  const patterns = [
    /itemprop=["']ratingValue["'][^>]*>([0-9.]+)</i,
    /(\d+[.,]\d+)\s*(?:из\s*5|\/\s*5|★)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return parseFloat(match[1].replace(',', '.'));
  }
  return undefined;
}

function extractReviewCount(html: string): number | undefined {
  const patterns = [
    /itemprop=["']reviewCount["'][^>]*>(\d+)</i,
    /(\d+)\s*(?:отзыв|review)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

function extractAuthorBio(html: string): string | undefined {
  const patterns = [
    /Об авторе[:\s]*<[^>]*>([^<]{20,500})</i,
    /class=["'][^"']*author-bio[^"']*["'][^>]*>([^<]{20,500})</i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

function cleanTitle(title: string): string {
  // Remove common suffixes like "— купить книгу" etc
  return title
    .replace(/\s*[—–-]\s*(купить|читать|скачать|книга).*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();
}

function cleanDescription(description: string): string {
  // Remove promotional text
  return description
    .replace(/Купи(те)?\s+книгу.*$/i, '')
    .replace(/Читай(те)?\s+онлайн.*$/i, '')
    .trim();
}
