import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(501).json({
    error: "Screenshot capture is not available on the hosted version. Use Add > Image to upload a screenshot instead.",
  });
}
