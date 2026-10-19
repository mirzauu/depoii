import { loadPermitCities } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadPermitCities();
    return Response.json({ total_cities: data.totalCities, cities: data.cities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return cities.";
    return Response.json({ error: message }, { status: 502 });
  }
}
