import provinces from 'philippines/provinces';
import cities from 'philippines/cities';

export function getProvinceNames() {
  return provinces.map((p) => p.name).sort((a, b) => a.localeCompare(b));
}

export function findProvinceByName(name) {
  if (!name) return null;
  const clean = String(name).trim().toLowerCase();
  return provinces.find((p) => p.name.toLowerCase() === clean) || null;
}

export function isKnownProvince(name) {
  return Boolean(findProvinceByName(name));
}

export function getCityNamesForProvince(provinceName) {
  const match = findProvinceByName(provinceName);
  if (!match) return [];
  return cities
    .filter((c) => c.province === match.key)
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));
}

export function isCityInProvince(cityName, provinceName) {
  if (!cityName || !provinceName) return false;
  const clean = String(cityName).trim().toLowerCase();
  return getCityNamesForProvince(provinceName).some((n) => n.toLowerCase() === clean);
}
