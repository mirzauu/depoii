import { accountCard, stormCard } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account");
  const storm = url.searchParams.get("storm");
  if (!account && !storm) {
    return Response.json({ error: "Pass account or storm." }, { status: 400 });
  }
  const body = account ? accountCard(account, storm ?? undefined) : stormCard(storm!);
  if (!body) return Response.json({ error: "Nothing stored for that query yet. Open the app so a live pull can write the record." }, { status: 404 });
  return Response.json(body);
}
