declare module "zipcodes" {
  export interface ZipCodeRecord {
    zip: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
  }

  export function lookup(zip: string | number): ZipCodeRecord | undefined;
  export function lookupByCoords(latitude: number, longitude: number): ZipCodeRecord | null;
  export function lookupByName(city: string, state: string): ZipCodeRecord[];
  export function radius(zip: string | number, miles: number): string[];
  export function distance(zipA: string | number, zipB: string | number): number | null;

  const zipcodes: {
    lookup: typeof lookup;
    lookupByCoords: typeof lookupByCoords;
    lookupByName: typeof lookupByName;
    radius: typeof radius;
    distance: typeof distance;
  };

  export default zipcodes;
}
