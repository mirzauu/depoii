import type { Parcel, Permit, Provenance } from "@/lib/types";

export interface Archetype {
  label: string;
  provenance: Provenance;
  basis: string;
}

export const ARCHETYPE_DISCLAIMER =
  "Tarrant Appraisal District does not record membrane type. A membrane is shown only when the City of Fort Worth typed it in the permit's work description.";

export function probableArchetype(parcel: Parcel, parcelPermits: Permit[], asOf: string): Archetype {
  const stated = parcelPermits
    .filter((p) => p.membrane)
    .sort((a, b) => b.issued.localeCompare(a.issued))[0];
  if (stated) {
    return {
      label: stated.membrane!,
      provenance: "source-record",
      basis: `Written on permit ${stated.permitNo} (${stated.issued})`,
    };
  }
  if (parcel.roofCover) {
    return {
      label: parcel.roofCover,
      provenance: "source-record",
      basis: `ATTOM building record lists roof cover as ${parcel.roofCover}`,
    };
  }
  return {
    label: "Not stated",
    provenance: "depoii-modeled",
    basis: `No membrane type on the appraisal account for ${parcel.address} or on a matched permit as of ${asOf}`,
  };
}

/** Roof age baseline: last verified re-roof before the reference date, else effective construction year. */
export function roofBaseline(parcel: Parcel, parcelPermits: Permit[], beforeDate: string) {
  const reroof = parcelPermits
    .filter((p) => p.kind === "reroof" && p.issued < beforeDate)
    .sort((a, b) => b.issued.localeCompare(a.issued))[0];
  return reroof
    ? { year: Number(reroof.issued.slice(0, 4)), provenance: "source-record" as Provenance, basis: `Re-roof permit ${reroof.permitNo}` }
    : { year: parcel.yearBuilt, provenance: "source-record" as Provenance, basis: parcel.yearBasis ?? `${parcel.cad} effective year built` };
}
