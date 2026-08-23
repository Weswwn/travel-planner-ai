import L from "leaflet";

const pinSvg = (color: string, label: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="${color}"/>
  <circle cx="12.5" cy="12.5" r="8" fill="white"/>
  <text x="12.5" y="16" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#1f2937">${label}</text>
</svg>`;

// A plain SVG pin lets us recolor markers and stamp a travel-order number per
// instance, without needing a separate raster icon asset for every combination.
export const createPinIcon = (color: string, label: string) =>
  L.divIcon({
    html: pinSvg(color, label),
    className: "",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
