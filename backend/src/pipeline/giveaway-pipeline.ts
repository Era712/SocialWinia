import { categorizeGiveaway } from '../ai-agents/categorizer';
import { extractGiveawayData } from '../ai-agents/extractor';
import { validateGiveaway } from '../ai-agents/validator';
import { isOpenAIConfigured } from '../config/openai';
import { isScrapingBeeConfigured } from '../config/scrapingbee';
import { isSupabaseConfigured, supabase } from '../config/supabase';
import { sendOneSignalNotification } from '../config/onesignal';
import { getLastScraperDiagnostics, scrapeAllPlatforms } from '../scrapers';
import { CategorizationResult, ExtractionResult, PipelineResult, RawPost, ValidationResult } from '../types';

export async function runGiveawayPipeline(): Promise<PipelineResult> {
  const missingServices = [
    !isSupabaseConfigured ? 'Supabase' : null,
    !isOpenAIConfigured ? 'OpenAI' : null,
    !isScrapingBeeConfigured ? 'ScrapingBee' : null,
  ].filter(Boolean);

  if (missingServices.length > 0) {
    return {
      fallbackCount: 0,
      rawCount: 0,
      processedCount: 0,
      savedCount: 0,
      skippedCount: 0,
      errors: [`Missing configuration: ${missingServices.join(', ')}`],
    };
  }

  const rawPosts = await scrapeAllPlatforms();
  const result = await processRawPosts(rawPosts);
  const scraperDiagnostics = getLastScraperDiagnostics();

  if (result.rawCount === 0) {
    result.errors.push('No raw posts were returned by the active scrapers.');
    result.errors.push(...scraperDiagnostics.messages.slice(0, 6));
  } else {
    const importantDiagnostics = scraperDiagnostics.messages.filter(
      (message) =>
        message.includes('SCRAPER_MAX_RAW_POSTS') ||
        message.startsWith('Limited raw posts') ||
        message.startsWith('Active scrapers:')
    );
    result.errors.push(...importantDiagnostics);
  }

  if (result.savedCount > 0) {
    await sendOneSignalNotification(
      'New giveaways available',
      `${result.savedCount} new or updated giveaways are ready in SocialWinia.`
    );
  }

  return result;
}

export async function processRawPosts(rawPosts: RawPost[]): Promise<PipelineResult> {
  const result: PipelineResult = {
    fallbackCount: 0,
    rawCount: rawPosts.length,
    processedCount: 0,
    savedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  for (const rawPost of rawPosts) {
    try {
      if (!isSpecificGiveawayUrl(rawPost.url, rawPost.platform)) {
        result.skippedCount++;
        result.errors.push(`Skipped non-specific ${rawPost.platform} link: ${rawPost.url}`);
        continue;
      }

      let usedFallback = false;
      const markFallback = () => {
        usedFallback = true;
      };
      const category = await safeCategorizeGiveaway(rawPost, markFallback);

      if (!category?.primary_category) {
        result.skippedCount++;
        result.errors.push(`No category detected: ${rawPost.url}`);
        continue;
      }

      const details = await safeExtractGiveawayData(rawPost, markFallback);

      if (isEndedGiveaway(rawPost, details.end_date)) {
        result.skippedCount++;
        result.errors.push(`Skipped ended giveaway: ${rawPost.url}`);
        continue;
      }

      const validation = await safeValidateGiveaway(rawPost, markFallback);
      const isValid = validation.is_valid ?? validation.is_legitimate ?? validation.action !== 'reject';

      if (!isValid) {
        result.skippedCount++;
        result.errors.push(`Rejected by validation: ${rawPost.url}`);
        continue;
      }

      const { error } = await supabase.from('giveaways').upsert(
        {
          platform: rawPost.platform.toLowerCase(),
          title: rawPost.title,
          description: rawPost.description,
          url: rawPost.url,
          organizer: rawPost.organizer,
          follower_count: rawPost.follower_count,
          is_verified: rawPost.is_verified,
          posted_at: rawPost.posted_at,
          category: category.primary_category,
          secondary_categories: category.secondary_categories ?? [],
          tags: category.tags ?? [],
          prize_value_chf: details.prize_value_chf,
          prize_items: details.prize_items ?? [],
          entry_methods: details.requirements ?? [],
          end_date: details.end_date,
          requirements: details.requirements ?? [],
          winner_count: details.winner_count ?? 1,
          trust_score: validation.trust_score ?? validation.confidence ?? 50,
          risk_level: validation.risk_level ?? 'medium',
          processing_method: usedFallback ? 'heuristic_fallback' : 'openai',
          processing_notes: usedFallback
            ? 'OpenAI was unavailable or over quota; processed using SocialWinia heuristic fallback.'
            : 'Processed with OpenAI agents.',
          last_seen_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        },
        { onConflict: 'url' }
      );

      if (error) {
        result.errors.push(`${rawPost.url}: ${error.message}`);
        continue;
      }

      result.processedCount++;
      result.savedCount++;
      if (usedFallback) {
        result.fallbackCount++;
      }
    } catch (error) {
      result.errors.push(`${rawPost.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

async function safeCategorizeGiveaway(rawPost: RawPost, markFallback: () => void): Promise<CategorizationResult> {
  try {
    return await categorizeGiveaway(rawPost);
  } catch (error) {
    if (!shouldUseHeuristicFallback(error)) {
      throw error;
    }

    markFallback();
    return {
      primary_category: inferCategory(rawPost),
      secondary_categories: [],
      tags: ['ai_fallback'],
    };
  }
}

async function safeExtractGiveawayData(rawPost: RawPost, markFallback: () => void): Promise<ExtractionResult> {
  try {
    return await extractGiveawayData(rawPost);
  } catch (error) {
    if (!shouldUseHeuristicFallback(error)) {
      throw error;
    }

    markFallback();
    return {
      end_date: inferEndDate(rawPost),
      prize_items: [rawPost.title],
      prize_value_chf: inferPrizeValue(rawPost),
      requirements: inferRequirements(rawPost),
      winner_count: inferWinnerCount(rawPost),
    };
  }
}

async function safeValidateGiveaway(rawPost: RawPost, markFallback: () => void): Promise<ValidationResult> {
  try {
    return await validateGiveaway(rawPost);
  } catch (error) {
    if (!shouldUseHeuristicFallback(error)) {
      throw error;
    }

    markFallback();
    return {
      action: 'review',
      confidence: 50,
      is_valid: true,
      risk_level: 'medium',
      trust_score: 50,
      reasoning: 'OpenAI quota unavailable; saved using heuristic fallback for manual review.',
    };
  }
}

function shouldUseHeuristicFallback(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes('429') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('timeout') ||
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('json') ||
    normalized.includes('parse') ||
    normalized.includes('invalid response') ||
    normalized.includes('api key') ||
    normalized.includes('authentication')
  );
}

function isSpecificGiveawayUrl(url: string, platform: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    const platformName = platform.toLowerCase();

    if (hostname === 'example.com' || hostname.endsWith('.example.com')) {
      return false;
    }

    switch (platformName) {
      case 'instagram':
        return pathname.startsWith('/p/') || pathname.startsWith('/reel/') || pathname.startsWith('/tv/');
      case 'tiktok':
        return pathname.includes('/video/');
      case 'x':
      case 'twitter':
        return pathname.includes('/status/');
      case 'youtube':
        return (
          hostname === 'youtu.be' ||
          (hostname.includes('youtube.com') && (pathname === '/watch' || pathname.startsWith('/shorts/')))
        );
      case 'facebook':
        return (
          !pathname.includes('/hashtag/') &&
          (pathname.includes('/posts/') ||
            pathname.includes('/permalink/') ||
            pathname.includes('/videos/') ||
            pathname.includes('/reel/') ||
            parsedUrl.searchParams.has('story_fbid'))
        );
      case 'threads':
        return pathname.includes('/post/');
      case 'reddit':
        return pathname.includes('/comments/');
      case 'linkedin':
        return pathname.includes('/feed/update/');
      case 'telegram': {
        const parts = pathname.split('/').filter(Boolean);
        return parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1]);
      }
      case 'discord':
      case 'kick':
      case 'twitch':
        return true;
      default:
        return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    }
  } catch {
    return false;
  }
}

function inferCategory(rawPost: RawPost) {
  const text = `${rawPost.title} ${rawPost.description} ${rawPost.full_text ?? ''}`.toLowerCase();

  if (text.includes('game') || text.includes('gaming') || text.includes('playstation') || text.includes('xbox')) {
    return 'Gaming';
  }

  if (text.includes('crypto') || text.includes('nft') || text.includes('bitcoin')) {
    return 'Crypto & Digital Assets';
  }

  if (text.includes('cash') || text.includes('money') || text.includes('chf') || text.includes('$')) {
    return 'Cash Prizes';
  }

  if (text.includes('phone') || text.includes('laptop') || text.includes('tech')) {
    return 'Tech & Electronics';
  }

  if (text.includes('travel') || text.includes('trip') || text.includes('hotel')) {
    return 'Travel';
  }

  return 'Other';
}

function inferPrizeValue(rawPost: RawPost) {
  const text = `${rawPost.title} ${rawPost.description} ${rawPost.full_text ?? ''}`;
  const match = text.match(/(?:CHF|\$|USD|EUR)\s?([\d,.]+)/i);

  if (!match?.[1]) {
    return 0;
  }

  return Number(match[1].replace(/,/g, '')) || 0;
}

function inferEndDate(rawPost: RawPost) {
  const text = `${rawPost.description} ${rawPost.full_text ?? ''}`;
  const englishDate = text.match(/(?:ends?|until|by|deadline)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);

  if (englishDate?.[1]) {
    const parts = englishDate[1].replace(',', '').split(/\s+/);
    const monthIndex = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ].indexOf(parts[0].toLowerCase());
    const day = Number(parts[1]);
    const year = Number(parts[2]);

    if (monthIndex >= 0 && day && year) {
      return formatDate(year, monthIndex + 1, day);
    }
  }

  const numericDate = text.match(
    /(?:ends?|until|by|deadline|endet|bis|teilnahmeschluss|einsendeschluss)?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i
  );

  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    const rawYear = Number(numericDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (isValidDateParts(year, month, day)) {
      return formatDate(year, month, day);
    }
  }

  const isoDate = text.match(/(?:ends?|until|by|deadline|endet|bis)?\s*(\d{4})-(\d{1,2})-(\d{1,2})/i);

  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);

    if (isValidDateParts(year, month, day)) {
      return formatDate(year, month, day);
    }
  }

  return null;
}

function isEndedGiveaway(rawPost: RawPost, endDate?: string | null) {
  const text = `${rawPost.title} ${rawPost.description} ${rawPost.full_text ?? ''}`.toLowerCase();
  const endedPatterns = [
    /\bexpired\b/,
    /\bclosed\b/,
    /\bended\b/,
    /\bgiveaway over\b/,
    /\bcontest over\b/,
    /\bentries closed\b/,
    /\bwinner announced\b/,
    /\bwinners announced\b/,
    /\bwinner selected\b/,
    /\bwinners selected\b/,
    /\bbeendet\b/,
    /\babgelaufen\b/,
    /\bgeschlossen\b/,
    /\bgewinnspiel vorbei\b/,
    /\bverlosung vorbei\b/,
    /\bteilnahmeschluss erreicht\b/,
    /\bgewinner steht fest\b/,
    /\bgewinner bekanntgegeben\b/,
  ];

  if (endedPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (!endDate) {
    return false;
  }

  const parsedEndDate = new Date(`${endDate}T23:59:59.999Z`);
  return Number.isFinite(parsedEndDate.getTime()) && parsedEndDate.getTime() < Date.now();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidDateParts(year: number, month: number, day: number) {
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function inferRequirements(rawPost: RawPost) {
  const text = `${rawPost.description} ${rawPost.full_text ?? ''}`.toLowerCase();
  const requirements: string[] = [];

  if (text.includes('follow')) requirements.push('follow');
  if (text.includes('comment')) requirements.push('comment');
  if (text.includes('tag')) requirements.push('tag_friends');
  if (text.includes('like')) requirements.push('like');

  return requirements;
}

function inferWinnerCount(rawPost: RawPost) {
  const text = `${rawPost.description} ${rawPost.full_text ?? ''}`;
  const match = text.match(/(\d+)\s+winners?/i);
  return match?.[1] ? Number(match[1]) : 1;
}
