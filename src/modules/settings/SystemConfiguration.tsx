import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import type { SystemSettings, SettingsSectionKey } from '../../types/settings';
import { Building2, Globe, DollarSign, Hash, Bell, Sliders, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const SystemConfiguration: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('company_profile');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
      toast.error('Failed to load system configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSection = async <K extends SettingsSectionKey>(sectionKey: K) => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const sectionData = settings[sectionKey];
      const res = await settingsService.saveSection(sectionKey, sectionData);
      if (res.success) {
        toast.success(`${sectionKey.replace('_', ' ').toUpperCase()} saved successfully!`);
        await loadSettings();
      } else {
        toast.error(res.error || 'Failed to save settings');
      }
    } catch (err: any) {
      toast.error('Error saving settings section');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center items-center py-16 text-muted gap-2">
        <RefreshCw className="animate-spin" size={20} />
        <span>Loading System Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Header Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveSection('company_profile')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'company_profile' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 size={14} /> Company Profile
        </button>

        <button
          onClick={() => setActiveSection('business_preferences')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'business_preferences' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe size={14} /> Business Preferences
        </button>

        <button
          onClick={() => setActiveSection('financial_settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'financial_settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign size={14} /> Financial Settings
        </button>

        <button
          onClick={() => setActiveSection('numbering_sequences')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'numbering_sequences' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hash size={14} /> Numbering Sequences
        </button>

        <button
          onClick={() => setActiveSection('notification_preferences')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'notification_preferences' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bell size={14} /> Notification Preferences
        </button>

        <button
          onClick={() => setActiveSection('application_preferences')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'application_preferences' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders size={14} /> Application Preferences
        </button>
      </div>

      {/* Independent Section Panels */}

      {/* 1. Company Profile */}
      {activeSection === 'company_profile' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Company Profile</h3>
              <p className="text-xs text-muted">Branding, address, and legal tax identifiers.</p>
            </div>
            <button
              onClick={() => handleSaveSection('company_profile')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Company Name</label>
              <input
                type="text"
                value={settings.company_profile.company_name}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, company_name: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Logo URL (Reference)</label>
              <input
                type="text"
                placeholder="https://domain.com/logo.png"
                value={settings.company_profile.logo_url}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, logo_url: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                value={settings.company_profile.email}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, email: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={settings.company_profile.phone}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, phone: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Website URL</label>
              <input
                type="text"
                value={settings.company_profile.website}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, website: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">GST Number</label>
              <input
                type="text"
                value={settings.company_profile.gst_number}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, gst_number: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500 font-mono uppercase"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Physical Address</label>
              <textarea
                rows={2}
                value={settings.company_profile.address}
                onChange={e => setSettings({
                  ...settings,
                  company_profile: { ...settings.company_profile, address: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Business Preferences */}
      {activeSection === 'business_preferences' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Business Preferences</h3>
              <p className="text-xs text-muted">Locale, timezone, currency, and default operational mappings.</p>
            </div>
            <button
              onClick={() => handleSaveSection('business_preferences')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Default Currency</label>
              <select
                value={settings.business_preferences.currency}
                onChange={e => setSettings({
                  ...settings,
                  business_preferences: { ...settings.business_preferences, currency: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              >
                <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                <option value="USD ($)">USD ($) - US Dollar</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Timezone</label>
              <select
                value={settings.business_preferences.timezone}
                onChange={e => setSettings({
                  ...settings,
                  business_preferences: { ...settings.business_preferences, timezone: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              >
                <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York (EST)">America/New_York (EST)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Date Format</label>
              <select
                value={settings.business_preferences.date_format}
                onChange={e => setSettings({
                  ...settings,
                  business_preferences: { ...settings.business_preferences, date_format: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-20)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 20/07/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/20/2026)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Application Language</label>
              <input
                type="text"
                value={settings.business_preferences.language}
                onChange={e => setSettings({
                  ...settings,
                  business_preferences: { ...settings.business_preferences, language: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Financial Settings */}
      {activeSection === 'financial_settings' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Financial Settings</h3>
              <p className="text-xs text-muted">Tax rates, financial year definitions, and payment defaults.</p>
            </div>
            <button
              onClick={() => handleSaveSection('financial_settings')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save Financial Settings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Financial Year</label>
              <input
                type="text"
                value={settings.financial_settings.financial_year}
                onChange={e => setSettings({
                  ...settings,
                  financial_settings: { ...settings.financial_settings, financial_year: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Default Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.financial_settings.default_tax_percentage}
                onChange={e => setSettings({
                  ...settings,
                  financial_settings: { ...settings.financial_settings, default_tax_percentage: Number(e.target.value) }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Default Payment Terms</label>
              <input
                type="text"
                value={settings.financial_settings.default_payment_terms}
                onChange={e => setSettings({
                  ...settings,
                  financial_settings: { ...settings.financial_settings, default_payment_terms: e.target.value }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Numbering Sequences */}
      {activeSection === 'numbering_sequences' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Numbering Sequences</h3>
              <p className="text-xs text-muted">Atomic auto-increment prefixes and start numbers for record generation.</p>
            </div>
            <button
              onClick={() => handleSaveSection('numbering_sequences')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save Sequences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {Object.keys(settings.numbering_sequences).map((key) => {
              const seqKey = key as keyof NumberingSequences;
              const seq = settings.numbering_sequences[seqKey];

              return (
                <div key={key} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                  <div className="font-bold text-indigo-400 capitalize">{key.replace('_', ' ')} Sequence</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Prefix</label>
                      <input
                        type="text"
                        value={seq.prefix}
                        onChange={e => setSettings({
                          ...settings,
                          numbering_sequences: {
                            ...settings.numbering_sequences,
                            [seqKey]: { ...seq, prefix: e.target.value }
                          }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-main focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Current Number</label>
                      <input
                        type="number"
                        value={seq.current_number}
                        onChange={e => setSettings({
                          ...settings,
                          numbering_sequences: {
                            ...settings.numbering_sequences,
                            [seqKey]: { ...seq, current_number: Number(e.target.value) }
                          }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-main focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Notification Preferences */}
      {activeSection === 'notification_preferences' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Notification Preferences</h3>
              <p className="text-xs text-muted">Enable or disable module-level event notifications.</p>
            </div>
            <button
              onClick={() => handleSaveSection('notification_preferences')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save Notification Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {Object.keys(settings.notification_preferences).map((key) => {
              const notifKey = key as keyof SystemSettings['notification_preferences'];
              const isEnabled = settings.notification_preferences[notifKey];

              return (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <span className="font-semibold text-main capitalize">{key.replace('_', ' ')}</span>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={e => setSettings({
                      ...settings,
                      notification_preferences: {
                        ...settings.notification_preferences,
                        [notifKey]: e.target.checked
                      }
                    })}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Application Preferences */}
      {activeSection === 'application_preferences' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-main">Application Preferences</h3>
              <p className="text-xs text-muted">Session timeout, default landing page, and system theme.</p>
            </div>
            <button
              onClick={() => handleSaveSection('application_preferences')}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} /> Save App Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Session Timeout (Minutes)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={settings.application_preferences.session_timeout_minutes}
                onChange={e => setSettings({
                  ...settings,
                  application_preferences: {
                    ...settings.application_preferences,
                    session_timeout_minutes: Number(e.target.value)
                  }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Default Landing Page</label>
              <input
                type="text"
                value={settings.application_preferences.default_landing_page}
                onChange={e => setSettings({
                  ...settings,
                  application_preferences: {
                    ...settings.application_preferences,
                    default_landing_page: e.target.value
                  }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
