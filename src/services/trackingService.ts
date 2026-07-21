export const trackingService = {
  async syncTracking(awb: string, courier: string) {
    try {
      console.log('Initiating tracking sync request:', {
        url: '/api/track',
        method: 'POST',
        awbNumber: awb,
        courier
      });

      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courier,
          awbNumber: awb
        })
      });

      console.log('Received response headers:', {
        url: '/api/track',
        httpStatus: response.status,
        awbNumber: awb,
        courier
      });

      if (response.status === 404) {
        throw new Error('Local dev server 404: Scraper proxy endpoint not running. Run via Vercel CLI (vercel dev) or deploy.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch tracking: status ${response.status} (${response.statusText})`);
      }

      const data = await response.json();
      console.log('Full API response payload:', data);
      return data;
    } catch (err: any) {
      console.error('Tracking sync failed with exception:', {
        url: '/api/track',
        awbNumber: awb,
        courier,
        errorMessage: err.message || String(err)
      });
      
      return {
        success: false,
        status: 'Unable to fetch',
        error: err.message || String(err),
        lastSyncedAt: new Date().toLocaleString()
      };
    }
  }
};
