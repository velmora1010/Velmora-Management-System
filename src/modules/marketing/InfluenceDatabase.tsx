import React, { useState } from 'react';
import { useInfluenceDB } from '../../hooks/marketing/useInfluenceDB';
import type { LocalInfluencer, LocalInfluencerPlatform } from '../../types';
import { ArrowLeft, Users, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface InfluenceDatabaseProps {
  onBack: () => void;
}

const JUSTMIXX_PRODUCTS = [
  "Magic Complete Care Combo",
  "DIY Complete Care Combo",
  "Magic Home Care Combo",
  "DIY Laundry Combo",
  "Magic Sponge Combo",
  "DIY Home Care Combo",
  "DIY Detergent Combo",
  "DIY Dishwash Combo",
  "Magic Sponge",
  "DIY Detergent Liquid",
  "DIY Dishwash Liquid",
  "DIY Fabric Conditioner"
];

const PLATFORMS_MAP: Record<string, string[]> = {
  "All": ["Instagram", "Youtube", "Facebook"],
  "Instagram": ["Instagram"],
  "Youtube": ["Youtube"],
  "Facebook": ["Facebook"],
  "Instagram and Youtube": ["Instagram", "Youtube"],
  "Instagram and Facebook": ["Instagram", "Facebook"],
  "Youtube and Facebook": ["Youtube", "Facebook"],
};

export const InfluenceDatabase: React.FC<InfluenceDatabaseProps> = ({ onBack }) => {
  const { influencers, saveInfluencer } = useInfluenceDB();
  const [view, setView] = useState<'default' | 'form' | 'list'>('default');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    payment: '',
    brand: '',
    product: '',
    phone: '',
    altPhone: '',
    upi: '',
    city: '',
    state: '',
    language: '',
    address: '',
    platformAvail: '',
    postedIn: ''
  });

  const [availPlatformsData, setAvailPlatformsData] = useState<Record<string, LocalInfluencerPlatform>>({});
  const [postedPlatformsData, setPostedPlatformsData] = useState<Record<string, LocalInfluencerPlatform>>({});

  const handlePlatformChange = (type: 'avail' | 'posted', value: string) => {
    setFormData(prev => ({ ...prev, [type === 'avail' ? 'platformAvail' : 'postedIn']: value }));
    const platforms = PLATFORMS_MAP[value] || [];
    
    if (type === 'avail') {
      const newAvail: Record<string, LocalInfluencerPlatform> = {};
      platforms.forEach(p => {
        newAvail[p] = availPlatformsData[p] || { platform: p, username: '', link: '', count: 0 };
      });
      setAvailPlatformsData(newAvail);
    } else {
      const newPosted: Record<string, LocalInfluencerPlatform> = {};
      platforms.forEach(p => {
        newPosted[p] = postedPlatformsData[p] || { platform: p, username: '', link: '', count: 0 };
      });
      setPostedPlatformsData(newPosted);
    }
  };

  const handlePlatformDataChange = (type: 'avail' | 'posted', platform: string, field: keyof LocalInfluencerPlatform, value: string | number) => {
    if (type === 'avail') {
      setAvailPlatformsData(prev => ({
        ...prev,
        [platform]: { ...prev[platform], [field]: value }
      }));
    } else {
      setPostedPlatformsData(prev => ({
        ...prev,
        [platform]: { ...prev[platform], [field]: value }
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.brand) {
      toast.error("Please enter User Name and Brand.");
      return;
    }

    const newInfluencer: LocalInfluencer = {
      id: Date.now(),
      name: formData.name,
      handle: formData.handle,
      payment: formData.payment,
      brand: formData.brand,
      product: formData.product,
      contact: {
        phone: formData.phone,
        altPhone: formData.altPhone,
        upi: formData.upi,
        city: formData.city,
        state: formData.state,
        language: formData.language,
        address: formData.address
      },
      availability: Object.values(availPlatformsData),
      performance: Object.values(postedPlatformsData),
      createdAt: new Date().toISOString()
    };

    saveInfluencer(newInfluencer);
    setView('default');
    
    // Reset form
    setFormData({
      name: '', handle: '', payment: '', brand: '', product: '',
      phone: '', altPhone: '', upi: '', city: '', state: '', language: '', address: '',
      platformAvail: '', postedIn: ''
    });
    setAvailPlatformsData({});
    setPostedPlatformsData({});
  };

  return (
    <div className="p-6 text-slate-200">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-100">Influence Data Base</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Marketing
          </button>
          <button onClick={() => setView('form')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2">
            <Plus size={16} /> Add Influencer
          </button>
          <button onClick={() => setView('list')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2">
            <Users size={16} /> Influencer List
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 min-h-[50vh]">
        {view === 'default' && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="text-xl font-semibold mb-2 text-slate-200">Influence Data Base</h3>
            <p>Select an action to manage influencer records.</p>
          </div>
        )}

        {view === 'list' && (
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Saved Influencers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-4 font-medium">User Name</th>
                    <th className="p-4 font-medium">Brand</th>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Payment</th>
                    <th className="p-4 font-medium">City</th>
                  </tr>
                </thead>
                <tbody>
                  {influencers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No influencers saved yet.
                      </td>
                    </tr>
                  ) : (
                    influencers.map(inf => (
                      <tr key={inf.id} className="border-b border-slate-800/50 hover:bg-slate-800/80 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-slate-200">{inf.name}</div>
                          <div className="text-xs text-slate-500">{inf.handle}</div>
                        </td>
                        <td className="p-4 text-slate-300">{inf.brand}</td>
                        <td className="p-4 text-slate-300">{inf.product || '-'}</td>
                        <td className="p-4 text-slate-300">₹{inf.payment || '0'}</td>
                        <td className="p-4 text-slate-300">{inf.contact.city || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'form' && (
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Add New Influencer</h3>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Section 1: Basic Details */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <h4 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Basic Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">User Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter user name" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Influencer Name</label>
                    <input type="text" value={formData.handle} onChange={e => setFormData({...formData, handle: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter handle/name" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Payment Agreed</label>
                    <input type="number" value={formData.payment} onChange={e => setFormData({...formData, payment: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter amount" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Brand</label>
                    <select value={formData.brand} onChange={e => {
                      setFormData({...formData, brand: e.target.value, product: ''});
                    }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500">
                      <option value="">Select Brand</option>
                      <option value="Justmixx">Justmixx</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Product</label>
                    <select value={formData.product} disabled={formData.brand !== 'Justmixx'} onChange={e => setFormData({...formData, product: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500 disabled:opacity-50">
                      <option value="">{formData.brand === 'Justmixx' ? 'Select Product' : 'Select Brand First'}</option>
                      {formData.brand === 'Justmixx' && JUSTMIXX_PRODUCTS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Details */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <h4 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Contact Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter phone" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Alternative Number</label>
                    <input type="tel" value={formData.altPhone} onChange={e => setFormData({...formData, altPhone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter alt phone" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">UPI Number</label>
                    <input type="text" value={formData.upi} onChange={e => setFormData({...formData, upi: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter UPI" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">City</label>
                    <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter city" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">State</label>
                    <input type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter state" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Language</label>
                    <input type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter language" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Complete Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500" placeholder="Enter full address" />
                </div>
              </div>

              {/* Section 3: Platform Availability */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <h4 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Platform Availability (Followers)</h4>
                <div className="w-full md:w-1/3 mb-6">
                  <label className="block text-sm text-slate-400 mb-1">Selected Platforms</label>
                  <select value={formData.platformAvail} onChange={e => handlePlatformChange('avail', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500">
                    <option value="">Select Platforms</option>
                    {Object.keys(PLATFORMS_MAP).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-4">
                  {Object.values(availPlatformsData).map(plat => (
                    <div key={plat.platform} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="font-semibold text-slate-200 mb-4">{plat.platform} Availability</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Username</label>
                          <input type="text" value={plat.username} onChange={e => handlePlatformDataChange('avail', plat.platform, 'username', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Username" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Link</label>
                          <input type="url" value={plat.link} onChange={e => handlePlatformDataChange('avail', plat.platform, 'link', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Link" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Followers Count</label>
                          <input type="number" value={plat.count || ''} onChange={e => handlePlatformDataChange('avail', plat.platform, 'count', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Count" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Posted In */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                <h4 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Posted In (Views)</h4>
                <div className="w-full md:w-1/3 mb-6">
                  <label className="block text-sm text-slate-400 mb-1">Selected Platforms</label>
                  <select value={formData.postedIn} onChange={e => handlePlatformChange('posted', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500">
                    <option value="">Select Platforms</option>
                    {Object.keys(PLATFORMS_MAP).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-4">
                  {Object.values(postedPlatformsData).map(plat => (
                    <div key={plat.platform} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="font-semibold text-slate-200 mb-4">{plat.platform} Performance</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Username</label>
                          <input type="text" value={plat.username} onChange={e => handlePlatformDataChange('posted', plat.platform, 'username', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Username" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Link</label>
                          <input type="url" value={plat.link} onChange={e => handlePlatformDataChange('posted', plat.platform, 'link', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Link" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Views Count</label>
                          <input type="number" value={plat.count || ''} onChange={e => handlePlatformDataChange('posted', plat.platform, 'count', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200" placeholder="Count" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setView('default')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium">
                  <Check size={18} /> Save Influencer
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
};
