import { useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && wasOffline.current) {
        onReconnect?.();
      }
      wasOffline.current = !online;
    });
    return () => unsubscribe();
  }, [onReconnect]);

  return isOnline;
}