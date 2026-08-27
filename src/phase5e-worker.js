import phase4Worker from "./phase4-worker.js";
import { syncTvmazeEpisodes } from "./tvmaze.js";

export const TVMAZE_CONVERGENCE_CRON = "47 * * * *";

export default {
  async fetch(request, env, ctx) {
    return phase4Worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === TVMAZE_CONVERGENCE_CRON) {
      if (!env.TMDB_API_TOKEN) {
        console.warn("Hourly TVmaze convergence skipped: TMDB_API_TOKEN is not configured");
        return;
      }

      ctx.waitUntil(
        syncTvmazeEpisodes(env).catch((error) => console.error("Hourly TVmaze convergence failed", error))
      );
      return;
    }

    return phase4Worker.scheduled(controller, env, ctx);
  }
};
