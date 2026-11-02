"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { ParcelDossierView } from "@/components/parcel-dossier-view";

export default function ParcelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const stormParam = searchParams.get("storm") || "";
  const parcelId = decodeURIComponent(id);

  return (
    <ParcelDossierView
      parcelId={parcelId}
      stormId={stormParam}
      fromParam={fromParam}
    />
  );
}
