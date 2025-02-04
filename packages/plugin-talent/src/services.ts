import axios, { AxiosInstance } from 'axios';
import { TalentAPIConfig, TalentPassport, PassportsResponse } from './types';
import { PassportCredential, PassportCredentialsResponse, PaginationParams, SearchOptions } from './types';
import { getConfig } from './environment';

export class TalentService {
  private config: TalentAPIConfig;
  private client: AxiosInstance;

  constructor(runtime: any) {
    try {
      this.config = getConfig(runtime);
      this.client = axios.create({
        baseURL: this.config.baseUrl,
        headers: {
          'X-API-KEY': this.config.apiKey,
          'Accept': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to initialize TalentService:', error);
      throw error;
    }
  }

  async getPassport(identifier: string): Promise<TalentPassport> {
    try {
      // First try to get directly if it's an address
      const isAddress = identifier.startsWith('0x');
      
      if (isAddress) {
        try {
          const response = await this.client.get(`/api/v2/passports/${identifier}`);
          if (response.data?.passport) {
            return response.data.passport;
          }
        } catch (e) {
          if (e.response?.status !== 404) throw e;
          // If 404, fall through to keyword search
        }
      }

      // Search by display name
      const searchResponse = await this.client.get<PassportsResponse>('/api/v2/passports', {
        params: {
          keyword: identifier,
          per_page: 10
        }
      });

      const matchingPassport = searchResponse.data?.passports?.find(p => 
        p.passport_profile.display_name?.toLowerCase() === identifier.toLowerCase()
      );

      if (matchingPassport) {
        return matchingPassport;
      }

      throw new Error(`Builder "${identifier}" not found`);
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check your API key');
      }
      if (error.response?.status === 404) {
        throw new Error(`Builder "${identifier}" not found`);
      }
      throw error;
    }
  }

  async getPassportCredentials(passportId: string): Promise<PassportCredential[]> {
    try {
      const response = await this.client.get<PassportCredentialsResponse>('/api/v2/passport_credentials', {
        params: { passport_id: passportId }
      });
      return response.data.passport_credentials;
    } catch (error) {
      console.error('Failed to fetch passport credentials:', error);
      throw error;
    }
  }

  async searchBuilders(options: SearchOptions | string): Promise<TalentPassport[]> {
    try {
      // Handle string query for backward compatibility
      const searchOptions: SearchOptions = typeof options === 'string' ? { name: options } : options;

      // Clean up the search query if it's a name search
      if (searchOptions.name) {
        // Extract name after "for" or "of" if present
        const match = searchOptions.name.match(/(?:for|of)\s+([^\s]+)/i);
        searchOptions.name = (match ? match[1] : searchOptions.name).trim();
      }

      const response = await this.client.get<PassportsResponse>('/api/v2/passports', {
        params: {
          keyword: searchOptions.name,
          page: searchOptions.page || 1,
          per_page: searchOptions.per_page || 10
        }
      });

      let passports = response.data.passports;

      // Apply additional filters if specified
      if (searchOptions.skills?.length) {
        passports = passports.filter(p => 
          p.passport_profile.tags?.some(tag => 
            searchOptions.skills!.some(skill => 
              tag.toLowerCase().includes(skill.toLowerCase())
            )
          )
        );
      }

      if (searchOptions.minScore) {
        passports = passports.filter(p => (p.score || 0) >= searchOptions.minScore!);
      }

      // Sort by score descending
      return passports.sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch (error) {
      console.error('Search builders error:', error);
      throw error;
    }
  }

  async getTopBuilders(limit: number = 50): Promise<TalentPassport[]> {
    console.log('Getting top builders, limit:', limit);
    try {
      console.log('Base URL:', this.config.baseUrl);
      console.log('Full URL:', `${this.config.baseUrl}/api/v2/passports`);
      console.log('Headers:', {
        'X-API-KEY': this.config.apiKey ? 'present' : 'missing',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });

      const response = await this.client.get<PassportsResponse>('/api/v2/passports', {
        params: {
          per_page: 100,
          page: 1
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      if (response.headers['content-type']?.includes('text/html')) {
        throw new Error('Authentication failed - please check your API key');
      }

      if (!response.data?.passports) {
        throw new Error(`Invalid API response format: ${JSON.stringify(response.data)}`);
      }

      // Sort by score descending and take top N
      return response.data.passports
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    } catch (error) {
      if (error.response) {
        console.error('API Error Details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.response.config.url,
            baseURL: error.response.config.baseURL,
            method: error.response.config.method,
            headers: error.response.config.headers
          }
        });
      }
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check your API key');
      }
      if (error.response?.status === 404) {
        throw new Error(`Invalid API endpoint: ${error.response.config.baseURL}${error.response.config.url}`);
      }
      console.error('Top Builders API error:', error);
      throw error;
    }
  }

  async getBuildersByLocation(location: string): Promise<TalentPassport[]> {
    return this.searchBuilders(location);
  }
}
