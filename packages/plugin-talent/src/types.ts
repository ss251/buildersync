export interface TalentAPIConfig {
  apiKey: string;
  baseUrl: string;
}

export interface PassportProfile {
  image_url: string;
  name: string;
  bio: string;
  display_name: string;
  location: string | null;
  tags: string[];
}

export interface PassportSocial {
  profile_name: string;
  source: string;
}

export interface Passport {
  id: string;
  display_name: string;
  wallet_address: string;
  talent_id?: string;
  bio?: string;
  avatar_url?: string;
  twitter_username?: string;
  github_username?: string;
  lens_handle?: string;
  farcaster_username?: string;
  total_score: number;
  activity_score: number;
  identity_score: number;
  skills_score: number;
}

export interface PassportCredential {
  earned_at: string | null;
  id: string;
  category: 'Activity' | 'Identity' | 'Skills';
  last_calculated_at: string | null;
  max_score: number;
  name: string;
  score: number;
  type: string;
  value: string | null;
  calculating_score?: boolean;
  onchain_at?: string | null;
}

export interface PassportCredentialsResponse {
  passport_credentials: PassportCredential[];
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface BuilderProfile {
  passport: Passport;
  credentials: PassportCredential[];
}

export interface SearchOptions extends PaginationParams {
  name?: string;
  skills?: string[];
  category?: string;
  minScore?: number;
}

export interface TalentPassportProfile {
  display_name: string;
  location?: string;
  bio?: string;
  tags?: string[];
  avatar_url?: string;
  twitter_username?: string;
  github_username?: string;
  lens_handle?: string;
  farcaster_username?: string;
}

export interface TalentPassport {
  id: string;
  passport_id: string;
  wallet_address: string;
  display_name: string;
  score: number;
  activity_score: number;
  identity_score: number;
  skills_score: number;
  human_checkmark?: boolean;
  verified_wallets?: string[];
  main_wallet?: string;
  passport_profile: TalentPassportProfile;
  credentials?: PassportCredential[];
}

export interface PassportsResponse {
  passports: TalentPassport[];
  meta?: {
    total_count: number;
    page: number;
    per_page: number;
  };
}

export interface SinglePassportResponse {
  passport: TalentPassport;
}

export interface BuilderMatchRequest {
  skills: string[];
  location?: string;
  minScore?: number;
}

export interface BuilderMatch {
  builder: TalentPassport;
  matchScore: number;
}
