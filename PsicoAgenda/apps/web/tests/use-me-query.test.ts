import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY, ME_STALE_TIME_MS } from "@/lib/use-me-query";

describe("useMeQuery cache", () => {
  it("no dispara múltiples requests dentro del staleTime", async () => {
    const fetchMe = vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.co", name: "Ana", role: "psychologist" });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: ME_STALE_TIME_MS,
          retry: false,
        },
      },
    });

    const options = {
      queryKey: ME_QUERY_KEY,
      queryFn: fetchMe,
      staleTime: ME_STALE_TIME_MS,
    };

    // Dos lecturas consecutivas dentro del periodo de caché.
    const first = await queryClient.fetchQuery(options);
    const second = await queryClient.fetchQuery(options);

    expect(first).toEqual({ id: "user-1", email: "a@b.co", name: "Ana", role: "psychologist" });
    expect(second).toBe(first);
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });
});
