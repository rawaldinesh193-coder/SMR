/**
 * WebRTC DataChannel Control & Remote Input Protocol
 */

export enum InputControlAction {
  TOUCH_DOWN = 'TOUCH_DOWN',
  TOUCH_MOVE = 'TOUCH_MOVE',
  TOUCH_UP = 'TOUCH_UP',
  SCROLL = 'SCROLL',
  KEY_DOWN = 'KEY_DOWN',
  KEY_UP = 'KEY_UP',
  GLOBAL_ACTION = 'GLOBAL_ACTION',
  CLIPBOARD_SYNC = 'CLIPBOARD_SYNC'
}

export enum AndroidGlobalAction {
  BACK = 'BACK',
  HOME = 'HOME',
  RECENTS = 'RECENTS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  QUICK_SETTINGS = 'QUICK_SETTINGS',
  POWER_DIALOG = 'POWER_DIALOG',
  LOCK_SCREEN = 'LOCK_SCREEN',
  TAKE_SCREENSHOT = 'TAKE_SCREENSHOT'
}

export interface TouchInputPayload {
  action: InputControlAction.TOUCH_DOWN | InputControlAction.TOUCH_MOVE | InputControlAction.TOUCH_UP;
  pointerId: number;
  /** Normalized X coordinate between 0.0 and 1.0 */
  normalizedX: number;
  /** Normalized Y coordinate between 0.0 and 1.0 */
  normalizedY: number;
  pressure?: number;
  timestamp: number;
}

export interface ScrollInputPayload {
  action: InputControlAction.SCROLL;
  normalizedX: number;
  normalizedY: number;
  deltaX: number;
  deltaY: number;
  timestamp: number;
}

export interface KeyInputPayload {
  action: InputControlAction.KEY_DOWN | InputControlAction.KEY_UP;
  keyCode: number; // Android KeyEvent keycode or ASCII key
  character?: string;
  isShiftPressed?: boolean;
  isCtrlPressed?: boolean;
  isAltPressed?: boolean;
  timestamp: number;
}

export interface GlobalActionPayload {
  action: InputControlAction.GLOBAL_ACTION;
  globalAction: AndroidGlobalAction;
  timestamp: number;
}

export interface ClipboardSyncPayload {
  action: InputControlAction.CLIPBOARD_SYNC;
  text: string;
  timestamp: number;
}

export interface DataChannelMessageHeader {
  messageId: string;
  sequenceNumber: number;
  protocolVersion: string;
  timestamp: number;
}

export type DataChannelPayload =
  | TouchInputPayload
  | ScrollInputPayload
  | KeyInputPayload
  | GlobalActionPayload
  | ClipboardSyncPayload;

export interface DataChannelPacket {
  header: DataChannelMessageHeader;
  payload: DataChannelPayload;
}
