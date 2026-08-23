import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";

export const FitBounds = ({ positions }: { positions: LatLngExpression[] }) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(latLngBounds(positions), { padding: [40, 40] });
  }, [map, positions]);

  return null;
};
