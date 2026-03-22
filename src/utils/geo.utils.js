// src/utils/geo.utils.js
// Utilitas GPS — Haversine distance, radius check, GPS validation

/**
 * Menghitung jarak antara dua titik koordinat menggunakan Haversine formula
 * @param {number} lat1 - Latitude titik 1
 * @param {number} lng1 - Longitude titik 1
 * @param {number} lat2 - Latitude titik 2
 * @param {number} lng2 - Longitude titik 2
 * @returns {number} Jarak dalam meter
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Jarak dalam meter
}

/**
 * Cek apakah koordinat berada dalam radius dari titik pusat
 * @param {number} lat - Latitude posisi user
 * @param {number} lng - Longitude posisi user
 * @param {number} schoolLat - Latitude sekolah
 * @param {number} schoolLng - Longitude sekolah
 * @param {number} radiusMeters - Radius dalam meter
 * @returns {{ isWithin: boolean, distance: number }}
 */
function isWithinRadius(lat, lng, schoolLat, schoolLng, radiusMeters) {
  const distance = calculateDistance(lat, lng, schoolLat, schoolLng);
  return {
    isWithin: distance <= radiusMeters,
    distance: Math.round(distance) // Bulatkan ke meter terdekat
  };
}

/**
 * Validasi data GPS dari request
 * @param {object} gpsData - { latitude, longitude, isMockGps, accuracy }
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateGpsData(gpsData) {
  const errors = [];
  const { latitude, longitude } = gpsData;

  if (latitude === undefined || latitude === null) {
    errors.push('Latitude diperlukan');
  } else if (latitude < -90 || latitude > 90) {
    errors.push('Latitude harus antara -90 dan 90');
  }

  if (longitude === undefined || longitude === null) {
    errors.push('Longitude diperlukan');
  } else if (longitude < -180 || longitude > 180) {
    errors.push('Longitude harus antara -180 dan 180');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse time string "HH:mm" ke menit sejak midnight
 * @param {string} timeStr - format "HH:mm" 
 * @returns {number} menit sejak 00:00
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Cek apakah waktu saat ini berada dalam window waktu tertentu
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @param {Date} [now] - Waktu sekarang (opsional, default new Date)
 * @returns {boolean}
 */
function isWithinTimeWindow(startTime, endTime, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Cek apakah waktu sudah melewati threshold (terlambat)
 * @param {string} threshold - "HH:mm"
 * @param {Date} [now] - Waktu sekarang
 * @returns {boolean}
 */
function isLateByThreshold(threshold, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const thresholdMinutes = parseTimeToMinutes(threshold);
  return currentMinutes > thresholdMinutes;
}

module.exports = {
  calculateDistance,
  isWithinRadius,
  validateGpsData,
  parseTimeToMinutes,
  isWithinTimeWindow,
  isLateByThreshold
};
