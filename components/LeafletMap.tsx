"use client";

import React, { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  severity_score: number;
  latitude: number;
  longitude: number;
  image_url: string;
  status: string;
  created_at: string;
}

interface LeafletMapProps {
  reports: Report[];
  viewMode?: "active" | "resolved";
  focusCoords?: { lat: number; lng: number } | null;
}

// Helper to get marker color based on severity or resolved status
const getMarkerColor = (report: Report, viewMode: string) => {
  if (viewMode === "resolved" || report.status === "Resolved") {
    return "#10b981"; // emerald-500
  }
  if (report.severity_score <= 2) return "#06b6d4"; // cyan-500
  if (report.severity_score <= 3) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
};

export default function LeafletMap({ reports, viewMode = "active", focusCoords = null }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Compute the default center for when there are no reports
  const defaultCenter = useMemo<[number, number]>(() => [12.9716, 79.1595], []);

  // Initialize the map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(defaultCenter, 14);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [defaultCenter]);

  // Fit bounds when reports change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (reports.length > 0) {
      const bounds = L.latLngBounds(
        reports.map((r) => [r.latitude, r.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(defaultCenter, 14);
    }
  }, [reports, defaultCenter]);

  // Fly to focused coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;

    map.flyTo([focusCoords.lat, focusCoords.lng], 16, {
      animate: true,
      duration: 1.5,
    });

    // Open the popup for the matching marker
    Object.values(markersRef.current).forEach((marker) => {
      const latlng = marker.getLatLng();
      if (
        Math.abs(latlng.lat - focusCoords.lat) < 0.0001 &&
        Math.abs(latlng.lng - focusCoords.lng) < 0.0001
      ) {
        setTimeout(() => marker.openPopup(), 800);
      }
    });
  }, [focusCoords]);

  // Sync markers when reports or viewMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers that are no longer in the reports list
    const currentReportIds = new Set(reports.map((r) => r.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentReportIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers for current reports
    reports.forEach((report) => {
      const color = getMarkerColor(report, viewMode);
      const markerHtml = `
        <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                  fill="${color}" 
                  stroke="#020617" 
                  stroke-width="1.5"
            />
          </svg>
          <span style="
            position: absolute; 
            width: 10px; 
            height: 10px; 
            background-color: ${color}; 
            border-radius: 50%; 
            opacity: 0.75; 
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-marker-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      if (markersRef.current[report.id]) {
        // Remove old marker and re-create to update icon color
        markersRef.current[report.id].remove();
        delete markersRef.current[report.id];
      }

      const statusLabel = report.status === "Resolved"
        ? `<span style="color: #10b981; font-weight: bold;">✓ Resolved</span>`
        : `<span style="color: ${color}; font-weight: bold;">${report.category}</span>`;

      const marker = L.marker([report.latitude, report.longitude], {
        icon: customIcon,
      })
        .addTo(map)
        .bindPopup(`
          <div style="color: #f8fafc; background-color: #0f172a; padding: 4px; font-family: sans-serif;">
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${report.title}</h4>
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8;">${report.description}</p>
            <div style="font-size: 10px; display: inline-block; padding: 2px 6px; border-radius: 9999px; background-color: ${color}20; color: ${color}; border: 1px solid ${color}40; text-transform: uppercase; font-weight: bold;">
              ${statusLabel}
            </div>
          </div>
        `);
      markersRef.current[report.id] = marker;
    });

  }, [reports, viewMode]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />
      
      {/* Inject ping animation keyframes style tag */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .leaflet-popup-content-wrapper {
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
          color: #f8fafc !important;
        }
        .leaflet-popup-tip {
          background-color: #0f172a !important;
          border-left: 1px solid #334155 !important;
          border-bottom: 1px solid #334155 !important;
        }
      `}</style>
    </div>
  );
}
