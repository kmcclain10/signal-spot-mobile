import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

function envOrSandbox() {
  try { return getStripeEnvironment(); } catch { return "live" as const; }
}

export function usePlan() {
  const fn = useServerFn(getMyPlan);
  return useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fn({ data: { environment: envOrSandbox() } }),
    staleTime: 30_000,
  });
}
