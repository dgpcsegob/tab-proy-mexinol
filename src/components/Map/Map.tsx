import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { LngLat, LngLatLike, Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { Feature, Point, Geometry, Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import "@maptiler/sdk/dist/maptiler-sdk.css";

type MapProps = {
  layersVisibility: { [layerId:string]: boolean };
};

interface RouteData {
  id: number;
  startPoint: LngLat;
  endPoint: LngLat;
  geometry: Geometry;
  distance: string;
  duration: string;
}

const get3DIcon = (isOn: boolean) => {
  const color = isOn ? '#007cbf' : '#6c757d';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const Map: React.FC<MapProps> = ({ layersVisibility }) => {
  const mapRef = useRef<MaplibreMap | null>(null);
  const minimapRef = useRef<MaplibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const blinkAnimationId = useRef<number | null>(null);
  const routeIdCounter = useRef(0);
  const popupRef = useRef(new maplibregl.Popup({ closeButton: false, closeOnClick: false }));

  // === Brújula: estado y refs ===
  const [displayBearing, setDisplayBearing] = useState(0); // bearing suavizado mostrado en la aguja
  const displayBearingRef = useRef(0);
  const compassAnimId = useRef<number | null>(null);

  const apiKey = 'QAha5pFBxf4hGa8Jk5zv';
  const baseStyleUrl = 'https://www.mapabase.atdt.gob.mx/style.json'; // Mapa gubernamental 2D
  const base3DStyleUrl = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${apiKey}`; // Mapa outdoor 3D
  const satelliteStyleUrl = `https://api.maptiler.com/maps/satellite/style.json?key=${apiKey}`;
  const minimapStyleUrl = `https://api.maptiler.com/maps/dataviz-light/style.json?key=${apiKey}`;

  const [isSatellite, setIsSatellite] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isMeasuringLine, setIsMeasuringLine] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [styleLoadCounter, setStyleLoadCounter] = useState(0);
  const [currentPoints, setCurrentPoints] = useState<LngLatLike[]>([]);
  const [currentLinePoints, setCurrentLinePoints] = useState<LngLatLike[]>([]);
  const [routesData, setRoutesData] = useState<RouteData[]>([]);
  const [linesData, setLinesData] = useState<RouteData[]>([]);
  const [mapView, setMapView] = useState<number>(0);

  const isMeasuringRef = useRef(isMeasuring);
  const isMeasuringLineRef = useRef(isMeasuringLine);
  isMeasuringRef.current = isMeasuring;
  isMeasuringLineRef.current = isMeasuringLine;

  const clearCurrentPoints = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = ['start-point-current', 'start-point-current-pulse', 'end-point-current', 'end-point-current-pulse',
                   'start-point-line-current', 'start-point-line-current-pulse', 'end-point-line-current', 'end-point-line-current-pulse'];
    const sources = ['start-point-current', 'end-point-current', 'start-point-line-current', 'end-point-line-current'];
    layers.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    sources.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
  }, []);

  const drawSingleRouteOnMap = useCallback((map: MaplibreMap, route: RouteData) => {
    const { id, startPoint, endPoint, geometry } = route;
    if (map.getSource(`route-source-${id}`)) return;
    map.addSource(`route-source-${id}`, { type: 'geojson', data: { type: 'Feature', geometry, properties: {} } });
    map.addLayer({
      id: `route-layer-${id}`, type: 'line', source: `route-source-${id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#007cbf', 'line-width': 5, 'line-opacity': 0.8 },
    });
    map.addSource(`start-point-${id}`, { type: 'geojson', data: { type: 'Point', coordinates: [startPoint.lng, startPoint.lat] } });
    map.addLayer({
      id: `start-point-${id}`, type: 'circle', source: `start-point-${id}`,
      paint: { 'circle-radius': 6, 'circle-color': '#007cbf', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
    });
    map.addSource(`end-point-${id}`, { type: 'geojson', data: { type: 'Point', coordinates: [endPoint.lng, endPoint.lat] } });
    map.addLayer({
      id: `end-point-${id}`, type: 'circle', source: `end-point-${id}`,
      paint: { 'circle-radius': 6, 'circle-color': '#007cbf', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
    });
  }, []);

  const drawSingleLineOnMap = useCallback((map: MaplibreMap, line: RouteData) => {
    const { id, startPoint, endPoint } = line;
    if (map.getSource(`line-source-${id}`)) return;
    
    // Crear geometría de línea recta
    const lineGeometry = {
      type: 'LineString' as const,
      coordinates: [[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]
    };
    
    map.addSource(`line-source-${id}`, { type: 'geojson', data: { type: 'Feature', geometry: lineGeometry, properties: {} } });
    map.addLayer({
      id: `line-layer-${id}`, type: 'line', source: `line-source-${id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ff6b35', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] },
    });
    map.addSource(`start-line-point-${id}`, { type: 'geojson', data: { type: 'Point', coordinates: [startPoint.lng, startPoint.lat] } });
    map.addLayer({
      id: `start-line-point-${id}`, type: 'circle', source: `start-line-point-${id}`,
      paint: { 'circle-radius': 6, 'circle-color': '#ff6b35', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
    });
    map.addSource(`end-line-point-${id}`, { type: 'geojson', data: { type: 'Point', coordinates: [endPoint.lng, endPoint.lat] } });
    map.addLayer({
      id: `end-line-point-${id}`, type: 'circle', source: `end-line-point-${id}`,
      paint: { 'circle-radius': 6, 'circle-color': '#ff6b35', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
    });
  }, []);

  const clearAllRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Limpiar rutas
    routesData.forEach(route => {
      const { id } = route;
      if (map.getLayer(`route-layer-${id}`)) map.removeLayer(`route-layer-${id}`);
      if (map.getSource(`route-source-${id}`)) map.removeSource(`route-source-${id}`);
      if (map.getLayer(`start-point-${id}`)) map.removeLayer(`start-point-${id}`);
      if (map.getSource(`start-point-${id}`)) map.removeSource(`start-point-${id}`);
      if (map.getLayer(`end-point-${id}`)) map.removeLayer(`end-point-${id}`);
      if (map.getSource(`end-point-${id}`)) map.removeSource(`end-point-${id}`);
    });
    
    // Limpiar líneas
    linesData.forEach(line => {
      const { id } = line;
      if (map.getLayer(`line-layer-${id}`)) map.removeLayer(`line-layer-${id}`);
      if (map.getSource(`line-source-${id}`)) map.removeSource(`line-source-${id}`);
      if (map.getLayer(`start-line-point-${id}`)) map.removeLayer(`start-line-point-${id}`);
      if (map.getSource(`start-line-point-${id}`)) map.removeSource(`start-line-point-${id}`);
      if (map.getLayer(`end-line-point-${id}`)) map.removeLayer(`end-line-point-${id}`);
      if (map.getSource(`end-line-point-${id}`)) map.removeSource(`end-line-point-${id}`);
    });
    
    setRoutesData([]);
    setLinesData([]);
    clearCurrentPoints();
  }, [routesData, linesData, clearCurrentPoints]);
  
  const attachAllTooltipEvents = useCallback((map: MaplibreMap) => {
    const popup = popupRef.current;
    
    const checkMeasurement = () => isMeasuringRef.current || isMeasuringLineRef.current;
   
    const locVillaSolaPopup = (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup.setLngLat(e.lngLat).setHTML(`<strong>Localidad:</strong> ${props.NOMGEO}<br/><strong>Ámbito:</strong> ${props.AMBITO}`).addTo(map);
      }
    };
    map.on('mouseenter', 'locvillasola', locVillaSolaPopup);
    map.on('mouseleave', 'locvillasola', () => { if (!checkMeasurement()) popup.remove(); });

    const lrVillaSolaPopup = (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup.setLngLat(e.lngLat).setHTML(`<strong>Localidad:</strong> ${props.NOMGEO}`).addTo(map);
      }
    };
    map.on('mouseenter', 'lrvillasola', lrVillaSolaPopup);
    map.on('mouseleave', 'lrvillasola', () => { if (!checkMeasurement()) popup.remove(); });

    const perimetralesPopup = (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup.setLngLat(e.lngLat).setHTML(`<strong>Nucleo:</strong> ${props.NOM_NUC}<br/><strong>Municipio:</strong> ${props.MUNICIPIO}</br><strong>Tipo:</strong> ${props.tipo}`).addTo(map);
      }
    };
    map.on('mouseenter', 'perimetrales', perimetralesPopup);
    map.on('mouseleave', 'perimetrales', () => { if (!checkMeasurement()) popup.remove(); });

    const comindPopup = (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup.setLngLat(e.lngLat).setHTML(`<strong>Entidad:</strong> ${props.NOM_ENT}<br/><strong>Municipio:</strong> ${props.NOM_MUN}<br/><strong>Localidad:</strong> ${props.NOM_LOC}<br/><strong>Comunidad:</strong> ${props.NOM_COM}<br/>`).addTo(map);
      }
    };
    // Eventos para comind con cursor pointer
    map.on('click', 'comind', comindPopup);
    // Cambiar cursor a pointer al entrar
    map.on('mouseenter', 'comind', () => {
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    // Restaurar cursor y quitar popup al salir
    map.on('mouseleave', 'comind', () => { 
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = '';
        popup.remove(); 
      }
    });

    const localidadesSedeINPIPopup = (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup.setLngLat(e.lngLat).setHTML(`<strong>Entidad:</strong> ${props.NOM_ENT}<br/><strong>Municipio:</strong> ${props.NOM_MUN}<br/><strong>Localidad:</strong> ${props.NOM_LOC}<br/><strong>Pueblo:</strong> ${props.Pueblo}`).addTo(map);
      }
    };
    // Eventos para LocalidadesSedeINPI con cursor pointer
    map.on('click', 'LocalidadesSedeINPI', localidadesSedeINPIPopup);
    // Cambiar cursor a pointer al entrar
    map.on('mouseenter', 'LocalidadesSedeINPI', () => {
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    // Restaurar cursor y quitar popup al salir
    map.on('mouseleave', 'LocalidadesSedeINPI', () => { 
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = '';
        popup.remove(); 
      }
    });
    }, 
   []);

  const addRouteToMap = useCallback(async (points: LngLatLike[]) => {
    const map = mapRef.current;
    if (!map) return;
    const [startPoint, endPoint] = points.map(p => LngLat.convert(p));
    const startCoords = `${startPoint.lng},${startPoint.lat}`;
    const endCoords = `${endPoint.lng},${endPoint.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoords};${endCoords}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.code !== 'Ok' || data.routes.length === 0) throw new Error('No se pudo encontrar una ruta.');
      const route = data.routes[0];
      const distance = (route.distance / 1000).toFixed(2);
      const totalSeconds = route.duration;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.round((totalSeconds % 3600) / 60);
      const durationParts: string[] = [];
      if (hours > 0) durationParts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
      if (minutes > 0 || durationParts.length === 0) durationParts.push(`${minutes} min`);
      const duration = durationParts.join(' ');
      const newRouteData: RouteData = {
        id: routeIdCounter.current++,
        startPoint, endPoint,
        geometry: route.geometry,
        distance, duration,
      };
      drawSingleRouteOnMap(map, newRouteData);
      setRoutesData(prev => [...prev, newRouteData]);
    } catch (error) {
      console.error('Error al obtener la ruta:', error);
      alert('No se pudo calcular la ruta. Por favor, inténtelo de nuevo.');
    } finally {
      clearCurrentPoints();
      setCurrentPoints([]);
    }
  }, [clearCurrentPoints, drawSingleRouteOnMap]);

  const addLineToMap = useCallback((points: LngLatLike[]) => {
    const map = mapRef.current;
    if (!map) return;
    
    const [startPoint, endPoint] = points.map(p => LngLat.convert(p));
    
    // Calcular distancia en línea recta usando fórmula de Haversine
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Radio de la Tierra en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    const distanceKm = calculateDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
    const distance = distanceKm.toFixed(2);
    
    const newLineData: RouteData = {
      id: routeIdCounter.current++,
      startPoint, 
      endPoint,
      geometry: {
        type: 'LineString',
        coordinates: [[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]
      },
      distance, 
      duration: 'Línea recta',
    };
    
    drawSingleLineOnMap(map, newLineData);
    setLinesData(prev => [...prev, newLineData]);
    clearCurrentPoints();
    setCurrentLinePoints([]);
  }, [clearCurrentPoints, drawSingleLineOnMap]);

  const addVectorLayers = (map: maplibregl.Map) => {
    if (!map.getSource('LocalidadesSedeINPI')) {
      map.addSource('LocalidadesSedeINPI', { type: 'vector', url: 'pmtiles://data/inpi.pmtiles' });
    }
    const dark2 = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'];
    const pueblosMatch: (string | number)[] = [];
    for (let i = 1; i <= 72; i++) { pueblosMatch.push(i.toString(), dark2[i % dark2.length]); }
    const puebloExpression = ['match', ['get', 'ID_Pueblo'], ...pueblosMatch, '#666666'] as any;
    if (!map.getLayer('LocalidadesSedeINPI')) {
      map.addLayer({
        id: 'LocalidadesSedeINPI', type: 'circle', source: 'LocalidadesSedeINPI', 'source-layer': 'inpi_tile',
        paint: { 'circle-radius': 3.2, 'circle-color': puebloExpression, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0 }
      });
    }

    if (!map.getSource('perimetrales')) {
      map.addSource('perimetrales', { type: 'vector', url: 'pmtiles://data/perimetrales_nocert_oax.pmtiles' });
    }
    if (!map.getLayer('perimetrales')) {
      map.addLayer({
        id: 'perimetrales', type: 'fill', source: 'perimetrales', 'source-layer': 'perimetrales_nocert_oax_tile',
        paint: { 'fill-color': '#15ff00ff', 'fill-opacity': 0.5, 'fill-outline-color': '#ffffffff' },
      });
    }

    if (!map.getSource('lrvillasola')) {
      map.addSource('lrvillasola', { type: 'vector', url: 'pmtiles://data/lr_villasola.pmtiles' });
    }
    if (!map.getLayer('lrvillasola')) {
      map.addLayer({
        id: 'lrvillasola', type: 'circle', source: 'lrvillasola', 'source-layer': 'lr_villasola_tile',
        paint: { 'circle-color': '#0da326ff', 'circle-radius': 8, 'circle-opacity': 0.8, 'circle-stroke-color': '#ffffffff', 'circle-stroke-width': 2}
      });
    }

    if (!map.getSource('acueducto')) {
      map.addSource('acueducto', { type: 'vector', url: 'pmtiles://data/acueductoyramales.pmtiles' });
    }
    if (!map.getLayer('acueducto')) {
      map.addLayer({
        id: 'acueducto', type: 'line', source: 'acueducto', 'source-layer': 'acueductoyramales_tile',
        paint: { 'line-color': '#00FFF0', 'line-width': 3, 'line-opacity': 0.8 }
      });
    }

    if (!map.getSource('locvillasola')) {
      map.addSource('locvillasola', { type: 'vector', url: 'pmtiles://data/loc_villasola.pmtiles' });
    }
    if (!map.getLayer('locvillasola')) {
      map.addLayer({
        id: 'locvillasola', type: 'fill', source: 'locvillasola', 'source-layer': 'loc_villasola_tile',
        paint: { 'fill-color': '#f0f34cff', 'fill-opacity': 0.7, 'fill-outline-color': '#ffffffff' },
      });
    }

   if (!map.getSource('comind')) {
      map.addSource('comind', { type: 'vector', url: 'pmtiles://data/comunidades_inpi.pmtiles' });
    }
    // Agregar halo tenue para comind (capa inferior)
    if (!map.getLayer('comind-halo')) {
      map.addLayer({
        id: 'comind-halo', type: 'circle', source: 'comind', 'source-layer': 'comunidades_inpi_tile',
        paint: { 
          'circle-color': '#df7649', 
          'circle-radius': 12, 
          'circle-opacity': 0.15,
          'circle-blur': 0.8
        }
      });
    }
     // Capa de pulso para comind (sobre el halo, bajo el principal)
    if (!map.getLayer('comind-pulse')) {
      map.addLayer({
        id: 'comind-pulse', type: 'circle', source: 'comind', 'source-layer': 'comunidades_inpi_tile',
        paint: { 
          'circle-color': '#df7649', 
          'circle-radius': 15, 
          'circle-opacity': 0.6
        }
      });
    }
    // Capa principal de comind (encima del halo y pulso)
    if (!map.getLayer('comind')) {
      map.addLayer({
        id: 'comind', type: 'circle', source: 'comind', 'source-layer': 'comunidades_inpi_tile',
        paint: { 'circle-color': '#df7649', 'circle-radius': 8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 }
      });
    }

     if (!map.getSource('presa')) {
      map.addSource('presa', { type: 'vector', url: 'pmtiles://data/presamargarita.pmtiles' });
    }
    if (!map.getLayer('presa')) {
      map.addLayer({
        id: 'presa', type: 'fill', source: 'presa', 'source-layer': 'presamargarita_tile',
        paint: { 'fill-color': '#4c9af3ff', 'fill-opacity': 0.8, 'fill-outline-color': '#ffffffff' },
      });
    }
  };

  const updateLayerVisibility = useCallback((map: maplibregl.Map) => {
    Object.entries(layersVisibility).forEach(([id, visible]) => {
      const vis = visible ? 'visible' : 'none';
      try { 
        if (map.getLayer(id)) { 
          map.setLayoutProperty(id, 'visibility', vis); 
        }
        // También controlar la visibilidad del halo y pulso de comind
        if (id === 'comind') {
          if (map.getLayer('comind-halo')) {
            map.setLayoutProperty('comind-halo', 'visibility', vis);
          }
          if (map.getLayer('comind-pulse')) {
            map.setLayoutProperty('comind-pulse', 'visibility', vis);
          }
        }
      } catch {}
    });
  }, [layersVisibility]);

  // Función animateTerrainExaggeration para crear efecto de realce gradual
  const animateTerrainExaggeration = useCallback((map: any, targetExaggeration: number, duration: number = 2000) => {
    const startTime = Date.now();
    const startExaggeration = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function para suavizar la animación
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentExaggeration = startExaggeration + (targetExaggeration - startExaggeration) * easeOutQuart;
      
      try {
        if (map.getTerrain()) {
          map.setTerrain({ 
            source: 'terrain-rgb', 
            exaggeration: currentExaggeration
          });
        }
      } catch (error) {
        console.warn('Error animating terrain exaggeration:', error);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, []);

  // Función toggle3D corregida para funcionar como switch
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();
    const currentIsSatellite = isSatellite; // Estado del switch satelital
    const newIs3D = !is3D; // Nuevo estado del switch 3D

    // Limpiar efectos 3D actuales
    if (map.getTerrain()) {
      map.setTerrain(null);
    }
    if (map.getLayer('sky')) {
      map.removeLayer('sky');
    }

    setIs3D(newIs3D);

    // LÓGICA SWITCH: Determinar estilo basado en ambos switches
    let newStyleUrl: string;
    if (currentIsSatellite) {
      // Switch satelital ON: siempre usar satelital (2D o 3D según switch 3D)
      newStyleUrl = satelliteStyleUrl;
    } else {
      // Switch satelital OFF: usar gubernamental 2D o outdoor 3D según switch 3D
      if (newIs3D) {
        newStyleUrl = base3DStyleUrl; // outdoor 3D
      } else {
        newStyleUrl = baseStyleUrl; // gubernamental 2D
      }
    }

    // Solo cambiar estilo si es necesario
    const needsStyleChange = (newIs3D && !currentIsSatellite) || (!newIs3D && !currentIsSatellite);
    
    if (needsStyleChange) {
      map.setStyle(newStyleUrl, { diff: false });
      
      map.once('styledata', () => {
        addVectorLayers(map);
        
        // Agregar fuente de terreno si 3D está ON
        if (newIs3D && !map.getSource('terrain-rgb')) {
          map.addSource('terrain-rgb', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 256
          });
        }

        updateLayerVisibility(map);
        routesData.forEach(route => drawSingleRouteOnMap(map, route));
        linesData.forEach(line => drawSingleLineOnMap(map, line));
        attachAllTooltipEvents(map);

        // Reiniciar animación comind
        if (blinkAnimationId.current) {
          cancelAnimationFrame(blinkAnimationId.current);
        }
        const animateComindPulse = (timestamp: number) => {
          const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
          
          const baseRadius = 8;
          const maxRadius = 12;
          const currentRadius = baseRadius + (maxRadius - baseRadius) * pulseProgress;
          
          const baseHaloRadius = 12;
          const maxHaloRadius = 18;
          const currentHaloRadius = baseHaloRadius + (maxHaloRadius - baseHaloRadius) * pulseProgress;
          
          const haloOpacity = 0.1 + 0.15 * pulseProgress;
          const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
          const pulseOpacity = 1 - (pulseRadius / 25);
          
          if (map.getLayer('comind')) {
            map.setPaintProperty('comind', 'circle-radius', currentRadius);
          }
          
          if (map.getLayer('comind-halo')) {
            map.setPaintProperty('comind-halo', 'circle-radius', currentHaloRadius);
            map.setPaintProperty('comind-halo', 'circle-opacity', haloOpacity);
          }
          
          if (map.getLayer('comind-pulse')) {
            map.setPaintProperty('comind-pulse', 'circle-radius', pulseRadius);
            map.setPaintProperty('comind-pulse', 'circle-opacity', pulseOpacity * 0.4);
          }
          
          blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
        }
        animateComindPulse(0);

        // Restaurar posición
        map.jumpTo({
          center: currentCenter,
          zoom: currentZoom,
          bearing: currentBearing,
          pitch: 0
        });

        // Aplicar efectos según switch 3D
        setTimeout(() => {
          applyOrRemove3DEffects(map, newIs3D, currentIsSatellite);
        }, 200);
      });
    } else {
      // Solo cambiar efectos 3D sin cambiar estilo (para satelital)
      setTimeout(() => {
        applyOrRemove3DEffects(map, newIs3D, currentIsSatellite);
      }, 100);
    }
  };

  // Función helper para aplicar o quitar efectos 3D
  const applyOrRemove3DEffects = (map: any, is3DActive: boolean, isSatelliteActive: boolean) => {
    if (is3DActive) {
      // Aplicar efectos 3D
      try {
        if (!map.getSource('terrain-rgb')) {
          map.addSource('terrain-rgb', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 256
          });
        }

        const exaggeration = isSatelliteActive ? 1.2 : 1.5;
        const targetPitch = isSatelliteActive ? 60 : 70;
        const sunIntensity = isSatelliteActive ? 3 : 5;

        // Iniciar con terreno sin exageración y animarlo
        map.setTerrain({ 
          source: 'terrain-rgb', 
          exaggeration: 0.1 // Empezar con valor mínimo
        });
        
        // Animar la exageración del terreno
        animateTerrainExaggeration(map, exaggeration, 2500);
        
        if (!map.getLayer('sky')) {
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: { 
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': sunIntensity,
            }
          } as any);
        }
        
        // Animar inclinación solo si está plano
        const currentPitch = map.getPitch();
        if (currentPitch < 5) {
          map.easeTo({ 
            pitch: targetPitch,
            bearing: map.getBearing(),
            duration: 1500,
            easing: (t: number) => t * (2 - t)
          });
        }
        
      } catch (error) {
        console.warn('Error aplicando efectos 3D:', error);
      }
    } else {
      // Quitar efectos 3D
      try {
        const currentPitch = map.getPitch();
        if (currentPitch > 0) {
          map.easeTo({ 
            pitch: 0, 
            duration: 1200,
            easing: (t: number) => t * (2 - t)
          }).once('moveend', () => {
            if (map.getLayer('sky')) {
              map.removeLayer('sky');
            }
            if (map.getTerrain()) {
              map.setTerrain(null);
            }
          });
        } else {
          if (map.getLayer('sky')) {
            map.removeLayer('sky');
          }
          if (map.getTerrain()) {
            map.setTerrain(null);
          }
        }
      } catch (error) {
        console.warn('Error quitando efectos 3D:', error);
      }
    }
  };
  
  const toggleMeasurement = () => {
    const wasMeasuring = isMeasuring;
    setIsMeasuring(!wasMeasuring);
    setIsMeasuringLine(false); // Desactivar medición de línea si está activa
    if (wasMeasuring) clearAllRoutes();
    setCurrentPoints([]);
    setCurrentLinePoints([]);
  };

  const toggleLineMeasurement = () => {
    const wasMeasuringLine = isMeasuringLine;
    setIsMeasuringLine(!wasMeasuringLine);
    setIsMeasuring(false); // Desactivar medición de ruta si está activa
    if (wasMeasuringLine) clearAllRoutes();
    setCurrentPoints([]);
    setCurrentLinePoints([]);
  };

  const resetNorth = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: 0,
      pitch: is3D ? map.getPitch() : 0, // Mantener pitch actual solo si está en 3D
      duration: 1000,
      easing: (t: number) => t * (2 - t) // easeInOutQuad
    });
  };

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch(); // GUARDAR EL PITCH ACTUAL
    const was3D = is3D;
    const newIsSatellite = !isSatellite;

    // Limpiar efectos 3D antes del cambio
    if (map.getTerrain()) map.setTerrain(null);
    if (map.getLayer('sky')) map.removeLayer('sky');

    setIsSatellite(newIsSatellite);

    // === ELECCIÓN DE ESTILO CORREGIDA ===
    let newStyleUrl: string;
    if (was3D) {
      newStyleUrl = newIsSatellite ? satelliteStyleUrl : base3DStyleUrl;
    } else {
      newStyleUrl = newIsSatellite ? satelliteStyleUrl : baseStyleUrl;
    }

    map.setStyle(newStyleUrl, { diff: false });

    map.once('styledata', () => {
      addVectorLayers(map);
      updateLayerVisibility(map);
      routesData.forEach(route => drawSingleRouteOnMap(map, route));
      linesData.forEach(line => drawSingleLineOnMap(map, line));
      attachAllTooltipEvents(map);

      // Reiniciar animación de pulso
      if (blinkAnimationId.current) cancelAnimationFrame(blinkAnimationId.current);
      const animateComindPulse = (timestamp: number) => {
        const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
        const baseRadius = 8, maxRadius = 12;
        const currentRadius = baseRadius + (maxRadius - baseRadius) * pulseProgress;
        const baseHaloRadius = 12, maxHaloRadius = 18;
        const currentHaloRadius = baseHaloRadius + (maxHaloRadius - baseHaloRadius) * pulseProgress;
        const haloOpacity = 0.1 + 0.15 * pulseProgress;
        const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
        const pulseOpacity = 1 - (pulseRadius / 25);

        if (map.getLayer('comind')) map.setPaintProperty('comind', 'circle-radius', currentRadius);
        if (map.getLayer('comind-halo')) {
          map.setPaintProperty('comind-halo', 'circle-radius', currentHaloRadius);
          map.setPaintProperty('comind-halo', 'circle-opacity', haloOpacity);
        }
        if (map.getLayer('comind-pulse')) {
          map.setPaintProperty('comind-pulse', 'circle-radius', pulseRadius);
          map.setPaintProperty('comind-pulse', 'circle-opacity', pulseOpacity * 0.4);
        }
        blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
      };
      animateComindPulse(0);

      // ✅ CORRECCIÓN: Restaurar posición CON EL PITCH ORIGINAL
      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: was3D ? currentPitch : 0 // Mantener pitch si estaba en 3D, sino 0
      });

      // === REAPLICAR EFECTOS 3D SIN PITCH ANIMATION SI YA ESTABA EN 3D ===
      if (was3D) {
        // Asegurar fuente de terreno
        if (!map.getSource('terrain-rgb')) {
          map.addSource('terrain-rgb', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 256
          });
        }

        const exaggeration = newIsSatellite ? 1.2 : 1.5;
        const sunIntensity = newIsSatellite ? 3 : 5;

        // Aplicar terreno con animación de exageración
        setTimeout(() => {
          map.setTerrain({ source: 'terrain-rgb', exaggeration: 0.1 });
          animateTerrainExaggeration(map, exaggeration, 1500);
        }, 100);

        if (!map.getLayer('sky')) {
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0, 0],
              'sky-atmosphere-sun-intensity': sunIntensity
            }
          } as any);
        }

        // ✅ NO HACER PITCH ANIMATION SI YA ESTABA EN 3D
        // (El pitch ya se restauró arriba)
      }
    });
  };

  // === Animación continua de la brújula (interpolación suave hacia el bearing del mapa) ===
  const animateCompass = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      compassAnimId.current = requestAnimationFrame(animateCompass);
      return;
    }

    const target = map.getBearing();
    const current = displayBearingRef.current;

    // Diferencia mínima -180..180
    const diff = ((target - current + 540) % 360) - 180;

    // Suavizado (ajusta 0.1..0.25 según prefieras)
    const next = current + diff * 0.15;

    displayBearingRef.current = next;
    setDisplayBearing(next);

    compassAnimId.current = requestAnimationFrame(animateCompass);
  }, []);

  useEffect(() => {
    if (mapRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    const mexicoBounds: [LngLatLike, LngLatLike] = [[-121, 14], [-84, 33.5]];

    const map = new maplibregl.Map({
      container, 
      style: baseStyleUrl,
      center: [-96.72966, 16.76375], 
      zoom: 9.65,
      pitch: 0, 
      bearing: 0, 
      attributionControl: false, 
      maxBounds: mexicoBounds,
      maxPitch: 85
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addControl(new maplibregl.AttributionControl({ customAttribution: 'Secretaría de Gobernación', compact: true }), 'bottom-right');
      
      // El mapa gubernamental inicia siempre plano (no tiene efectos de terreno por defecto)
      if (map.getPitch() > 0) {
        map.setPitch(0);
      }
      
      // Agregar fuente de terreno RGB de MapTiler para uso futuro con 3D
      // (Se agregará solo cuando se cambie al estilo outdoor 3D)
      
      addVectorLayers(map); 

      const allToggleableLayers = [
          'acueducto', 'presa', 'LocalidadesSedeINPI', 'comind',
          'perimetrales', 'lrvillasola', 'locvillasola', 'comind-halo', 'comind-pulse'
          
      ];
      allToggleableLayers.forEach(layerId => {
          if (map.getLayer(layerId)) { map.setLayoutProperty(layerId, 'visibility', 'none'); }
      });
      
      // Capas que deben estar visibles al iniciar
      const initialVisibleLayers = ['acueducto', 'presa', 'comind', 'comind-halo', 'comind-pulse'];
      initialVisibleLayers.forEach(layerId => {
          if (map.getLayer(layerId)) { map.setLayoutProperty(layerId, 'visibility', 'visible'); }
      });
      
      const updatePopupPositions = () => setMapView(v => v + 1);
      map.on('move', updatePopupPositions);
      map.on('zoom', updatePopupPositions);
      
      const animatePulse = (timestamp: number) => {
        const radius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
        const opacity = 1 - (radius / 25);
        
        // Animar puntos de medición de ruta
        ['start-point-current-pulse', 'end-point-current-pulse'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, 'circle-radius', radius);
                map.setPaintProperty(layerId, 'circle-opacity', opacity);
            }
        });
        
        // Animar puntos de medición de línea recta
        ['start-point-line-current-pulse', 'end-point-line-current-pulse'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, 'circle-radius', radius);
                map.setPaintProperty(layerId, 'circle-opacity', opacity);
            }
        });
        
        animationFrameId.current = requestAnimationFrame(animatePulse);
      }
      animatePulse(0);

      // Animación pulsante para los puntos comind con halo y efecto de pulso
      const animateComindPulse = (timestamp: number) => {
        const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2; // Oscila entre 0 y 1, más lento
        
        // Calcular tamaños con efecto de crecimiento y reducción
        const baseRadius = 8;
        const maxRadius = 12;
        const currentRadius = baseRadius + (maxRadius - baseRadius) * pulseProgress;
        
        const baseHaloRadius = 12;
        const maxHaloRadius = 18;
        const currentHaloRadius = baseHaloRadius + (maxHaloRadius - baseHaloRadius) * pulseProgress;
        
        // Opacidad del halo que pulsa suavemente
        const haloOpacity = 0.1 + 0.15 * pulseProgress;
        
        // Efecto de pulso similar al de los puntos de medición
        const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
        const pulseOpacity = 1 - (pulseRadius / 25);
        
        if (map.getLayer('comind')) {
          map.setPaintProperty('comind', 'circle-radius', currentRadius);
        }
        
        if (map.getLayer('comind-halo')) {
          map.setPaintProperty('comind-halo', 'circle-radius', currentHaloRadius);
          map.setPaintProperty('comind-halo', 'circle-opacity', haloOpacity);
        }
        
        if (map.getLayer('comind-pulse')) {
          map.setPaintProperty('comind-pulse', 'circle-radius', pulseRadius);
          map.setPaintProperty('comind-pulse', 'circle-opacity', pulseOpacity * 0.4); // Más sutil
        }
        
        blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
      }
      animateComindPulse(0);
      
      const minimap = new maplibregl.Map({
        container: minimapContainerRef.current as HTMLDivElement,
        style: minimapStyleUrl, 
        center: map.getCenter(),
        zoom: map.getZoom() - 3, 
        interactive: false,
        attributionControl: false
      });
      minimapRef.current = minimap;
      
      minimap.on('load', () => {
        minimap.addSource('viewport-bounds', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} } });
        minimap.addLayer({ id: 'viewport-bounds-fill', type: 'fill', source: 'viewport-bounds', paint: { 'fill-color': '#007cbf', 'fill-opacity': 0.2 } });
        minimap.addLayer({ id: 'viewport-bounds-outline', type: 'line', source: 'viewport-bounds', paint: { 'line-color': '#007cbf', 'line-width': 2 } });
      });

      const syncMaps = () => {
        if (!minimapRef.current) return;
        const mainBounds = map.getBounds();
        const boundsPolygon: Feature<Polygon> = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    mainBounds.getSouthWest().toArray(), mainBounds.getNorthWest().toArray(),
                    mainBounds.getNorthEast().toArray(), mainBounds.getSouthEast().toArray(),
                    mainBounds.getSouthWest().toArray()
                ]]
            },
            properties: {}
        };
        const source = minimapRef.current.getSource('viewport-bounds') as GeoJSONSource;
        if (source) { source.setData(boundsPolygon); }
        
        // Actualizar centro y zoom del minimapa
        const mainZoom = map.getZoom();
        const minimapZoom = Math.max(0, mainZoom - 3); // 3 niveles menos, mínimo 0
        
        minimapRef.current.setCenter(map.getCenter());
        minimapRef.current.setZoom(minimapZoom);
      };

      map.on('move', syncMaps);
      map.on('zoom', syncMaps);
      syncMaps();

      attachAllTooltipEvents(map);

      // === Iniciar animación de brújula ===
      if (!compassAnimId.current) {
        compassAnimId.current = requestAnimationFrame(animateCompass);
      }
    });

    return () => {
      if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if(blinkAnimationId.current) cancelAnimationFrame(blinkAnimationId.current);
      if(compassAnimId.current) cancelAnimationFrame(compassAnimId.current);
      compassAnimId.current = null;
      if(mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (minimapRef.current) { minimapRef.current.remove(); minimapRef.current = null; }
      maplibregl.removeProtocol('pmtiles');
    };
  }, [apiKey, attachAllTooltipEvents, drawSingleRouteOnMap, animateCompass, animateTerrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      updateLayerVisibility(map);
    } else {
      map.once('styledata', () => updateLayerVisibility(map));
    }
  }, [layersVisibility, updateLayerVisibility]);

  useEffect(() => {
    if (currentPoints.length === 2) {
      addRouteToMap(currentPoints);
    }
  }, [currentPoints, addRouteToMap]);

  useEffect(() => {
    if (currentLinePoints.length === 2) {
      addLineToMap(currentLinePoints);
    }
  }, [currentLinePoints, addLineToMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const addOrUpdateAnimatedPoint = (id: 'start' | 'end', lngLat: LngLat, isLine: boolean = false) => {
        const prefix = isLine ? 'line-' : '';
        const sourceId = `${id}-point-${prefix}current`;
        const pointFeature: Feature<Point> = { type: 'Feature', geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] }, properties: {} };
        const color = isLine ? '#ff6b35' : '#009f81';
        
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as GeoJSONSource).setData(pointFeature);
        } else {
            map.addSource(sourceId, { type: 'geojson', data: pointFeature });
            map.addLayer({ id: `${sourceId}-pulse`, type: 'circle', source: sourceId, paint: { 'circle-radius': 10, 'circle-color': color, 'circle-opacity': 0.8 }});
            map.addLayer({ id: sourceId, type: 'circle', source: sourceId, paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }});
        }
    };

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (isMeasuring) {
        if (currentPoints.length >= 2) return;
        const newPoint = e.lngLat;
        const pointId = currentPoints.length === 0 ? 'start' : 'end';
        addOrUpdateAnimatedPoint(pointId, newPoint, false);
        setCurrentPoints(prev => [...prev, newPoint]);
      } else if (isMeasuringLine) {
        if (currentLinePoints.length >= 2) return;
        const newPoint = e.lngLat;
        const pointId = currentLinePoints.length === 0 ? 'start' : 'end';
        addOrUpdateAnimatedPoint(pointId, newPoint, true);
        setCurrentLinePoints(prev => [...prev, newPoint]);
      }
    };
    
    if (isMeasuring || isMeasuringLine) {
      map.getCanvas().style.cursor = 'crosshair';
      map.on('click', handleMapClick);
    }

    return () => {
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
      map.off('click', handleMapClick);
    };
  }, [isMeasuring, isMeasuringLine, currentPoints, currentLinePoints, addRouteToMap, addLineToMap]);

  // === Estilos inline mínimos para asegurar botones visibles sin dependencia externa ===
  const controlStackStyle: React.CSSProperties = { position: 'absolute', top: '20px', right: '20px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '10px' };
  const controlButtonStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: 9999, background: '#ffffff', border: '1px solid #e5e7eb', padding: 6, boxShadow: '0 6px 16px rgba(0,0,0,0.08)', cursor: 'pointer' };
  const buttonIconStyle: React.CSSProperties = { width: 24, height: 24, display: 'block' };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div className="custom-popup-container">
        {routesData.map(route => {
          if (!mapRef.current) return null;
          const screenPoint = mapRef.current.project(route.endPoint);
          return (
            <div
              key={route.id}
              className="custom-route-popup"
              style={{
                left: `${screenPoint.x}px`,
                top: `${screenPoint.y}px`,
              }}
            >
              <strong>Distancia:</strong> {route.distance} km<br/>
              <strong>Tiempo:</strong> {route.duration}
            </div>
          );
        })}
        {linesData.map(line => {
          if (!mapRef.current) return null;
          const screenPoint = mapRef.current.project(line.endPoint);
          return (
            <div
              key={`line-${line.id}`}
              className="custom-route-popup"
              style={{
                left: `${screenPoint.x}px`,
                top: `${screenPoint.y}px`,
                backgroundColor: '#ff6b35',
                color: '#ffffff'
              }}
            >
              <strong>Distancia:</strong> {line.distance} km<br/>
              <strong>Tipo:</strong> {line.duration}
            </div>
          );
        })}
      </div>

      <div style={controlStackStyle}>
        <button 
  className={`map-control-button ${isSatellite ? 'active' : ''}`} 
  onClick={toggleSatellite} 
  title={isSatellite ? 'Volver a mapa normal' : 'Ver mapa satelital'} 
  aria-label="Cambiar vista"
  style={controlButtonStyle}
>
  <img 
    src={isSatellite ? 
      `${process.env.PUBLIC_URL}/satelitec.png` : 
      `${process.env.PUBLIC_URL}/satelitebw.png`} 
    alt="Cambiar vista" 
    className="button-icon" 
    style={buttonIconStyle}
  />
</button>

<button 
  className={`map-control-button ${isMeasuring ? 'active' : ''}`} 
  onClick={toggleMeasurement} 
  title={isMeasuring ? 'Terminar medición de ruta' : 'Medir ruta'} 
  aria-label="Medir ruta"
  style={controlButtonStyle}
>
  <img 
    src={isMeasuring ? 
      `${process.env.PUBLIC_URL}/rutac.png` : 
      `${process.env.PUBLIC_URL}/rutabw.png`} 
    alt="Medir ruta" 
    className="button-icon" 
    style={buttonIconStyle}
  />
</button>
        <button 
          className={`map-control-button ${isMeasuringLine ? 'active' : ''}`} 
          onClick={toggleLineMeasurement} 
          title={isMeasuringLine ? 'Terminar medición línea recta' : 'Medir línea recta'} 
          aria-label="Medir línea recta"
          style={controlButtonStyle}
        >
          <div className="button-icon" style={{
            ...buttonIconStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            color: isMeasuringLine ? '#007cbf' : '#6c757d'
          }}>
            ⟷
          </div>
        </button>
        <button 
          className={`map-control-button ${is3D ? 'active' : ''}`} 
          onClick={toggle3D} 
          title={is3D ? 'Desactivar vista 3D' : 'Activar vista 3D'} 
          aria-label="Vista 3D"
          style={controlButtonStyle}
        >
          <img src={get3DIcon(is3D)} alt="Vista 3D" className="button-icon" style={buttonIconStyle}/>
        </button>

        {/* === Brújula interactiva (reemplaza botón de "Restaurar norte") === */}
        <button
          className="map-control-button compass-btn"
          onClick={resetNorth}
          title="Restaurar norte"
          aria-label="Brújula: restablecer norte"
          style={{ ...controlButtonStyle, padding: 0 }}
        >
          <svg
            viewBox="0 0 100 100"
            className="compass-svg"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            {/* Disco */}
            <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#e5e7eb" strokeWidth="4" />
            <circle cx="50" cy="50" r="42" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1" />

            {/* Marca N */}
            <text x="50" y="18" textAnchor="middle" fontSize="12" fontFamily="Inter, system-ui" fill="#6b7280">N</text>

            {/* Aguja (rota para apuntar al norte de pantalla) */}
            <g
              style={{
                transformOrigin: '50px 50px',
                transform: `rotate(${-displayBearing}deg)`
              }}
            >
              {/* Triángulo rojo (norte) */}
              <polygon points="50,12 44,50 56,50" fill="#ef4444" />
              {/* Triángulo gris (sur) */}
              <polygon points="50,88 44,50 56,50" fill="#374151" />
              {/* Centro */}
              <circle cx="50" cy="50" r="4" fill="#111827" />
            </g>
          </svg>
        </button>
      </div>
      
      <div ref={minimapContainerRef} className="minimap-container" />
    </div>
  );
};

export default Map;