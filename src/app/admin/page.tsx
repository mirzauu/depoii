"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ActivityTable, adminFetch, type ActivityItem } from "@/components/admin-ui";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Overview = {
  orgs: number;
  users: number;
  leads: number;
  outcomes: number;
  activity: ActivityItem[];
};

export default function AdminHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<Overview>("/api/admin/overview")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const counts = [
    ["Organizations", data?.orgs],
    ["Users", data?.users],
    ["Leads", data?.leads],
    ["Field outcomes", data?.outcomes],
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Super Admin"
        description="Every organization, its users, and the work they record. Accounts can be suspended. Nothing here is deleted."
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      {!data && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading the platform…</p>}
      {data && (
        <>
          <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {counts.map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-3xl">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <h2 className="px-4 text-sm font-medium lg:px-8">Recent activity</h2>
          <ActivityTable rows={data.activity} />
        </>
      )}
    </div>
  );
}
