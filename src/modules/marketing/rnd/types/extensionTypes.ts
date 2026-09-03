export const VELMORA_RND_SOURCE = 'VELMORA_RND_WEB';
export const VELMORA_RND_EXTENSION = 'VELMORA_RND_EXTENSION';

export type ExtensionCommandType = 
  | 'PING'
  | 'CHECK_INSTAGRAM_LOGIN'
  | 'START_RND_JOB'
  | 'PAUSE_RND_JOB'
  | 'RESUME_RND_JOB'
  | 'STOP_RND_JOB'
  | 'GET_STATUS'
  | 'START_PROFILE_RESEARCH';

export type ExtensionEventType = 
  | 'PONG'
  | 'EXTENSION_READY'
  | 'INSTAGRAM_STATUS'
  | 'LOGIN_REQUIRED'
  | 'LOGIN_DETECTED'
  | 'SCRAPING_STARTED'
  | 'PROFILE_STARTED'
  | 'PROFILE_PROGRESS'
  | 'PROFILE_COMPLETED'
  | 'PROFILE_FAILED'
  | 'JOB_PROGRESS'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED';

export interface ExtensionMessage {
  source: typeof VELMORA_RND_SOURCE;
  id: string;
  type: ExtensionCommandType;
  payload?: any;
}

export interface ExtensionResponse {
  source: typeof VELMORA_RND_EXTENSION;
  id?: string;
  type: ExtensionEventType;
  status?: 'OK' | 'ERROR';
  loggedIn?: boolean;
  error?: string;
  payload?: any;
}

export type ExtensionConnectionState = 'connected' | 'not_detected' | 'error' | 'checking';
export type InstagramSessionState = 'detected' | 'login_required' | 'unavailable' | 'checking';
