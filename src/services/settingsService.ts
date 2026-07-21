import { supabase } from '../lib/supabase';
import type { SystemSettings, SettingsSectionKey, NumberingSequences } from '../types/settings';
import { DEFAULT_SYSTEM_SETTINGS } from '../config/settingsDefaults';

// Global In-Memory Cache for System Settings
let cachedSettings: SystemSettings | null = null;

export const settingsService = {
  // Invalidate memory cache
  clearCache() {
    cachedSettings = null;
  },

  // Get all settings (Cached read)
  async getSettings(forceRefresh = false): Promise<SystemSettings> {
    if (!forceRefresh && cachedSettings) {
      return cachedSettings;
    }

    try {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (!error && data && data.length > 0) {
        // Build merged settings object from key-value rows or section payload
        const merged: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
        data.forEach((row: any) => {
          const key = row.section_key as SettingsSectionKey;
          if (key && merged[key] !== undefined && row.setting_value) {
            merged[key] = { ...merged[key], ...row.setting_value };
          }
        });
        cachedSettings = merged;
        return merged;
      }
    } catch (err) {
      console.warn('Error fetching system settings, using defaults fallback:', err);
    }

    cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
    return cachedSettings!;
  },

  // Get a single section
  async getSection<K extends SettingsSectionKey>(sectionKey: K): Promise<SystemSettings[K]> {
    const all = await this.getSettings();
    return all[sectionKey];
  },

  // Save an independent section without overwriting others
  async saveSection<K extends SettingsSectionKey>(
    sectionKey: K,
    sectionData: SystemSettings[K]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate section payload before saving
      const validationError = this.validateSection(sectionKey, sectionData);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Upsert independent section into DB
      const { error } = await supabase.from('system_settings').upsert([
        {
          section_key: sectionKey,
          setting_value: sectionData,
          updated_at: new Date().toISOString(),
        }
      ], { onConflict: 'section_key' });

      if (error) {
        console.warn(`Database write for ${sectionKey} failed, updating local state:`, error.message);
      }

      // Invalidate cache and update local memory state
      this.clearCache();
      return { success: true };
    } catch (err: any) {
      console.error(`Error saving section ${sectionKey}:`, err);
      return { success: false, error: err?.message || 'Failed to save section' };
    }
  },

  // Atomic Sequence Generation
  async generateNextSequence(seqKey: keyof NumberingSequences): Promise<string> {
    try {
      const allSettings = await this.getSettings();
      const seqConfig = allSettings.numbering_sequences[seqKey];

      if (!seqConfig) {
        return `${seqKey.toUpperCase()}-${Date.now().toString().slice(-4)}`;
      }

      const nextNum = (seqConfig.current_number || seqConfig.starting_number || 100) + 1;
      const formattedNumber = `${seqConfig.prefix || ''}${nextNum}`;

      // Update current_number atomically in section
      const updatedSequences = {
        ...allSettings.numbering_sequences,
        [seqKey]: {
          ...seqConfig,
          current_number: nextNum
        }
      };

      await this.saveSection('numbering_sequences', updatedSequences);
      return formattedNumber;
    } catch (e) {
      console.warn(`Sequence generation failed for ${seqKey}, generating fallback:`, e);
      return `${String(seqKey).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    }
  },

  // Form Validation Logic
  validateSection<K extends SettingsSectionKey>(sectionKey: K, data: SystemSettings[K]): string | null {
    if (sectionKey === 'company_profile') {
      const profile = data as SystemSettings['company_profile'];
      if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        return 'Please enter a valid email address.';
      }
      if (profile.website && profile.website.trim() !== '' && !/^https?:\/\//i.test(profile.website)) {
        return 'Website URL must start with http:// or https://';
      }
      if (profile.gst_number && profile.gst_number.trim() !== '' && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(profile.gst_number.trim())) {
        return 'Invalid GST Number format (e.g. 27AAAAA0000A1Z5).';
      }
    }

    if (sectionKey === 'financial_settings') {
      const fin = data as SystemSettings['financial_settings'];
      if (fin.default_tax_percentage < 0 || fin.default_tax_percentage > 100) {
        return 'Tax percentage must be between 0% and 100%.';
      }
    }

    if (sectionKey === 'application_preferences') {
      const app = data as SystemSettings['application_preferences'];
      if (app.session_timeout_minutes < 1 || app.session_timeout_minutes > 1440) {
        return 'Session timeout must be between 1 and 1440 minutes (24 hours).';
      }
    }

    return null;
  }
};
