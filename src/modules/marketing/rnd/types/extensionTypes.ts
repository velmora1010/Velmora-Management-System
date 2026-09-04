export const VELMORA_RND_SOURCE = 'VELMORA_RND_WEB';
export const VELMORA_RND_EXTENSION = 'VELMORA_RND_EXTENSION';

export type ExtensionCommandType = 
  | 'PING'
  | 'GET_EXTENSION_STATUS'
  | 'CHECK_INSTAGRAM_LOGIN'
  | 'CHECK_INSTAGRAM_SESSION'
  | 'CHECK_INSTAGRAM_TAB'
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
  | 'PROFILE_OPENING'
  | 'PROFILE_VERIFYING'
  | 'PROFILE_DATA_FOUND'
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

export interface ExtensionStatusResponse {
  type: 'PONG';
  status: 'OK' | 'ERROR';
  extensionVersion?: string;
  timestamp?: number;
  error?: string;
}

export interface InstagramStatusResponse {
  type: 'INSTAGRAM_STATUS';
  available: boolean;
  session: 'detected' | 'login_required' | 'unknown';
  tabId?: number;
  error?: string;
}

export interface ExtensionResponse {
  source: typeof VELMORA_RND_EXTENSION;
  id?: string;
  type: ExtensionEventType;
  status?: 'OK' | 'ERROR';
  loggedIn?: boolean;
  available?: boolean;
  session?: 'detected' | 'login_required' | 'unknown';
  tabId?: number;
  extensionVersion?: string;
  timestamp?: number;
  error?: string;
  payload?: any;
}

export type ExtensionConnectionState = 'NOT_DETECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type InstagramSessionState = 'NOT_AVAILABLE' | 'LOGIN_REQUIRED' | 'SESSION_DETECTED' | 'SESSION_INVALID' | 'CHECKING';
