export interface RawPost {
  platform: string;
  title: string;
  description: string;
  url: string;
  organizer: string;
  follower_count?: number;
  is_verified: boolean;
  posted_at: string;
  image_url?: string;
  full_text?: string;
}

export interface ProcessedGiveaway {
  platform: string;
  title: string;
  description: string;
  url: string;
  organizer: string;
  follower_count?: number;
  is_verified: boolean;
  posted_at: string;
  category: string;
  secondary_categories?: string[];
  tags?: string[];
  entry_methods: string[];
  end_date?: string;
  requirements: string[];
  prize_value_chf: number;
  prize_items: string[];
  winner_count: number;
  trust_score: number;
  risk_level: 'low' | 'medium' | 'high';
  scraped_at: string;
}

export interface ValidationResult {
  is_valid?: boolean;
  is_legitimate?: boolean;
  trust_score: number;
  confidence?: number;
  risk_level: 'low' | 'medium' | 'high';
  reason?: string;
  reasoning?: string;
  red_flags?: string[];
  action?: 'approve' | 'reject' | 'review';
}

export interface ExtractedDetails {
  prize: string;
  entry_methods: string[];
  end_date?: string;
  requirements: string[];
}

export interface CategorizationResult {
  primary_category: string;
  secondary_categories: string[];
  tags: string[];
}

export interface ExtractionResult {
  prize_value_chf: number;
  end_date: string | null;
  winner_count: number;
  requirements: string[];
  prize_items: string[];
}

export interface PipelineResult {
  fallbackCount: number;
  rawCount: number;
  processedCount: number;
  savedCount: number;
  skippedCount: number;
  errors: string[];
}
