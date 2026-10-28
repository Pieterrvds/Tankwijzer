/** Tankwijzer API on Netlify: every /api/* request goes to the Hono app in services/api. */
import { handleApiRequest } from "../dist/server.mjs";

export default (req: Request) => handleApiRequest(req);

export const config = {
  path: "/api/*",
};
