import { requireUser } from "@/lib/auth";
import { accountCard, stormCard } from "@/lib/intelligence";
import { canOrgAccessParcel } from "@/lib/territories";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const account = url.searchParams.get("account");
    const storm = url.searchParams.get("storm");
    if (!account && !storm) {
      return Response.json({ error: "Pass account or storm." }, { status: 400 });
    }

    if (account && user.platformRole !== "superadmin") {
      const access = await canOrgAccessParcel(user.orgId, account, false);
      if (!access.allowed) {
        return Response.json(
          { error: access.reason || "This property is in a territory outside your subscription." },
          { status: 403 }
        );
      }
    }

    const body = account ? await accountCard(account, storm ?? undefined) : await stormCard(storm!, user);
    if (!body) return Response.json({ error: "Nothing stored for that query yet. Open the app so a live pull can write the record." }, { status: 404 });
    return Response.json(body);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Authentication required";
    const status = msg.toLowerCase().includes("sign in") || msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
