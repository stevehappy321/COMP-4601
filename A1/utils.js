import * as cheerio from "cheerio";

// Extract text from paragraph tags only
export function pContent(html) {
  if (!html) return "";
  
  const $ = cheerio.load(html);

  const paragraphs = [];
  $("p").each((i, el) => {
    const text = $(el).text().trim();
    if (text) {
      paragraphs.push(text);
    }
  });

  return paragraphs.join(" ");
}

// Extract title from HTML
export function extractTitle(html) {
  if (!html) return "Untitled";
  
  const $ = cheerio.load(html);
  
  // Try <title> tag first
  const titleTag = $("title").first().text().trim();
  if (titleTag) return titleTag;
  
  // Try <h1> tag as fallback
  const h1Tag = $("h1").first().text().trim();
  if (h1Tag) return h1Tag;
  
  return "Untitled";
}

// Calculate word frequency from paragraph content
export function calculateWordFrequency(html) {
  const text = pContent(html);
  if (!text) return {};
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  const frequency = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }
  
  // Return top 50 most frequent words
  return Object.fromEntries(
    Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
  );
}