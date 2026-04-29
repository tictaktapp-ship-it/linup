import { invoke } from '@tauri-apps/api/core';
import { createContext, useContext } from 'react';

interface ConnectivityStatus {
  online: boolean;
  last_checked_at: string;
}

export interface ConnectivityContextValue {
  isOnline: boolean;
  lastChecked: string;
}

export const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  lastChecked: '',
});

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export async function fetchConnectivityStatus(): Promise<ConnectivityContextValue> {
  try {
    const status = await invoke<ConnectivityStatus>('get_connectivity_status');
    return { isOnline: status.online, lastChecked: status.last_checked_at };
  } catch {
    return { isOnline: false, lastChecked: new Date().toISOString() };
  }
}