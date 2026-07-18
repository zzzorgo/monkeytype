import { queryOptions } from "@tanstack/solid-query";

import Ape from "../ape";
import { queryClient } from ".";
import { baseKey } from "./utils/keys";

const queryKey = () => [...baseKey("typingStats", { isUserSpecific: true })];

// oxlint-disable-next-line typescript/explicit-function-return-type
export const getUserStatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKey(),
    queryFn: async () => {
      const response = await Ape.users.getStats();
      if (response.status !== 200) {
        throw new Error(`Failed to load personal stats: ${response.body.message}`);
      }
      return response.body.data;
    },
  });

export async function invalidateUserStats(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKey() });
}
