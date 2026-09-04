import { 
  ExtensionMessage, 
  ExtensionResponse, 
  VELMORA_RND_SOURCE, 
  VELMORA_RND_EXTENSION,
  ExtensionCommandType
} from '../types/extensionTypes';

class RndExtensionService {
  private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void }> = new Map();

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const data = event.data as ExtensionResponse;
    
    if (data?.source === VELMORA_RND_EXTENSION) {
      // Handle responses to specific requests
      if (data.id && this.pendingRequests.has(data.id)) {
        const promiseControls = this.pendingRequests.get(data.id)!;
        this.pendingRequests.delete(data.id);
        
        if (data.error) {
          promiseControls.reject(new Error(data.error));
        } else {
          promiseControls.resolve(data);
        }
      }
    }
  }

  private sendMessage<T = any>(type: ExtensionCommandType, payload?: any, timeoutMs = 2000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 15);
      
      const message: ExtensionMessage = {
        source: VELMORA_RND_SOURCE,
        id,
        type,
        payload
      };

      this.pendingRequests.set(id, { resolve, reject });
      window.postMessage(message, '*');

      // Cleanup on timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Extension request timeout for ${type}`));
        }
      }, timeoutMs);
    });
  }

  public async getExtensionStatus(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const response = await this.sendMessage('GET_EXTENSION_STATUS', undefined, 1000);
      if (response.type === 'PONG') {
        return { connected: true, version: response.extensionVersion };
      }
      return { connected: false, error: 'Invalid response' };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  public async checkInstagramSession(): Promise<{ available: boolean; session: 'detected' | 'login_required' | 'unknown'; error?: string }> {
    try {
      const response = await this.sendMessage('CHECK_INSTAGRAM_SESSION');
      return {
        available: !!response.available,
        session: response.session || 'unknown',
        error: response.error
      };
    } catch (err: any) {
      return {
        available: false,
        session: 'unknown',
        error: err.message || 'Failed to check Instagram session'
      };
    }
  }

  // Kept for backwards compatibility with any Phase 1/2 remnants if needed
  public async ping(): Promise<boolean> {
    const status = await this.getExtensionStatus();
    return status.connected;
  }

  public async checkInstagramLogin(): Promise<{ loggedIn: boolean; error?: string }> {
    const res = await this.checkInstagramSession();
    return { loggedIn: res.session === 'detected', error: res.error };
  }
}

export const rndExtensionService = new RndExtensionService();
