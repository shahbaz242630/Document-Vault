import { useEffect, useState } from "react";
import Purchases from "react-native-purchases";

import { createPurchaseService } from "../purchase-service";

export function usePremiumStatus(): boolean | undefined {
  const [isPremium, setIsPremium] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const service = createPurchaseService(Purchases);
        const result = await service.checkPremiumAccess();
        if (isMounted) setIsPremium(result);
      } catch {
        if (isMounted) setIsPremium(false);
      }
    }

    void check();

    return () => {
      isMounted = false;
    };
  }, []);

  return isPremium;
}
