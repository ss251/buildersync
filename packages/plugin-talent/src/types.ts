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

export interface PassportCredential {
  earned_at: string;
  id: string;
  category: string;
  last_calculated_at: string;
  name: string;
  score: number;
  type: string;
  value: string;
  max_score: number;
}

export interface TalentPassport {
  score: number;
  passport_id: number;
  verified: boolean;
  activity_score: number;
  identity_score: number;
  skills_score: number;
  human_checkmark: boolean;
  main_wallet: string;
  passport_profile: PassportProfile;
  passport_socials: PassportSocial[];
  verified_wallets: string[];
  credentials?: PassportCredential[];
}

export interface PassportsResponse {
  passports: TalentPassport[];
  pagination: {
    current_page: number;
    last_page: number;
    total: number;
  };
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
