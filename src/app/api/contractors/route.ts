import { loadLeaderboard } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jurisdiction = new URL(req.url).searchParams.get("jurisdiction") ?? "";
  if (!jurisdiction.trim()) return Response.json({ error: "jurisdiction is required." }, { status: 400 });
  try {
    const leaderboard = await loadLeaderboard(jurisdiction);
    return Response.json({ jurisdiction, leaderboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return a leaderboard.";
    return Response.json({ error: message }, { status: 502 });
  }
}
