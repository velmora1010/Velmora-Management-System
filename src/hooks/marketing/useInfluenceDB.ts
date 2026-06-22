import { useState, useEffect } from 'react';
import type { LocalInfluencer } from '../../types';

export const useInfluenceDB = () => {
  const [influencers, setInfluencers] = useState<LocalInfluencer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const data = localStorage.getItem('influencerDBData');
        if (data) {
          setInfluencers(JSON.parse(data));
        }
      } catch (e) {
        console.error('Failed to load influencerDBData:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const saveInfluencer = (influencer: LocalInfluencer) => {
    const updated = [...influencers, influencer];
    setInfluencers(updated);
    localStorage.setItem('influencerDBData', JSON.stringify(updated));
  };

  const deleteInfluencer = (id: number) => {
    const updated = influencers.filter((inf) => inf.id !== id);
    setInfluencers(updated);
    localStorage.setItem('influencerDBData', JSON.stringify(updated));
  };

  return {
    influencers,
    isLoading,
    saveInfluencer,
    deleteInfluencer,
  };
};
