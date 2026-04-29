import { invoke } from '@tauri-apps/api/core';
import { createContext, useContext, useEffect, useState } from 'react';

interface ConnectivityStatus {
  online: boolean;
  last_checked_at: string;
}

interface ConnectivityContextValue {
  isOnline: boolean;
  lastChecked: string;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  lastChecked: '',
});

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastChecked, setLastChecked] = useState('');

  const check = async () => {
    try {
      const status = await invoke<ConnectivityStatus>('get_connectivity_status');
      setIsOnline(status.online);
      setLastChecked(status.last_checked_at);
    } catch {
      setIsOnline(false);
      setLastChecked(new Date().toISOString());
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, lastChecked }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}