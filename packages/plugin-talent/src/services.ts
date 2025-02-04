import axios from 'axios';
import { TalentAPIConfig, TalentPassport, PassportsResponse } from './types';

export class TalentService {
  private config: TalentAPIConfig;

  constructor(config: TalentAPIConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, '')
    };
  }

  private get client() {
    return axios.create({
      baseURL: `${this.config.baseUrl}/api`,
      headers: {
        'X-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async getPassport(identifier: string): Promise<TalentPassport> {
    try {
      // Check if identifier is a number (talent ID) or address
      const isAddress = identifier.startsWith('0x');
      const endpoint = `/v2/passports/${identifier}`;
      
      console.log(`Fetching passport from ${endpoint}`);
      const response = await this.client.get(endpoint);
      console.log('Passport API Response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data?.passport) {
        throw new Error('Invalid passport response format');
      }
      return response.data.passport;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check your API key');
      }
      if (error.response?.status === 404) {
        throw new Error('Passport not found');
      }
      console.error('Passport API error:', error);
      throw error;
    }
  }

  async searchBuilders(query: string): Promise<TalentPassport[]> {
    console.log('Searching builders with query:', query);
    try {
      // Get all passports and filter client-side since API doesn't support search
      const response = await this.client.get<PassportsResponse>('/v2/passports', {
        params: { 
          per_page: 40,
          page: 1
        }
      });
      console.log('Search API Response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data?.passports) {
        console.error('Invalid response format:', response.data);
        throw new Error('Invalid response format from search API');
      }
      
      // Client-side filtering based on query
      const query_lower = query.toLowerCase();
      const filtered = response.data.passports.filter(passport => {
        const { display_name, location, bio, tags } = passport.passport_profile;
        return (
          display_name?.toLowerCase().includes(query_lower) ||
          location?.toLowerCase().includes(query_lower) ||
          bio?.toLowerCase().includes(query_lower) ||
          tags?.some(tag => tag.toLowerCase().includes(query_lower))
        );
      });

      // Sort by score descending
      return filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check your API key');
      }
      if (error.response?.status === 404) {
        throw new Error('Invalid API endpoint');
      }
      console.error('Search API error:', error);
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

      const response = await this.client.get<PassportsResponse>('/v2/passports', {
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
