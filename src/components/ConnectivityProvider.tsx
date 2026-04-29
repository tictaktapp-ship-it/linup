import React, { useEffect, useState } from 'react';
import { ConnectivityContext, fetchConnectivityStatus } from '../stores/connectivity';
import type { ConnectivityContextValue } from '../stores/connectivity';

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<ConnectivityContextValue>({ isOnline: true, lastChecked: '' });

  useEffect(() => {
    const check = async () => setValue(await fetchConnectivityStatus());
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}