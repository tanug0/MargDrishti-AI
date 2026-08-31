/**
 * MargDrishti AI Geolocation Service
 * Uses genuine browser Geolocation API with comprehensive permission & error handling.
 */
export async function getCurrentGPSPosition() {
  if (!navigator.geolocation) {
    return {
      available: false,
      error: 'Geolocation is not supported by this browser.',
      coords: null
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          available: true,
          error: null,
          coords: {
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            accuracyMeters: Math.round(position.coords.accuracy),
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed
          },
          timestamp: position.timestamp
        });
      },
      (err) => {
        let message = 'Unable to retrieve location.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission denied by user.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'GPS position is currently unavailable.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        resolve({
          available: false,
          error: message,
          coords: null
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}

/**
 * Reverse geocode coordinates using OpenStreetMap Nominatim (rate-limited client fetch)
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' }
      }
    );
    if (!res.ok) return `${latitude}, ${longitude}`;
    const data = await res.json();
    return data.display_name || `${latitude}, ${longitude}`;
  } catch (e) {
    return `${latitude}, ${longitude}`;
  }
}
