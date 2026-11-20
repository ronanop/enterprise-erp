/** Native GPS + HRMS office geofence + reverse-geocode for ESS location chip. */

import * as Location from "expo-location";

export type LiveCoords = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

export type WorkLocationFence = {
  location_name: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters?: number | null;
  location_type?: string | null;
  is_home?: boolean;
};

export type LiveLocationOptions = {
  workLocations?: WorkLocationFence[] | null;
  homeOfficeName?: string | null;
};

export async function readLiveCoords(): Promise<LiveCoords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const accuracy = position.coords.accuracy;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters:
        Number.isFinite(accuracy) && accuracy > 0 ? accuracy : undefined,
    };
  } catch {
    return null;
  }
}

/** Read GPS for punch. When `required`, throws if unavailable. */
export async function requestPunchCoords(opts?: {
  required?: boolean;
}): Promise<LiveCoords | null> {
  const coords = await readLiveCoords();
  if (!coords && opts?.required) {
    throw new Error(
      "Could not read GPS. Enable location permission and try again at the office.",
    );
  }
  return coords;
}

export type GeofenceMatch = {
  inside: boolean;
  distanceMeters: number | null;
  radiusMeters: number | null;
  locationName: string | null;
};

function clean(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function samePlace(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function formatOfficeLabel(locationName: string): string {
  const name = clean(locationName);
  return name || "Office";
}

const LOCATION_TYPE_LABELS: Record<string, string> = {
  office: "Office",
  head_office: "Head Office",
  warehouse: "Warehouse",
  plant: "Plant",
  remote: "Remote",
};

function typeOfficeLabel(loc: WorkLocationFence): string | null {
  const key = clean(loc.location_type).toLowerCase();
  if (!key) return null;
  return LOCATION_TYPE_LABELS[key] ?? null;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radiusM = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * radiusM * Math.asin(Math.sqrt(a));
}

function hasGeofence(loc: WorkLocationFence): boolean {
  const radius = Number(loc.geofence_radius_meters);
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  return (
    Number.isFinite(radius) &&
    radius > 0 &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function geofencedLocations(
  locations: WorkLocationFence[] | null | undefined,
): WorkLocationFence[] {
  return (locations ?? []).filter(hasGeofence);
}

/** Nearest configured office fence vs current GPS (pads with accuracy). */
export function evaluateWorkGeofence(
  coords: LiveCoords,
  locations: WorkLocationFence[] | null | undefined,
): GeofenceMatch {
  const fences = geofencedLocations(locations);
  if (!fences.length) {
    return {
      inside: true,
      distanceMeters: null,
      radiusMeters: null,
      locationName: null,
    };
  }
  const accuracyPad = Math.min(
    80,
    Math.max(0, Number(coords.accuracyMeters) || 0),
  );
  let best: {
    name: string;
    dist: number;
    radius: number;
    inside: boolean;
  } | null = null;
  for (const loc of fences) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const radius = Number(loc.geofence_radius_meters);
    const dist = haversineMeters(coords.latitude, coords.longitude, lat, lng);
    const inside = dist <= radius + accuracyPad;
    if (!best || dist < best.dist) {
      best = {
        name: formatOfficeLabel(loc.location_name),
        dist,
        radius,
        inside,
      };
    }
  }
  return {
    inside: Boolean(best?.inside),
    distanceMeters: best ? Math.round(best.dist) : null,
    radiusMeters: best ? Math.round(best.radius) : null,
    locationName: best?.name ?? null,
  };
}

export function matchWorkLocationLabel(
  coords: LiveCoords,
  locations: WorkLocationFence[] | null | undefined,
  homeOfficeName?: string | null,
): string | null {
  if (!locations?.length) return null;

  const accuracyPad = Math.min(
    100,
    Math.max(0, Number(coords.accuracyMeters) || 0),
  );

  let best: { loc: WorkLocationFence; dist: number } | null = null;
  for (const loc of locations) {
    if (!hasGeofence(loc)) continue;
    const radius = Number(loc.geofence_radius_meters);
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const dist = haversineMeters(coords.latitude, coords.longitude, lat, lng);
    if (dist > radius + accuracyPad) continue;
    if (!best || dist < best.dist) {
      best = { loc, dist };
    }
  }
  if (!best) return null;

  const home = clean(homeOfficeName);
  if (best.loc.is_home && home) return formatOfficeLabel(home);
  if (home && geofencedLocations(locations).length === 1) {
    return formatOfficeLabel(home);
  }
  return (
    typeOfficeLabel(best.loc) || formatOfficeLabel(best.loc.location_name)
  );
}

function officeFallbackLabel(
  homeOfficeName?: string | null,
  locations?: WorkLocationFence[] | null,
): string | null {
  if (clean(homeOfficeName)) return formatOfficeLabel(homeOfficeName!);
  const geo = geofencedLocations(locations)[0];
  if (geo) return formatOfficeLabel(geo.location_name);
  const first = locations?.find((loc) => clean(loc.location_name));
  return first ? formatOfficeLabel(first.location_name) : null;
}

function isUnreliableGps(coords: LiveCoords): boolean {
  const accuracy = Number(coords.accuracyMeters);
  if (!Number.isFinite(accuracy)) return true;
  return accuracy > 150;
}

function looksLikeTehsilOrVillage(value: string): boolean {
  return /\b(tehsil|tahsil|taluk|taluka|village|gram)\b/i.test(value);
}

function formatAreaCity(area?: string | null, city?: string | null): string | null {
  const a = clean(area);
  const c = clean(city);
  if (a && looksLikeTehsilOrVillage(a)) {
    return c && !looksLikeTehsilOrVillage(c) ? c : null;
  }
  if (c && looksLikeTehsilOrVillage(c)) {
    return a || null;
  }
  if (a && c && !samePlace(a, c)) return `${a}, ${c}`;
  if (a) return a;
  if (c) return c;
  return null;
}

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  locality?: string;
  city_district?: string;
  district?: string;
  town?: string;
  city?: string;
  county?: string;
  state_district?: string;
  state?: string;
};

type NominatimReverse = {
  address?: NominatimAddress;
};

async function reverseGeocodeNominatim(
  coords: LiveCoords,
): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?lat=${encodeURIComponent(String(coords.latitude))}` +
    `&lon=${encodeURIComponent(String(coords.longitude))}` +
    `&format=json&zoom=14&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimReverse;
    const addr = data.address;
    if (!addr) return null;

    const areaCandidates = [
      addr.neighbourhood,
      addr.suburb,
      addr.city_district,
      addr.locality,
      addr.village,
      addr.hamlet,
      addr.district,
    ]
      .map(clean)
      .filter(Boolean);

    const area =
      areaCandidates.find((name) => !looksLikeTehsilOrVillage(name)) ||
      areaCandidates[0] ||
      "";

    const cityCandidates = [
      addr.city,
      addr.town,
      addr.state_district,
      addr.state,
      addr.county,
    ]
      .map(clean)
      .filter(Boolean);

    const city =
      cityCandidates.find((name) => !looksLikeTehsilOrVillage(name)) || "";

    return formatAreaCity(area, city);
  } catch {
    return null;
  }
}

export async function reverseGeocodeLabel(
  coords: LiveCoords,
): Promise<string | null> {
  return reverseGeocodeNominatim(coords);
}

/**
 * Inside geofence → HRMS office / branch name.
 * Unreliable GPS + geofence configured → HRMS office name.
 * Accurate GPS outside fence → Area, City.
 */
export async function fetchLiveLocationLabel(
  workLocationsOrOptions?:
    | WorkLocationFence[]
    | null
    | LiveLocationOptions,
  homeOfficeNameArg?: string | null,
): Promise<string | null> {
  const options: LiveLocationOptions = Array.isArray(workLocationsOrOptions)
    ? {
        workLocations: workLocationsOrOptions,
        homeOfficeName: homeOfficeNameArg,
      }
    : workLocationsOrOptions ?? {};

  const locations = options.workLocations ?? [];
  const home = officeFallbackLabel(options.homeOfficeName, locations);
  const fences = geofencedLocations(locations);
  const coords = await readLiveCoords();

  if (coords) {
    const atOffice = matchWorkLocationLabel(
      coords,
      locations,
      options.homeOfficeName,
    );
    if (atOffice) return atOffice;

    if (fences.length) {
      if (isUnreliableGps(coords)) {
        return home;
      }
      const away = await reverseGeocodeLabel(coords);
      return away ?? home;
    }
  }

  if (home) return home;
  if (coords) return reverseGeocodeLabel(coords);
  return null;
}
