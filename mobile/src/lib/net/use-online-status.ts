import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/** True once NetInfo has told us the device is offline (no network, or a network with no internet
 * reachability) — starts optimistic (true = "online") since NetInfo's first snapshot is
 * asynchronous and briefly null on cold start, and flashing an offline banner on every launch
 * before the real state arrives would be worse than the rare case of a half-second of silence on
 * an already-offline launch. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, []);

  return isOnline;
}
