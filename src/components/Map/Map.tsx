import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, {
  LngLat,
  LngLatLike,
  Map as MaplibreMap,
  GeoJSONSource,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Feature, Point, Geometry } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { AnimatePresence } from "framer-motion";
import { SplitHandle } from "./SplitHandle";
import InfoBox, { InfoBoxSection } from "../InfoBox/InfoBox";

type MapProps = {
  layersVisibility: { [layerId: string]: boolean };
  layersOpacity: { [layerId: string]: number };
  layerOrder?: string[];
  isDark: boolean;
  onToggleDark: () => void;
  sections: InfoBoxSection[];
};

/*== Propiedad de opacidad por tipo de capa ==*/
const layerOpacityProp: Record<string, string> = {
  // Zonas geológicas
  zonaver: "circle-opacity",
  zonatam: "circle-opacity",
  zonacuencas: "circle-opacity",
  zonaburgos: "circle-opacity",
  zonaas: "circle-opacity",
  zonaap: "circle-opacity",
  // Social / Pueblos Indígenas
  territoriospi: "fill-opacity",
  // comind: "circle-opacity",
  // com_ind: "circle-opacity",
  // Riesgo Hídrico (4 niveles)
  riesgohic: "fill-opacity",
  riesgohia: "fill-opacity",
  riesgohim: "fill-opacity",
  riesgohib: "fill-opacity",
  riesgohc: "fill-opacity",
  riesgoha: "fill-opacity",
  // Provincias prospectivas (12)
  burgos: "fill-opacity",
  chihuahua: "fill-opacity",
  cinturon_plegado_chiapas: "fill-opacity",
  cinturon_plegado_smo: "fill-opacity",
  golfo_california: "fill-opacity",
  golfo_mexico_profundo: "fill-opacity",
  plataforma_yucatan: "fill-opacity",
  sabinas_burro_picachos: "fill-opacity",
  sureste: "fill-opacity",
  tampico_misantla: "fill-opacity",
  veracruz: "fill-opacity",
  vizcaino_purisima_iray: "fill-opacity",
  // Pozos (5 condiciones)
  pozosap: "circle-opacity",
  pozosc: "circle-opacity",
  pozosi: "circle-opacity",
  pozosp: "circle-opacity",
  pozoss: "circle-opacity",
  // Campos de Reserva (3 tipos) + com_ind
  camposresas: "fill-opacity",
  camposresm: "fill-opacity",
  camposrest: "fill-opacity",
  camposres_comind: "circle-opacity",
  areaspotnc: "fill-opacity",
  // Diputados (5 partidos)
  diputados_morena: "fill-opacity",
  diputados_pri: "fill-opacity",
  diputados_pan: "fill-opacity",
  diputados_pvem: "fill-opacity",
  diputados_pt: "fill-opacity",
  // División política — se manejan con expresión feature-state en el useEffect
  ent: "fill-opacity",
  mun: "fill-opacity",
  // Ambiental
  anp: "fill-opacity",
  zonascult: "circle-opacity",
  // Comunidades
  asentamientos: "circle-opacity",
  LocalidadesSedeINPI: "circle-opacity",
};

interface RouteData {
  id: number;
  startPoint: LngLat;
  endPoint: LngLat;
  geometry: Geometry;
  distance: string;
  duration: string;
}

/*== Icono 3D dinámico ==*/
const get3DIcon = (isOn: boolean, dark: boolean = false) => {
  const color = isOn ? "#007cbf" : dark ? "#94a3b8" : "#6c757d";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const API_KEY = "QAha5pFBxf4hGa8Jk5zv";
const BASE_STYLE_URL = "https://www.mapabase.atdt.gob.mx/style_black_3d_places.json";
const BASE_3D_STYLE_URL = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${API_KEY}`;
const SATELLITE_STYLE_URL = `https://api.maptiler.com/maps/satellite/style.json?key=${API_KEY}`;

/*== Estilo inline satelital + terreno 3D (sin calles ni etiquetas) ==*/
const makeSatelliteTerrainStyle = (): any => ({
  version: 8,
  glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${API_KEY}`,
  sources: {
    "sat-tiles": {
      type: "raster",
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${API_KEY}`],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution: "© <a href='https://www.maptiler.com/'>MapTiler</a>",
    },
    "terrain-rgb": {
      type: "raster-dem",
      url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${API_KEY}`,
      tileSize: 256,
    },
  },
  layers: [
    { id: "sat-bg", type: "raster", source: "sat-tiles" },
  ],
  terrain: { source: "terrain-rgb", exaggeration: 1.5 },
});

/*== Devuelve URL o estilo según el estado activo ==*/
const getStyle = (sat: boolean, d3: boolean, _dark: boolean): string | any => {
  if (sat && d3) return makeSatelliteTerrainStyle();
  if (sat) return SATELLITE_STYLE_URL;
  return BASE_STYLE_URL; // negro tanto en 2D como en 3D base
};

/*== @deprecated — usa getStyle ==*/
const getStyleUrl = getStyle;


/*== Añade capas vectoriales desde PMTiles (función pura, sin dependencias de estado) ==*/
const addVectorLayers = (map: maplibregl.Map) => {
  if (!map.getSource("LocalidadesSedeINPI")) {
    map.addSource("LocalidadesSedeINPI", {
      type: "vector",
      url: "pmtiles://data/com_ind_inpi.pmtiles",
    });
  }
  const dark2 = [
    "#1b9e77",
    "#d95f02",
    "#7570b3",
    "#e7298a",
    "#66a61e",
    "#e6ab02",
    "#a6761d",
    "#666666",
  ];
  const pueblosMatch: (string | number)[] = [];
  for (let i = 1; i <= 72; i++) {
    pueblosMatch.push(i, dark2[i % dark2.length]);
  }
  const puebloExpression = [
    "match",
    ["get", "ID_Pueblo"],
    ...pueblosMatch,
    "#ec3db8",
  ] as any;
   if (!map.getSource("asentamientos")) {
    map.addSource("asentamientos", {
      type: "vector",
      url: "pmtiles://data/asent_com_inpi.pmtiles",
    });
  }
  if (!map.getLayer("asentamientos")) {
    map.addLayer({
      id: "asentamientos",
      type: "circle",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      paint: {
        "circle-color": "rgb(255, 118, 38)",
        "circle-radius": 2,
        "circle-opacity": 0.8,
        "circle-stroke-color": "#ffffffff",
        "circle-stroke-width": 0.5,
      },
    });
  }
  if (!map.getLayer("LocalidadesSedeINPI-halo")) {
    map.addLayer({
      id: "LocalidadesSedeINPI-halo",
      type: "circle",
      source: "LocalidadesSedeINPI",
      "source-layer": "com_ind_inpi_tile",
      layout: { visibility: "none" },
      paint: {
        "circle-color": puebloExpression,
        "circle-radius": 3,
        "circle-opacity": 0.15,
        "circle-stroke-width": 0,
      },
    });
  }
  if (!map.getLayer("LocalidadesSedeINPI-pulse")) {
    map.addLayer({
      id: "LocalidadesSedeINPI-pulse",
      type: "circle",
      source: "LocalidadesSedeINPI",
      "source-layer": "com_ind_inpi_tile",
      layout: { visibility: "none" },
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 2,
        "circle-opacity": 0.2,
        "circle-stroke-color": puebloExpression,
        "circle-stroke-width": .5,
      },
    });
  }
  if (!map.getLayer("LocalidadesSedeINPI")) {
    map.addLayer({
      id: "LocalidadesSedeINPI",
      type: "circle",
      source: "LocalidadesSedeINPI",
      "source-layer": "com_ind_inpi_tile",
      paint: {
        "circle-radius": 3.2,
        "circle-color": puebloExpression,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 0.1,
      },
    });
  }
  
    if (!map.getSource("rm")) {
    map.addSource("rm", {
      type: "vector",
      url: "pmtiles://data/rm.pmtiles",
      promoteId: { "rm_tile": "NOMGEO" },
    });
  }
  if (!map.getLayer("rm")) {
    map.addLayer({
      id: "rm",
      type: "fill",
      source: "rm",
      "source-layer": "rm_tile",
      paint: {
        // "fill-color": "#fbff08",
        "fill-opacity": 0.1,
      },
    });
  }
  if (!map.getLayer("rm-border")) {
    map.addLayer({
      id: "rm-border",
      type: "line",
      source: "rm",
      "source-layer": "rm_tile",
      paint: { "line-color": "#fbff00", "line-width": 1, "line-opacity": 0.2 },
    });
  }

  if (!map.getSource("ent")) {
    map.addSource("ent", {
      type: "vector",
      url: "pmtiles://data/00ent.pmtiles",
      promoteId: { "00ent_tile": "NOMGEO" },
    });
  }
  if (!map.getLayer("ent")) {
    map.addLayer({
      id: "ent",
      type: "fill",
      source: "ent",
      "source-layer": "00ent_tile",
      paint: {
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.01] as any,
      },
    });
  }
  if (!map.getLayer("ent-border")) {
    map.addLayer({
      id: "ent-border",
      type: "line",
      source: "ent",
      "source-layer": "00ent_tile",
      paint: { "line-color": "#fdff72", "line-width": 0.8, "line-opacity": 0.7 },
    });
  }
  if (!map.getLayer("ent-click-border")) {
    map.addLayer({
      id: "ent-click-border",
      type: "line",
      source: "ent",
      "source-layer": "00ent_tile",
      paint: {
        "line-color": "#fdff72",
        "line-width": ["case", ["boolean", ["feature-state", "clicked"], false], 3, 0] as any,
        "line-opacity": 0.95,
      },
    });
  }
 
  if (!map.getSource("mun")) {
    map.addSource("mun", {
      type: "vector",
      url: "pmtiles://data/00mun.pmtiles",
      promoteId: { "00mun_tile": "NOMGEO" },
    });
  }
  if (!map.getLayer("mun")) {
    map.addLayer({
      id: "mun",
      type: "fill",
      source: "mun",
      "source-layer": "00mun_tile",
      paint: {
        "fill-color": "#90f2ff",
        "fill-opacity": ["case",
          ["boolean", ["feature-state", "clicked"], false], 0.3,
          0,
        ] as any,
      },
    });
  }

  if (!map.getSource("anp")) {
    map.addSource("anp", {
      type: "vector",
      url: "pmtiles://data/areas_naturales_protegidas_federales.pmtiles",
    });
  }
  if (!map.getLayer("anp")) {
    map.addLayer({
      id: "anp",
      type: "fill",
      source: "anp",
      "source-layer": "areas_naturales_protegidas_federales_tile",
      paint: {
        "fill-color": "#AEEA00",
        "fill-opacity": 0.5,
        "fill-antialias": false,
      },
    });
  }
  if (!map.getSource("areaspotnc")) {
    map.addSource("areaspotnc", {
      type: "vector",
      url: "pmtiles://data/areas_potenciales_no_convencionales_—_Áreas_potenciales_de_recursos_no_convencionales.pmtiles",
    });
  }
  if (!map.getLayer("areaspotnc")) {
    map.addLayer({
      id: "areaspotnc",
      type: "fill",
      source: "areaspotnc",
      "source-layer": "areas_potenciales_no_convencionales_—_Áreas_potenciales_de_recursos_no_convencionales_tile",
      paint: {
        "fill-color": "#FFAB40",
        "fill-opacity": 0.4,
        "fill-antialias": false,
      },
    });
  }
 
  if (!map.getSource("camposres")) {
    map.addSource("camposres", {
      type: "vector",
      url: "pmtiles://data/Campos_(Reservas_01-01-2024).pmtiles",
    });
  }
  // 3 capas filtradas por tipo — campo "CLASIFICACION"
  const camposCapas = [
    { id: "camposresas", tipo: "Aguas someras", color: "#52c0ff" },
    { id: "camposresm",  tipo: "Marino",        color: "#3d1aff" },
    { id: "camposrest",  tipo: "Terrestre",     color: "#00a808" },
  ];
  for (const c of camposCapas) {
    if (!map.getLayer(c.id)) {
      map.addLayer({
        id: c.id,
        type: "fill",
        source: "camposres",
        "source-layer": "Campos_Reservas_01012024_tile",
        filter: ["==", ["get", "ubicacin"], c.tipo],
        paint: { "fill-color": c.color, "fill-opacity": 0.6, "fill-antialias": false },
      });
    }
  }

  if (!map.getSource("zonascult")) {
    map.addSource("zonascult", {
      type: "vector",
      url: "pmtiles://data/cult_zonas_arqueologicas_inah_0922_xy_p.pmtiles",
    });
  }
  if (!map.getLayer("zonascult")) {
    map.addLayer({
      id: "zonascult",
      type: "circle",
      source: "zonascult",
      "source-layer": "cult_zonas_arqueologicas_inah_0922_xy_p_tile",
      paint: {
        "circle-color": "#FFD740",
        "circle-radius": 4,
        "circle-opacity": 0.7,
        "circle-stroke-color": "#bda000",
        "circle-stroke-width": 0.1,
      },
    });
  }

  if (!map.getSource("diputados")) {
    map.addSource("diputados", {
      type: "vector",
      url: "pmtiles://data/diputados_lxvi_fracking_—_Diputados_LXVI_legislatura_con_fracking_potencial.pmtiles",
    });
  }
  // 5 capas filtradas por grupo parlamentario — campo "Grupo_Parlamentario"
  const diputadosCapas = [
    { id: "diputados_morena", partido: "MORENA",  color: "#611232" },
    { id: "diputados_pri",    partido: "PRI",      color: "#ff0707" },
    { id: "diputados_pan",    partido: "PAN",      color: "#3e49ec" },
    { id: "diputados_pvem",   partido: "PVEM",     color: "#01803a" },
    { id: "diputados_pt",     partido: "PT",       color: "#9b0f47" },
  ];
  for (const c of diputadosCapas) {
    if (!map.getLayer(c.id)) {
      map.addLayer({
        id: c.id,
        type: "fill",
        source: "diputados",
        "source-layer": "diputados_lxvi_fracking_—_Diputados_LXVI_legislatura_con_fracking_potencial_tile",
        filter: ["==", ["get", "Grupo_Parlamentario"], c.partido],
        paint: { "fill-color": c.color, "fill-opacity": 0.5, "fill-antialias": false },
      });
    }
  }

  if (!map.getSource("pozosfa")) {
    map.addSource("pozosfa", {
      type: "vector",
      url: "pmtiles://data/pozos_fracking_actuales_—_Pozos_actuales_con_fracking.pmtiles",
    });
  }
  // 5 capas filtradas por estado — campo "estado_act"
  const pozosCapas = [
    { id: "pozosap", condicion: "ABANDONO PERMANENTE", color: "#FF3D00" },
    { id: "pozosc",  condicion: "CERRADO",                    color: "#FFAB40" },
    { id: "pozosi",  condicion: "INACTIVO",                   color: "#FF6D00" },
    { id: "pozosp",  condicion: "PRODUCTOR",                  color: "#1e5b4f" },
    { id: "pozoss",  condicion: "SUSPENDIDO",                  color: "#FFC107" },
  ];
  for (const c of pozosCapas) {
    if (!map.getLayer(c.id)) {
      map.addLayer({
        id: c.id,
        type: "circle",
        source: "pozosfa",
        "source-layer": "pozos_fracking_actuales_—_Pozos_actuales_con_fracking_tile",
        filter: ["==", ["get", "estado_act"], c.condicion],
        paint: {
          "circle-color": c.color,
          "circle-radius": 5,
          "circle-opacity": 0.8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.1,
        },
      });
    }
  }

      if (!map.getSource("camposres_comind")) {
    map.addSource("camposres_comind", {
      type: "vector",
      url: "pmtiles://data/campos_reservas-com_ind.pmtiles",
    });
  }
  if (!map.getLayer("camposres_comind-halo")) {
    map.addLayer({
      id: "camposres_comind-halo",
      type: "circle",
      source: "camposres_comind",
      "source-layer": "campos_reservascom_ind_tile",
      paint: {
        "circle-color": "#D50000",
        "circle-radius": 6,
        "circle-opacity": 0.12,
        "circle-stroke-width": 0,
      },
    });
  }
  if (!map.getLayer("camposres_comind-pulse")) {
    map.addLayer({
      id: "camposres_comind-pulse",
      type: "circle",
      source: "camposres_comind",
      "source-layer": "campos_reservascom_ind_tile",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 6,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#D50000",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer("camposres_comind")) {
    map.addLayer({
      id: "camposres_comind",
      type: "circle",
      source: "camposres_comind",
      "source-layer": "campos_reservascom_ind_tile",
      paint: {
        "circle-color": "#D50000",
        "circle-radius": 4,
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.2,
      },
    });
  }


  if (!map.getSource("provinciaspnc")) {
    map.addSource("provinciaspnc", {
      type: "vector",
      url: "pmtiles://data/provincias_prospectivas_no_convencionales_—_Provincias_con_recursos_prospectivos_no_convencionales.pmtiles",
    });
  }
  const provinciasCapas = [
    { id: "burgos", name: "Burgos", color: "#E57373" },
    { id: "chihuahua", name: "CHIHUAHUA", color: "#90A4AE" },
    { id: "cinturon_plegado_chiapas", name: "CINTURON PLEGADO DE CHIAPAS", color: "#F06292" },
    { id: "cinturon_plegado_smo", name: "CINTURON PLEGADO DE LA SIERRA MADRE ORIENTAL",color: "#BA68C8" },
    { id: "golfo_california", name: "GOLFO DE CALIFORNIA", color: "#4FC3F7" },
    { id: "golfo_mexico_profundo", name: "GOLFO DE MEXICO PROFUNDO", color: "#9575CD" },
    { id: "plataforma_yucatan",  name: "PLATAFORMA DE YUCATAN", color: "#4DB6AC" },
    { id: "sabinas_burro_picachos", name: "Sabinas - Burro - Picachos",  color: "#A1887F" },
    { id: "sureste", name: "Sureste", color: "#7986CB" },
    { id: "tampico_misantla", name: "Tampico - Misantla", color: "#4DD0E1" },
    { id: "veracruz", name: "Veracruz",  color: "#AED581" },
    { id: "vizcaino_purisima_iray", name: "VIZCAINO-LA PURISIMA-IRAY", color: "#81C784" },
  ];
  for (const c of provinciasCapas) {
    if (!map.getLayer(c.id)) {
      map.addLayer({
        id: c.id,
        type: "fill",
        source: "provinciaspnc",
        "source-layer": "provincias_prospectivas_no_convencionales_—_Provincias_con_recursos_prospectivos_no_convencionales_tile",
        filter: ["==", ["get", "nombre"], c.name],
        paint: { "fill-color": c.color, "fill-opacity": 0.4, "fill-antialias": false },
      });
    }
  }

  // Riesgo Hídrico Integrado — 4 capas filtradas por campo RiesgoHídrico
  if (!map.getSource("riesgohi_integrado")) {
    map.addSource("riesgohi_integrado", {
      type: "vector",
      url: "pmtiles://data/riesgo_hidrico_integrado_—_Riesgo_hídrico_integrado_(cuencas_y_acuíferos).pmtiles",
    });
  }
  const riesgoCapas = [
    { id: "riesgohic", valor: "A. Crítico",  color: "#D32F2F" },
    { id: "riesgohia", valor: "B. Alto",      color: "#F57C00" },
    { id: "riesgohim", valor: "C. Moderado",  color: "#F9A825" },
    { id: "riesgohib", valor: "D. Bajo",      color: "#388E3C" },
  ];
  for (const capa of riesgoCapas) {
    if (!map.getLayer(capa.id)) {
      map.addLayer({
        id: capa.id,
        type: "fill",
        source: "riesgohi_integrado",
        "source-layer": "riesgo_hidrico_integrado_—_Riesgo_hídrico_integrado_cuencas_y_acuíferos_tile",
        filter: ["==", ["get", "RiesgoHídrico"], capa.valor],
        paint: {
          "fill-color": capa.color,
          "fill-opacity": 0.6,
          "fill-antialias": false,
        },
      });
    }
  }
       if (!map.getSource("territoriospi")) {
    map.addSource("territoriospi", {
      type: "vector",
      url: "pmtiles://data/territorios_pueblos_ing.pmtiles",
    });
  }
  if (!map.getLayer("territoriospi")) {
    map.addLayer({
      id: "territoriospi",
      type: "fill",
      source: "territoriospi",
      "source-layer": "territorios_pueblos_ing_tile",
      paint: {
        "fill-color": "#FF00E5",
        "fill-opacity": 0.3,
        "fill-antialias": false,
      },
    });
  }
  if (!map.getSource("zonaap")) {
    map.addSource("zonaap", {
      type: "vector",
      url: "pmtiles://data/Zona_Aguas_Profundas.pmtiles",
    });
  }
  if (!map.getLayer("zonaap")) {
    map.addLayer({
      id: "zonaap",
      type: "circle",
      source: "zonaap",
      "source-layer": "Zona_Aguas_Profundas_tile",
      paint: {
        "circle-color": "#0070FF",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
    if (!map.getSource("zonaas")) {
    map.addSource("zonaas", {
      type: "vector",
      url: "pmtiles://data/Zona_Aguas_Someras.pmtiles",
    });
  }
  if (!map.getLayer("zonaas")) {
    map.addLayer({
      id: "zonaas",
      type: "circle",
      source: "zonaas",
      "source-layer": "Zona_Aguas_Someras_tile",
      paint: {
        "circle-color": "#00B0FF",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getSource("zonaburgos")) {
    map.addSource("zonaburgos", {
      type: "vector",
      url: "pmtiles://data/Zona_Burgos.pmtiles",
    });
  }
  if (!map.getLayer("zonaburgos")) {
    map.addLayer({
      id: "zonaburgos",
      type: "circle",
      source: "zonaburgos",
      "source-layer": "Zona_Burgos_tile",
      paint: {
        "circle-color": "#1DE9B6",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getSource("zonacuencas")) {
    map.addSource("zonacuencas", {
      type: "vector",
      url: "pmtiles://data/Zona_Cuencas_del_Sureste.pmtiles",
    });
  }
  if (!map.getLayer("zonacuencas")) {
    map.addLayer({
      id: "zonacuencas",
      type: "circle",
      source: "zonacuencas",
      "source-layer": "Zona_Cuencas_del_Sureste_tile",
      paint: {
        "circle-color": "#7C4DFF",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getSource("zonatam")) {
    map.addSource("zonatam", {
      type: "vector",
      url: "pmtiles://data/Zona_Tampico-Misantla.pmtiles",
    });
  }
  if (!map.getLayer("zonatam")) {
    map.addLayer({
      id: "zonatam",
      type: "circle",
      source: "zonatam",
      "source-layer": "Zona_TampicoMisantla_tile",
      paint: {
        "circle-color": "#3D5AFE",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getSource("zonaver")) {
    map.addSource("zonaver", {
      type: "vector",
      url: "pmtiles://data/Zona_Veracruz.pmtiles",
    });
  }
  if (!map.getLayer("zonaver")) {
    map.addLayer({
      id: "zonaver",
      type: "circle",
      source: "zonaver",
      "source-layer": "Zona_Veracruz_tile",
      paint: {
        "circle-color": "#00F5FF",
        "circle-radius": 4,
        "circle-opacity": 0.5,
        "circle-stroke-color": "#ffffff"
      },
    });
  }

  // Overlay de hover para polígonos — fuente GeoJSON compartida
  if (!map.getSource("hover-polygon")) {
    map.addSource("hover-polygon", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("hover-polygon-fill")) {
    map.addLayer({
      id: "hover-polygon-fill",
      type: "fill",
      source: "hover-polygon",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.22 },
    });
  }
  if (!map.getLayer("hover-polygon-stroke")) {
    map.addLayer({
      id: "hover-polygon-stroke",
      type: "line",
      source: "hover-polygon",
      paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.9 },
    });
  }

  // Highlight de asentamientos vinculados por ID_Pueblo (capa filtrada dinámica)
  if (!map.getLayer("asentamientos-highlight")) {
    map.addLayer({
      id: "asentamientos-highlight",
      type: "circle",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      filter: ["==", ["get", "ID_Pueblo"], -1],
      paint: {
        "circle-color": "#FF7626",
        "circle-radius": 5,
        "circle-opacity": 0.95,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
  }

  // Etiquetas de asentamientos vinculados (visibles sólo cuando hay pin activo)
  if (!map.getLayer("asentamientos-labels")) {
    map.addLayer({
      id: "asentamientos-labels",
      type: "symbol",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      filter: ["==", ["get", "ID_Pueblo"], -1],
      layout: {
        "text-field": ["concat",
          ["coalesce", ["get", "Nombre"], ["get", "Localidad"], ""],
          ["case", ["has", "Población"],
            ["concat", "\nPob: ", ["to-string", ["get", "Población"]]],
            ""
          ]
        ],
        "text-size": 10,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-line-height": 1.4,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      } as any,
      paint: {
        "text-color": "#FF7626",
        "text-halo-color": "#0a0e1a",
        "text-halo-width": 1.5,
      },
    });
  }

  // Asentamientos vinculados al click en camposres_comind
  // Join: asent_com_inpi.ID_Archivo == campos_reservas-com_ind.ID
  if (!map.getLayer("asentamientos-comind-dots")) {
    map.addLayer({
      id: "asentamientos-comind-dots",
      type: "circle",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      filter: ["==", ["literal", 1], 0],
      paint: {
        "circle-color": "#ff7626",
        "circle-radius": 5,
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer("asentamientos-comind-labels")) {
    map.addLayer({
      id: "asentamientos-comind-labels",
      type: "symbol",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      filter: ["==", ["literal", 1], 0],
      layout: {
        "text-field": ["concat",
          ["coalesce", ["get", "Nombre"], ["get", "Localidad"], ""],
          ["case", ["has", "Población"],
            ["concat", "\nPob: ", ["to-string", ["get", "Población"]]],
            ""
          ]
        ] as any,
        "text-size": 11,
        "text-offset": [0, 1.3],
        "text-anchor": "top",
        "text-line-height": 1.3,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      } as any,
      paint: {
        "text-color": "#ffe0b2",
        "text-halo-color": "#0f1117",
        "text-halo-width": 2,
      },
    });
  }

  // Capas auxiliares transparentes para mantener tiles cargados aunque las capas principales estén ocultas.
  // Necesario para que querySourceFeatures funcione en el panel de camposres_comind.
  if (!map.getLayer("_helper-asentamientos")) {
    map.addLayer({
      id: "_helper-asentamientos",
      type: "circle",
      source: "asentamientos",
      "source-layer": "asent_com_inpi_tile",
      paint: { "circle-opacity": 0, "circle-radius": 0 },
    });
  }
  // Overlay de hover/pin para punto LocalidadesSedeINPI
  if (!map.getSource("hover-point")) {
    map.addSource("hover-point", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer("hover-point-glow")) {
    map.addLayer({ id: "hover-point-glow", type: "circle", source: "hover-point",
      paint: { "circle-color": "#ec3db8", "circle-radius": 13, "circle-opacity": 0.28, "circle-stroke-width": 0 } });
  }
  if (!map.getLayer("hover-point")) {
    map.addLayer({ id: "hover-point", type: "circle", source: "hover-point",
      paint: { "circle-color": "#ec3db8", "circle-radius": 7, "circle-opacity": 1,
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  }

};

/*== Crear el componente Map ==*/
const Map: React.FC<MapProps> = ({
  layersVisibility,
  layersOpacity,
  layerOrder,
  isDark,
  onToggleDark,
  sections,
}) => {
  const mapRef = useRef<MaplibreMap | null>(null);
  const map2Ref = useRef<MaplibreMap | null>(null);
  const minimapRef = useRef<MaplibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const container2Ref = useRef<HTMLDivElement | null>(null);
  const minimapContainerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const pinnedPuebloIdRef = useRef<number | null>(null);
  const pinnedComindIdRef = useRef<number | null>(null);
  const [pinnedComindData, setPinnedComindData] = useState<Record<string, any> | null>(null);
  const pinnedComindSetRef = useRef(setPinnedComindData);
  pinnedComindSetRef.current = setPinnedComindData;
  const prevMapViewRef = useRef<{ center: maplibregl.LngLatLike; zoom: number; bearing: number; pitch: number } | null>(null);
  const blinkAnimationId = useRef<number | null>(null);
  const asentPulseId = useRef<number | null>(null);
const routeIdCounter = useRef(0);
  const popupRef = useRef(
    new maplibregl.Popup({ closeButton: false, closeOnClick: false }),
  );

  // === Brújula: estado y refs ===
  const [displayBearing, setDisplayBearing] = useState(0);
  const displayBearingRef = useRef(0);
  const compassAnimId = useRef<number | null>(null);
  const [displayBearing2, setDisplayBearing2] = useState(0);

  /*== Estados del mapa ==*/
  const [isSatellite, setIsSatellite] = useState(false);
  const [splitActive, setSplitActive] = useState(false);
  const [dividerX, setDividerX] = useState(50);

  /*== Panel 2 — estado independiente ==*/
  const [isSatellite2, setIsSatellite2] = useState(false);
  const [is3D2, setIs3D2] = useState(false);
  const [layersVisibility2, setLayersVisibility2] = useState<Record<string, boolean>>({});
  const [layersOpacity2, setLayersOpacity2] = useState<Record<string, number>>({});
  const [sectionOrders2, setSectionOrders2] = useState<string[][]>([]);
  const [isMeasuring2, setIsMeasuring2] = useState(false);
  const [isMeasuringLine2, setIsMeasuringLine2] = useState(false);
  const [currentPoints2, setCurrentPoints2] = useState<LngLatLike[]>([]);
  const [currentLinePoints2, setCurrentLinePoints2] = useState<LngLatLike[]>([]);
  const [routesData2, setRoutesData2] = useState<RouteData[]>([]);
  const [linesData2, setLinesData2] = useState<RouteData[]>([]);
  const routeIdCounter2 = useRef(0);

  // Refs para closures en efectos async del panel 2
  const vis2Ref = useRef<Record<string, boolean>>({});
  vis2Ref.current = layersVisibility2;
  const opa2Ref = useRef<Record<string, number>>({});
  opa2Ref.current = layersOpacity2;
  // Refs para snapshot de panel 1 al abrir el split
  const vis1Ref = useRef(layersVisibility);
  vis1Ref.current = layersVisibility;
  const opa1Ref = useRef(layersOpacity);
  opa1Ref.current = layersOpacity;
  const [logoHovered, setLogoHovered] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isMeasuringLine, setIsMeasuringLine] = useState(false);
  const [is3D, setIs3D] = useState(false);

  // Ref que siempre tiene el isDark más reciente — evita closures desactualizadas
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const [currentPoints, setCurrentPoints] = useState<LngLatLike[]>([]);
  const [currentLinePoints, setCurrentLinePoints] = useState<LngLatLike[]>([]);
  const [routesData, setRoutesData] = useState<RouteData[]>([]);
  const [linesData, setLinesData] = useState<RouteData[]>([]);
  const [, setMapView] = useState<number>(0);

  const isMeasuringRef = useRef(isMeasuring);
  const isMeasuringLineRef = useRef(isMeasuringLine);
  isMeasuringRef.current = isMeasuring;
  isMeasuringLineRef.current = isMeasuringLine;

  const clearCurrentPoints = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = [
      "start-point-current",
      "start-point-current-pulse",
      "end-point-current",
      "end-point-current-pulse",
      "start-point-line-current",
      "start-point-line-current-pulse",
      "end-point-line-current",
      "end-point-line-current-pulse",
    ];
    const sources = [
      "start-point-current",
      "end-point-current",
      "start-point-line-current",
      "end-point-line-current",
    ];
    layers.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    sources.forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  }, []);

  /*== Dibuja una ruta en el mapa ==*/
  const drawSingleRouteOnMap = useCallback(
    (map: MaplibreMap, route: RouteData) => {
      const { id, startPoint, endPoint, geometry } = route;
      if (map.getSource(`route-source-${id}`)) return;
      map.addSource(`route-source-${id}`, {
        type: "geojson",
        data: { type: "Feature", geometry, properties: {} },
      });
      map.addLayer({
        id: `route-layer-${id}`,
        type: "line",
        source: `route-source-${id}`,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#007cbf",
          "line-width": 5,
          "line-opacity": 0.8,
        },
      });
      map.addSource(`start-point-${id}`, {
        type: "geojson",
        data: { type: "Point", coordinates: [startPoint.lng, startPoint.lat] },
      });
      map.addLayer({
        id: `start-point-${id}`,
        type: "circle",
        source: `start-point-${id}`,
        paint: {
          "circle-radius": 6,
          "circle-color": "#007cbf",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addSource(`end-point-${id}`, {
        type: "geojson",
        data: { type: "Point", coordinates: [endPoint.lng, endPoint.lat] },
      });
      map.addLayer({
        id: `end-point-${id}`,
        type: "circle",
        source: `end-point-${id}`,
        paint: {
          "circle-radius": 6,
          "circle-color": "#007cbf",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    },
    [],
  );

  /*== Dibuja una línea recta en el mapa ==*/
  const drawSingleLineOnMap = useCallback(
    (map: MaplibreMap, line: RouteData) => {
      const { id, startPoint, endPoint } = line;
      if (map.getSource(`line-source-${id}`)) return;

      /*== Crear geometría de línea recta ==*/
      const lineGeometry = {
        type: "LineString" as const,
        coordinates: [
          [startPoint.lng, startPoint.lat],
          [endPoint.lng, endPoint.lat],
        ],
      };

      map.addSource(`line-source-${id}`, {
        type: "geojson",
        data: { type: "Feature", geometry: lineGeometry, properties: {} },
      });
      map.addLayer({
        id: `line-layer-${id}`,
        type: "line",
        source: `line-source-${id}`,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff6b35",
          "line-width": 4,
          "line-opacity": 0.8,
          "line-dasharray": [2, 2],
        },
      });
      map.addSource(`start-line-point-${id}`, {
        type: "geojson",
        data: { type: "Point", coordinates: [startPoint.lng, startPoint.lat] },
      });
      map.addLayer({
        id: `start-line-point-${id}`,
        type: "circle",
        source: `start-line-point-${id}`,
        paint: {
          "circle-radius": 6,
          "circle-color": "#ff6b35",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addSource(`end-line-point-${id}`, {
        type: "geojson",
        data: { type: "Point", coordinates: [endPoint.lng, endPoint.lat] },
      });
      map.addLayer({
        id: `end-line-point-${id}`,
        type: "circle",
        source: `end-line-point-${id}`,
        paint: {
          "circle-radius": 6,
          "circle-color": "#ff6b35",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    },
    [],
  );

  /*== Limpia todas las rutas y líneas del mapa ==*/
  const clearAllRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    /*== Limpiar rutas ==*/
    routesData.forEach((route) => {
      const { id } = route;
      if (map.getLayer(`route-layer-${id}`))
        map.removeLayer(`route-layer-${id}`);
      if (map.getSource(`route-source-${id}`))
        map.removeSource(`route-source-${id}`);
      if (map.getLayer(`start-point-${id}`))
        map.removeLayer(`start-point-${id}`);
      if (map.getSource(`start-point-${id}`))
        map.removeSource(`start-point-${id}`);
      if (map.getLayer(`end-point-${id}`)) map.removeLayer(`end-point-${id}`);
      if (map.getSource(`end-point-${id}`)) map.removeSource(`end-point-${id}`);
    });

    /*== Limpiar líneas ==*/
    linesData.forEach((line) => {
      const { id } = line;
      if (map.getLayer(`line-layer-${id}`)) map.removeLayer(`line-layer-${id}`);
      if (map.getSource(`line-source-${id}`))
        map.removeSource(`line-source-${id}`);
      if (map.getLayer(`start-line-point-${id}`))
        map.removeLayer(`start-line-point-${id}`);
      if (map.getSource(`start-line-point-${id}`))
        map.removeSource(`start-line-point-${id}`);
      if (map.getLayer(`end-line-point-${id}`))
        map.removeLayer(`end-line-point-${id}`);
      if (map.getSource(`end-line-point-${id}`))
        map.removeSource(`end-line-point-${id}`);
    });

    setRoutesData([]);
    setLinesData([]);
    clearCurrentPoints();
  }, [routesData, linesData, clearCurrentPoints]);

  /*== Adjunta eventos de tooltip a las capas relevantes ==*/
  const attachAllTooltipEvents = useCallback((map: MaplibreMap) => {
    const popup = popupRef.current;

    const checkMeasurement = () =>
      isMeasuringRef.current || isMeasuringLineRef.current;

    /*== Feature-state hover y clicked para División Política (ent/mun) ==*/
    const divpolHoveredId: Record<string, string | number | null> = { ent: null, mun: null };
    const setDivpolHover = (source: string, sourceLayer: string, id: string | number) => {
      if (divpolHoveredId[source] !== null)
        map.setFeatureState({ source, sourceLayer, id: divpolHoveredId[source]! }, { hover: false });
      divpolHoveredId[source] = id;
      map.setFeatureState({ source, sourceLayer, id }, { hover: true });
    };
    const clearDivpolHover = (source: string, sourceLayer: string) => {
      if (divpolHoveredId[source] !== null) {
        map.setFeatureState({ source, sourceLayer, id: divpolHoveredId[source]! }, { hover: false });
        divpolHoveredId[source] = null;
      }
    };

    const divpolClickedId: Record<string, string | number | null> = { ent: null, mun: null };
    const setDivpolClicked = (source: string, sourceLayer: string, id: string | number) => {
      if (divpolClickedId[source] !== null)
        map.setFeatureState({ source, sourceLayer, id: divpolClickedId[source]! }, { clicked: false });
      divpolClickedId[source] = id;
      map.setFeatureState({ source, sourceLayer, id }, { clicked: true });
    };
    const clearDivpolClicked = (source: string, sourceLayer: string) => {
      if (divpolClickedId[source] !== null) {
        map.setFeatureState({ source, sourceLayer, id: divpolClickedId[source]! }, { clicked: false });
        divpolClickedId[source] = null;
      }
    };

    /*== Helpers de highlight de polígono hover ==*/
    const setHoverPolygon = (geomOrFeatures: any, color: string) => {
      const src = map.getSource("hover-polygon") as GeoJSONSource | undefined;
      if (!src) return;
      const features = Array.isArray(geomOrFeatures)
        ? geomOrFeatures.map((f: any) => ({ type: "Feature", geometry: f.geometry, properties: { color } }))
        : [{ type: "Feature", geometry: geomOrFeatures, properties: { color } }];
      src.setData({ type: "FeatureCollection", features } as any);
    };
    const clearHoverPolygon = () => {
      (map.getSource("hover-polygon") as GeoJSONSource | undefined)
        ?.setData({ type: "FeatureCollection", features: [] } as any);
    };

    /*== Helpers de highlight de punto hover (para capas circle) ==*/
    const setHoverPoint = (geom: any, color: string) => {
      if (pinnedPuebloIdRef.current != null) return;
      try {
        map.setPaintProperty("hover-point", "circle-color", color);
        map.setPaintProperty("hover-point-glow", "circle-color", color);
      } catch {}
      const src = map.getSource("hover-point") as GeoJSONSource | undefined;
      if (src && geom) src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] } as any);
    };
    const clearHoverPoint = () => {
      if (pinnedPuebloIdRef.current != null) return;
      try {
        map.setPaintProperty("hover-point", "circle-color", "#ec3db8");
        map.setPaintProperty("hover-point-glow", "circle-color", "#ec3db8");
      } catch {}
      (map.getSource("hover-point") as GeoJSONSource | undefined)
        ?.setData({ type: "FeatureCollection", features: [] } as any);
    };

    /*== Gestor centralizado: un solo popup combinado para evitar solapamiento ==*/
    const tooltipManager = (() => {
      const hoverReg: Record<string, string> = {};   // hover: posición dinámica
      const pinnedReg: Record<string, string> = {};  // pinned: posición fija al click
      let hoverLngLat: maplibregl.LngLat | null = null;
      let pinnedLngLat: maplibregl.LngLat | null = null;
      const master = new maplibregl.Popup({
        closeButton: false, closeOnClick: false,
        className: "custom-tooltip", maxWidth: "320px",
        offset: [0, -18],
        anchor: "bottom",
      });
      const sep = '<div style="border-top:1px solid rgba(255,255,255,0.08);margin:3px 0"></div>';
      const rebuild = () => {
        const pinned = Object.values(pinnedReg);
        const hover  = Object.values(hoverReg);
        if (!pinned.length && !hover.length) { master.remove(); return; }
        // Posición: si hay hover activo usa esa, si solo hay pin usa la del click
        const lngLat = hover.length && hoverLngLat ? hoverLngLat : pinnedLngLat;
        if (!lngLat) { master.remove(); return; }
        master.setLngLat(lngLat).setHTML([...pinned, ...hover].join(sep)).addTo(map);
      };
      return {
        show:  (key: string, html: string, ll: maplibregl.LngLat) => {
          hoverReg[key] = html; hoverLngLat = ll; rebuild();
        },
        hide:  (key: string) => { delete hoverReg[key]; rebuild(); },
        pin:   (key: string, html: string, ll: maplibregl.LngLat) => {
          pinnedReg[key] = html; pinnedLngLat = ll; rebuild();
        },
        unpin: (key: string) => { delete pinnedReg[key]; rebuild(); },
        hasPinned: (key: string) => key in pinnedReg,
      };
    })();

    /*== Helper para registrar tooltip fluido (mousemove + cursor) ==*/
    const addHoverTooltip = (layerId: string, getHTML: (props: any) => string) => {
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const props = (e.features[0] as any).properties;
        if (props) tooltipManager.show(layerId, getHTML(props), e.lngLat);
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); }
      });
    };

    /*== Tooltip oscuro para camposres_comind ==*/
    const getComindHTML = (p: any) =>
      `<div style="background:#0f1117;border:1px solid #D50000;border-radius:8px;padding:12px 14px;min-width:200px;box-shadow:0 4px 20px rgba(213,0,0,0.35)">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#D50000;box-shadow:0 0 6px #D50000"></span>` +
      `<strong style="color:#ff5252;font-size:13px;letter-spacing:0.3px">${p.NOM_COM ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Estado</span><span>${p.NOM_ENT ?? "—"}</span>` +
      `<span style="color:#7f849c">Municipio</span><span>${p.NOM_MUN ?? "—"}</span>` +
      `<span style="color:#7f849c">Pueblo</span><span>${p.Pueblo ?? "—"}</span>` +
      `<span style="color:#7f849c">Pob. total</span><span style="color:#ff8a80;font-weight:600">${p.POBTOT != null ? Number(p.POBTOT).toLocaleString("es-MX") : "—"}</span>` +
      `</div>` +
      `</div>`;
    map.on("mouseenter", "camposres_comind", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "camposres_comind", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (f.properties) tooltipManager.show("camposres_comind", getComindHTML(f.properties), e.lngLat);
      setHoverPoint(f.geometry, "#D50000");
    });
    map.on("mouseleave", "camposres_comind", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("camposres_comind"); clearHoverPoint(); }
    });

    /*== camposres_comind click: panel React fijo + zoom + asentamientos ==*/
    const NO_MATCH = ["==", ["literal", 1], 0] as any;

    const clearComindHighlight = () => {
      pinnedComindSetRef.current(null);
      pinnedComindIdRef.current = null;
      if (map.getLayer("asentamientos-comind-dots"))
        map.setFilter("asentamientos-comind-dots", NO_MATCH);
      if (map.getLayer("asentamientos-comind-labels"))
        map.setFilter("asentamientos-comind-labels", NO_MATCH);
    };

    map.on("click", "camposres_comind", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      const props = f.properties;
      if (!props) return;

      const comId: number | null = props.ID != null ? Number(props.ID) : null;

      // segundo click en la misma comunidad: desanclar
      if (pinnedComindIdRef.current != null && pinnedComindIdRef.current === comId) {
        clearComindHighlight();
        return;
      }

      pinnedComindIdRef.current = comId;
      tooltipManager.hide("camposres_comind");

      // Mostrar panel React fijo con los datos de la comunidad
      pinnedComindSetRef.current(props);

      // Guardar vista actual antes de volar, para restaurarla al cerrar
      prevMapViewRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };

      // Zoom a las coordenadas de la comunidad para que los asentamientos queden en viewport
      const lat = Number(props.Latitud ?? e.lngLat.lat);
      const lng = Number(props.Longitud ?? e.lngLat.lng);
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });

      // Join directo: asent_com_inpi.ID_Archivo == campos_reservas-com_ind.ID
      if (comId != null) {
        const filter = ["==", ["to-number", ["get", "ID_Archivo"]], comId] as any;
        if (map.getLayer("asentamientos-comind-dots"))
          map.setFilter("asentamientos-comind-dots", filter);
        if (map.getLayer("asentamientos-comind-labels"))
          map.setFilter("asentamientos-comind-labels", filter);

        // Tras el vuelo: contar asentamientos y obtener mayor Población
        const runQuery = () => {
          if (pinnedComindIdRef.current !== comId) return;
          const rawAsent = map.querySourceFeatures("asentamientos", { sourceLayer: "asent_com_inpi_tile" });
          const seen = new Set<string>();
          let maxPob = 0;
          rawAsent.forEach(f => {
            if (Number(f.properties?.ID_Archivo) !== comId) return;
            const key = `${f.properties?.Latitud}|${f.properties?.Longitud}`;
            if (seen.has(key)) return;
            seen.add(key);
            const pob = Number(String(f.properties?.Población ?? "0").replace(/,/g, ""));
            if (pob > maxPob) maxPob = pob;
          });
          pinnedComindSetRef.current(prev =>
            prev ? { ...prev, _asentCount: seen.size, _pobtot: maxPob > 0 ? maxPob : null } : null
          );
        };
        // Esperar a que el flyTo (800ms) termine y los tiles carguen
        setTimeout(runQuery, 1200);
      }
    });

    /*== Tooltips oscuros para Zonas Geológicas y Petroleras ==*/
    const zonaLayers: { id: string; label: string; color: string; glow: string }[] = [
      { id: "zonaap",      label: "Aguas Profundas",    color: "#0070FF", glow: "rgba(0,112,255,0.4)" },
      { id: "zonaas",      label: "Aguas Someras",      color: "#00B0FF", glow: "rgba(0,176,255,0.4)" },
      { id: "zonaburgos",  label: "Burgos",             color: "#1DE9B6", glow: "rgba(29,233,182,0.4)" },
      { id: "zonacuencas", label: "Cuencas del Sureste",color: "#7C4DFF", glow: "rgba(124,77,255,0.4)" },
      { id: "zonatam",     label: "Tampico-Misantla",   color: "#3D5AFE", glow: "rgba(61,90,254,0.4)" },
      { id: "zonaver",     label: "Veracruz",           color: "#00F5FF", glow: "rgba(0,245,255,0.4)" },
    ];
    const getZonaHTML = (p: any, color: string, glow: string, label: string) =>
      `<div style="background:#0a0e1a;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${glow}">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:12px;letter-spacing:0.3px;opacity:0.75">Zona ${label}</strong>` +
      `</div>` +
      `<div style="display:grid; 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Nombre del Campo: </span><span style="font-weight:500">${p.campo ?? p.Campo ?? "—"}</span>` +
      `<span style="color:#7f849c">Tipo de Pozo: </span><span>${p.pozo ?? p.Pozo ?? "—"}</span>` +
      `<span style="color:#7f849c">Entidad: </span><span>${p.entidad ?? p.Entidad ?? "—"}</span>` +
      `<span style="color:#7f849c">Ubicación: </span><span>${p.ubicacin ?? p.ubicacion ?? "—"}</span>` +
      `</div>` +
      `</div>`;
    zonaLayers.forEach(({ id, label, color, glow }) => {
      map.on("mouseenter", id, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", id, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const f = e.features[0] as any;
        if (f.properties) tooltipManager.show(id, getZonaHTML(f.properties, color, glow, label), e.lngLat);
        setHoverPoint(f.geometry, color);
      });
      map.on("mouseleave", id, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(id); clearHoverPoint(); }
      });
    });

    /*== Tooltip oscuro para Territorios Pueblos Indígenas (fill layer) ==*/
    const getTerrpiHTML = (p: any) => {
      const nombre = p.pueblo ?? p.Pueblo ?? p.PUEBLO ?? p.nombre ?? "—";
      return `<div style="background:#0f1117;border:1px solid #FF00E5;border-radius:8px;padding:11px 14px;min-width:160px;box-shadow:0 4px 20px rgba(255,0,229,0.35)">` +
        `<div style="display:flex;align-items:center;gap:8px">` +
        `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#FF00E5;box-shadow:0 0 6px #FF00E5;flex-shrink:0"></span>` +
        `<strong style="color:#f48fb1;font-size:12.5px;letter-spacing:0.2px">${nombre}</strong>` +
        `</div>` +
        `</div>`;
    };
    map.on("mouseenter", "territoriospi", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "territoriospi", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (f.properties) tooltipManager.show("territoriospi", getTerrpiHTML(f.properties), e.lngLat);
    });
    map.on("mouseleave", "territoriospi", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("territoriospi"); clearHoverPolygon(); }
    });

    const comindPopup = (
      e: maplibregl.MapMouseEvent & { features?: Feature[] },
    ) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const props = (e.features[0] as any).properties;
      if (props) {
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>Entidad:</strong> ${props.NOM_ENT}<br/><strong>Municipio:</strong> ${props.NOM_MUN}<br/><strong>Localidad:</strong> ${props.NOM_LOC}<br/><strong>Comunidad:</strong> ${props.NOM_COM}<br/>`,
          )
          .addTo(map);
      }
    };
    /*== Eventos para comind con cursor pointer ==*/
    map.on("click", "comind", comindPopup);
    /*== Cambiar cursor a pointer al entrar ==*/
    map.on("mouseenter", "comind", () => {
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = "pointer";
      }
    });
    /*== Restaurar cursor y quitar popup al salir ==*/
    map.on("mouseleave", "comind", () => {
      if (!checkMeasurement()) {
        map.getCanvas().style.cursor = "";
        popup.remove();
      }
    });

    /*== LocalidadesSedeINPI: tooltip hover + pin + asentamientos vinculados ==*/
    const color_loc = "#ec3db8";
    const pinnedLocPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "custom-tooltip" });

    const getLocHTML = (p: any, pinned = false) => {
      const nombre = p.NOM_COM ?? p.NOM_LOC ?? p.nombre ?? "—";
      const closeBtn = pinned
        ? `<button onclick="window.__closePinnedLoc&&window.__closePinnedLoc()" style="position:absolute;top:8px;right:8px;background:#c0392b;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:13px;font-weight:bold;line-height:20px;text-align:center;padding:0">✕</button>`
        : "";
      return (
        `<div style="position:relative;background:#0f1117;border:1px solid ${color_loc};border-radius:8px;padding:12px ${pinned ? "32px" : "14px"} 12px 14px;min-width:200px;box-shadow:0 4px 20px rgba(236,61,184,0.35)">` +
        closeBtn +
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color_loc};box-shadow:0 0 6px ${color_loc}"></span>` +
        `<strong style="color:#f48fb1;font-size:13px;letter-spacing:0.3px">${nombre}</strong>` +
        `</div>` +
        `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
        `<span style="color:#7f849c">Estado</span><span>${p.NOM_ENT ?? "—"}</span>` +
        `<span style="color:#7f849c">Municipio</span><span>${p.NOM_MUN ?? "—"}</span>` +
        `<span style="color:#7f849c">Pueblo</span><span>${p.Pueblo ?? p.pueblo ?? "—"}</span>` +
        `<span style="color:#f48fb1;font-weight:600">Pob. total</span><span style="color:#f48fb1;font-weight:600">${p.POBTOT != null ? Number(p.POBTOT).toLocaleString("es-MX") : "—"}</span>` +
        `</div></div>`
      );
    };

    const startAsentPulse = () => {
      if (asentPulseId.current) cancelAnimationFrame(asentPulseId.current);
      const animate = (time: number) => {
        asentPulseId.current = requestAnimationFrame(animate);
        const t = (Math.sin(time / 500) + 1) / 2;
        try {
          if (map.getLayer("asentamientos-highlight")) {
            map.setPaintProperty("asentamientos-highlight", "circle-radius", 4 + t * 4);
            map.setPaintProperty("asentamientos-highlight", "circle-opacity", 0.7 + t * 0.25);
          }
        } catch {}
      };
      asentPulseId.current = requestAnimationFrame(animate);
    };

    const stopAsentPulse = () => {
      if (asentPulseId.current) {
        cancelAnimationFrame(asentPulseId.current);
        asentPulseId.current = null;
      }
      try {
        if (map.getLayer("asentamientos-highlight")) {
          map.setPaintProperty("asentamientos-highlight", "circle-radius", 5);
          map.setPaintProperty("asentamientos-highlight", "circle-opacity", 0.95);
        }
      } catch {}
    };

    const setLocHighlight = (geom: any, idPueblo: number | null) => {
      const src = map.getSource("hover-point") as GeoJSONSource | undefined;
      if (src && geom) src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] } as any);
      if (idPueblo != null && map.getLayer("asentamientos-highlight"))
        map.setFilter("asentamientos-highlight", ["==", ["get", "ID_Pueblo"], idPueblo]);
    };
    const clearLocHighlight = () => {
      stopAsentPulse();
      (map.getSource("hover-point") as GeoJSONSource | undefined)
        ?.setData({ type: "FeatureCollection", features: [] } as any);
      if (map.getLayer("asentamientos-highlight"))
        map.setFilter("asentamientos-highlight", ["==", ["get", "ID_Pueblo"], -1]);
      if (map.getLayer("asentamientos-labels"))
        map.setFilter("asentamientos-labels", ["==", ["get", "ID_Pueblo"], -1]);
    };

    const unpinLoc = () => {
      pinnedPuebloIdRef.current = null;
      pinnedLocPopup.remove();
      clearLocHighlight();
      (window as any).__closePinnedLoc = undefined;
    };

    pinnedLocPopup.on("close", () => {
      pinnedPuebloIdRef.current = null;
      clearLocHighlight();
      (window as any).__closePinnedLoc = undefined;
    });

    map.on("mouseenter", "LocalidadesSedeINPI", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "LocalidadesSedeINPI", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      if (pinnedPuebloIdRef.current != null) return; // hay un pin activo, no sobreescribir
      const f = e.features[0] as any;
      const props = f.properties;
      if (!props) return;
      tooltipManager.show("LocalidadesSedeINPI", getLocHTML(props, false), e.lngLat);
      setLocHighlight(f.geometry, props.ID_Pueblo ?? null);
    });
    map.on("mouseleave", "LocalidadesSedeINPI", () => {
      if (checkMeasurement() || pinnedPuebloIdRef.current != null) return;
      map.getCanvas().style.cursor = "";
      tooltipManager.hide("LocalidadesSedeINPI");
      clearLocHighlight();
    });
    map.on("click", "LocalidadesSedeINPI", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      const props = f.properties;
      if (!props) return;
      const idPueblo = props.ID_Pueblo ?? null;
      if (pinnedPuebloIdRef.current === idPueblo) {
        // segundo click en el mismo: desanclar
        unpinLoc();
      } else {
        pinnedPuebloIdRef.current = idPueblo;
        tooltipManager.hide("LocalidadesSedeINPI");
        (window as any).__closePinnedLoc = unpinLoc;
        pinnedLocPopup.setLngLat(e.lngLat).setHTML(getLocHTML(props, true)).addTo(map);
        setLocHighlight(f.geometry, idPueblo);
        // Mostrar labels de asentamientos vinculados y activar pulso
        if (idPueblo != null) {
          if (map.getLayer("asentamientos-labels"))
            map.setFilter("asentamientos-labels", ["==", ["get", "ID_Pueblo"], idPueblo]);
          startAsentPulse();
        }
      }
    });

    /*== Tooltips Provincias Geológicas (12 capas fill) ==*/
    const provinciasColores: Record<string, string> = {
      burgos: "#E57373", chihuahua: "#90A4AE",
      cinturon_plegado_chiapas: "#F06292", cinturon_plegado_smo: "#BA68C8",
      golfo_california: "#4FC3F7", golfo_mexico_profundo: "#9575CD",
      plataforma_yucatan: "#4DB6AC", sabinas_burro_picachos: "#A1887F",
      sureste: "#7986CB", tampico_misantla: "#4DD0E1",
      veracruz: "#AED581", vizcaino_purisima_iray: "#81C784",
    };
    const getProvinciaHTML = (p: any, color: string) =>
      `<div style="background:#0f1117;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:13px;letter-spacing:0.3px">${p.nombre ?? p.NOMBRE ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Situación</span><span>${p.situacin ?? p.situacion ?? p.situación ?? "—"}</span>` +
      `<span style="color:#7f849c">Ubicación</span><span>${p.ubicacin ?? p.ubicacion ?? p.ubicación ?? "—"}</span>` +
      `<span style="color:#7f849c">Área km²</span><span style="color:${color};font-weight:600">${p.rea_km2 != null ? Number(p.rea_km2).toLocaleString("es-MX", { maximumFractionDigits: 0 }) : "—"}</span>` +
      `</div></div>`;

    [
      "burgos", "chihuahua", "cinturon_plegado_chiapas", "cinturon_plegado_smo",
      "golfo_california", "golfo_mexico_profundo", "plataforma_yucatan",
      "sabinas_burro_picachos", "sureste", "tampico_misantla", "veracruz", "vizcaino_purisima_iray",
    ].forEach((layerId) => {
      const color = provinciasColores[layerId] ?? "#ffffff";
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const f = e.features[0] as any;
        if (!f.properties) return;
        tooltipManager.show(layerId, getProvinciaHTML(f.properties, color), e.lngLat);
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); clearHoverPolygon(); }
      });
    });

    /*== Tooltips Diputados LXVI (5 capas fill, por partido) ==*/
    const diputadosTooltipColores: Record<string, string> = {
      diputados_morena: "#611232",
      diputados_pri:    "#ff0707",
      diputados_pan:    "#3e49ec",
      diputados_pvem:   "#01803a",
      diputados_pt:     "#9b0f47",
    };
    const diputadosTooltipPartido: Record<string, string> = {
      diputados_morena: "MORENA",
      diputados_pri:    "PRI",
      diputados_pan:    "PAN",
      diputados_pvem:   "PVEM",
      diputados_pt:     "PT",
    };
    const getDiputadoHTML = (p: any, color: string, partido: string) =>
      `<div style="background:#0f1117;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:12px;letter-spacing:0.3px">${partido}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Diputado/a:</span><span style="font-weight:500">${p.Diputado ?? p.diputado ?? p.Nombre ?? p.nombre ?? "—"}</span>` +
      `<span style="color:#7f849c">Grupo Parlamentario:</span><span>${p.Grupo_Parlamentario ?? p.grupo_parlamentario ?? "—"}</span>` +
      `<span style="color:#7f849c">Entidad:</span><span>${p.Entidad ?? p.entidad ?? p.NOM_ENT ?? "—"}</span>` +
      `<span style="color:#7f849c">Distrito</span><span>${p.Distrito ?? p.distrito ?? p.DISTRITO ?? "—"}</span>` +
      // `<span style="color:#7f849c">No. Pozos No Convencionales:</span><span>${p.Número_de_nuevos_pozos_no_conve!= null ? Number(p.Numero_de_nuevos_pozos_no_conve).toLocaleString("es-MX") : "—"}</span>` +
      // `<span style="color:#7f849c">De no prohibirse el Fracking:</span><span>${p.De_no_prohibirse_el_fracking_en ?? p.De_no_prohibirse_el_fracking_1 ?? "—"}</span>` +
      `</div></div>`;

    ["diputados_morena", "diputados_pri", "diputados_pan", "diputados_pvem", "diputados_pt"].forEach((layerId) => {
      const color = diputadosTooltipColores[layerId];
      const partido = diputadosTooltipPartido[layerId];
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        if (map.getLayoutProperty(layerId, "visibility") !== "visible") return;
        const opacity = map.getPaintProperty(layerId, "fill-opacity") as number ?? 1;
        if (opacity <= 0) return;
        const f = e.features[0] as any;
        if (f.properties) {
          tooltipManager.show(layerId, getDiputadoHTML(f.properties, color, partido), e.lngLat);
        }
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); clearHoverPolygon(); }
      });
    });

    /*== Tooltips Riesgo Hídrico Integrado (4 capas fill) ==*/
    const riesgoColores: Record<string, string> = {
      riesgohic: "#D32F2F", riesgohia: "#F57C00",
      riesgohim: "#F9A825", riesgohib: "#388E3C",
    };
    const getRiesgoHTML = (p: any, color: string) =>
      `<div style="background:#0f1117;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:13px;letter-spacing:0.3px">${p.RiesgoHídrico ?? p.RiesgoHidrico ?? p["RiesgoHídrico"] ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Provincia</span><span>${p.Provincia ?? "—"}</span>` +
      `<span style="color:#7f849c">Entidad</span><span>${p.Entidad_1 ?? p.Entidad ?? "—"}</span>` +
      `</div></div>`;

    ["riesgohic", "riesgohia", "riesgohim", "riesgohib"].forEach((layerId) => {
      const color = riesgoColores[layerId];
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const f = e.features[0] as any;
        if (f.properties) tooltipManager.show(layerId, getRiesgoHTML(f.properties, color), e.lngLat);
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); clearHoverPolygon(); }
      });
    });

    /*== Tooltips Pozos Fracking y No Convencionales (5 capas circle) ==*/
    const pozosColores: Record<string, string> = {
      pozosap: "#FF3D00", pozosc: "#FFAB40",
      pozosi: "#FF6D00", pozosp: "#1e5b4f", pozoss: "#FFC107",
    };
    const getPozoHTML = (p: any, color: string) =>
      `<div style="background:#0f1117;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:220px;box-shadow:0 4px 20px ${color}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:13px;letter-spacing:0.3px">${p.pozo ?? p.Pozo ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Campo</span><span>${p.campo ?? p.Campo ?? "—"}</span>` +
      `<span style="color:#7f849c">Entidad</span><span>${p.entidad ?? p.Entidad ?? "—"}</span>` +
      `<span style="color:#7f849c">Clasificación</span><span>${p.clasificac ?? "—"}</span>` +
      `<span style="color:#7f849c">Estado</span><span style="color:${color};font-weight:600">${p.estado_act ?? "—"}</span>` +
      `<span style="color:#7f849c">Tipo hidrocarb.</span><span>${p.tipo_de_hi ?? "—"}</span>` +
      `<span style="color:#7f849c">Profundidad</span><span>${p.profundida != null ? Number(p.profundida).toLocaleString("es-MX") + " mts" : "—"}</span>` +
      `<span style="color:#7f849c">Trayectoria</span><span>${p.trayectori ?? "—"}</span>` +
      `<span style="color:#7f849c">Zona</span><span>${p.Zona ?? p.zona ?? "—"}</span>` +
      `<span style="color:#7f849c">Fracturamiento</span><span>${p.Fracturami ?? p.fracturami ?? "—"}</span>` +
      `</div></div>`;

    ["pozosap", "pozosc", "pozosi", "pozosp", "pozoss"].forEach((layerId) => {
      const color = pozosColores[layerId];
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const f = e.features[0] as any;
        if (f.properties) tooltipManager.show(layerId, getPozoHTML(f.properties, color), e.lngLat);
        setHoverPoint(f.geometry, color);
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); clearHoverPoint(); }
      });
    });

    /*== Tooltip Áreas Potenciales No Convencionales ==*/
    const color_areas = "#FFAB40";
    const getAreasHTML = (p: any) =>
      `<div style="background:#0f1117;border:1px solid ${color_areas};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color_areas}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color_areas};box-shadow:0 0 6px ${color_areas}"></span>` +
      `<strong style="color:${color_areas};font-size:13px;letter-spacing:0.3px">${p.Provincia ?? p.provincia ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Hectáreas</span><span style="color:${color_areas};font-weight:600">${p.Ha != null ? Number(p.Ha).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ha" : "—"}</span>` +
      `</div></div>`;
    map.on("mouseenter", "areaspotnc", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "areaspotnc", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (f.properties) tooltipManager.show("areaspotnc", getAreasHTML(f.properties), e.lngLat);
    });
    map.on("mouseleave", "areaspotnc", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("areaspotnc"); clearHoverPolygon(); }
    });

    /*== Tooltips Campos de Reserva (3 capas fill) ==*/
    const camposresColores: Record<string, string> = {
      camposresas: "#52c0ff", camposresm: "#3d1aff", camposrest: "#00a808",
    };
    const getCamposresHTML = (p: any, color: string) =>
      `<div style="background:#0f1117;border:1px solid ${color};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>` +
      `<strong style="color:${color};font-size:13px;letter-spacing:0.3px">${p.nombre ?? p.Nombre ?? p.NOMBRE ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Ubicación</span><span>${p.ubicacin ?? p.ubicacion ?? p.Ubicacion ?? "—"}</span>` +
      `<span style="color:#7f849c">Superficie</span><span style="color:${color};font-weight:600">${p.superficie != null ? Number(p.superficie).toLocaleString("es-MX") + " ha" : "—"}</span>` +
      `</div></div>`;

    ["camposresas", "camposresm", "camposrest"].forEach((layerId) => {
      const color = camposresColores[layerId];
      map.on("mouseenter", layerId, () => {
        if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", layerId, (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
        if (checkMeasurement() || !e.features || e.features.length === 0) return;
        const f = e.features[0] as any;
        if (!f.properties) return;
        tooltipManager.show(layerId, getCamposresHTML(f.properties, color), e.lngLat);
      });
      map.on("mouseleave", layerId, () => {
        if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide(layerId); clearHoverPolygon(); }
      });
    });

    /*== Tooltip + hover Áreas Naturales Protegidas ==*/
    const color_anp = "#AEEA00";
    const getAnpHTML = (p: any) =>
      `<div style="background:#0f1117;border:1px solid ${color_anp};border-radius:8px;padding:12px 14px;min-width:220px;box-shadow:0 4px 20px ${color_anp}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color_anp};box-shadow:0 0 6px ${color_anp}"></span>` +
      `<strong style="color:${color_anp};font-size:13px;letter-spacing:0.3px">${p.nombre ?? p.Nombre ?? p.NOMBRE ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Estado</span><span>${p.estado ?? p.Estado ?? "—"}</span>` +
      `<span style="color:#7f849c">Región</span><span>${p.regin ?? p.region ?? p.Region ?? p.región ?? "—"}</span>` +
      `<span style="color:#7f849c">Superficie</span><span style="color:${color_anp};font-weight:600">${p.superficie != null ? Number(p.superficie).toLocaleString("es-MX") + " ha" : "—"}</span>` +
      `</div></div>`;
    map.on("mouseenter", "anp", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "anp", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (!f.properties) return;
      tooltipManager.show("anp", getAnpHTML(f.properties), e.lngLat);
    });
    map.on("mouseleave", "anp", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("anp"); clearHoverPolygon(); }
    });

    /*== Tooltip Asentamientos Humanos (INPI) ==*/
    const color_asent = "#ad4000";
    const getAsentHTML = (p: any) =>
      `<div style="background:#0f1117;border:1px solid ${color_asent};border-radius:8px;padding:12px 14px;min-width:200px;box-shadow:0 4px 20px rgba(255,118,38,0.35)">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color_asent};box-shadow:0 0 6px ${color_asent}"></span>` +
      `<strong style="color:#ffb380;font-size:13px">${p.Nombre ?? p.Localidad ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Categoría</span><span>${p["Categoría"] ?? p.Categoria ?? "—"}</span>` +
      `<span style="color:#7f849c">Municipio</span><span>${p.Municipio ?? "—"}</span>` +
      `<span style="color:#7f849c">Estado</span><span>${p["Entidad fe"] ?? "—"}</span>` +
      `<span style="color:${color_asent};font-weight:600">Población</span><span style="color:${color_asent};font-weight:600">${p["Población"] ?? p.Poblacion ?? "—"}</span>` +
      `</div></div>`;
    map.on("mouseenter", "asentamientos", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "asentamientos", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (f.properties) tooltipManager.show("asentamientos", getAsentHTML(f.properties), e.lngLat);
      setHoverPoint(f.geometry, color_asent);
    });
    map.on("mouseleave", "asentamientos", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("asentamientos"); clearHoverPoint(); }
    });

    /*== Tooltips División Política: Estados y Municipios — click unificado ==*/
    const divpolLayers: { id: string; sourceLayer: string; label: string; color: string }[] = [
      { id: "ent", sourceLayer: "00ent_tile", label: "Estado",    color: "#fdff72" },
      { id: "mun", sourceLayer: "00mun_tile", label: "Municipio", color: "#90f2ff" },
    ];
    const pinnedDivpol: Record<string, string | number | null> = { ent: null, mun: null };

    const unpinAllDivpol = () => {
      divpolLayers.forEach(({ id, sourceLayer }) => {
        clearDivpolHover(id, sourceLayer);
        clearDivpolClicked(id, sourceLayer);
        pinnedDivpol[id] = null;
        tooltipManager.unpin(`_pin_${id}`);
      });
    };
    (window as any).__closeDivpolPin = unpinAllDivpol;

    const getDivpolHTML = (label: string, color: string, p: any) =>
      `<div style="background:#0f1117;border:1px solid ${color}44;border-radius:8px;padding:9px 13px;min-width:160px;box-shadow:0 2px 12px ${color}22;position:relative">` +
      `<button onclick="window.__closeDivpolPin()" style="position:absolute;top:5px;right:7px;background:none;border:none;color:#7f849c;font-size:14px;cursor:pointer;line-height:1" title="Cerrar">✕</button>` +
      `<div style="display:flex;align-items:center;gap:7px">` +
      `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};opacity:0.8"></span>` +
      `<span style="color:#7f849c;font-size:10.5px">${label}</span>` +
      `</div>` +
      `<div style="margin-top:5px;font-size:12.5px;color:${color};font-weight:600">${p.NOMGEO ?? "—"}</div>` +
      `</div>`;

    // Cursor pointer en hover para ambas capas
    divpolLayers.forEach(({ id }) => {
      map.on("mouseenter", id, () => { if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { if (!checkMeasurement()) map.getCanvas().style.cursor = ""; });
    });

    // Click unificado: consulta ambas capas en el punto clickeado
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      if (checkMeasurement()) return;
      type Hit = { id: string; sourceLayer: string; label: string; color: string; f: any };
      const hits: Hit[] = [];
      for (const layer of divpolLayers) {
        if (!map.getLayer(layer.id)) continue;
        const feats = map.queryRenderedFeatures(e.point, { layers: [layer.id] });
        if (feats.length > 0) hits.push({ ...layer, f: feats[0] });
      }
      if (hits.length === 0) return; // no tocó ent ni mun — otros handlers manejan el click

      // Toggle: si todos los hits ya estaban anclados → desanclar todo
      const allSame = hits.every(({ id, f }) => f.id != null && pinnedDivpol[id] === f.id);
      unpinAllDivpol();
      if (allSame) return;

      // Anclar nuevos hits en tooltipManager (integrado con hover popup)
      hits.forEach(({ id, sourceLayer, label, color, f }) => {
        if (f.id != null) {
          pinnedDivpol[id] = f.id;
          setDivpolHover(id, sourceLayer, f.id);
          setDivpolClicked(id, sourceLayer, f.id);
        }
        tooltipManager.pin(`_pin_${id}`, getDivpolHTML(label, color, f.properties), e.lngLat);
      });
    });

    /*== Tooltip Zonas Culturales / Arqueológicas (INAH) ==*/
    const color_cult = "#FFD740";
    const getCultHTML = (p: any) =>
      `<div style="background:#0f1117;border:1px solid ${color_cult};border-radius:8px;padding:12px 14px;min-width:210px;box-shadow:0 4px 20px ${color_cult}55">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
      `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color_cult};box-shadow:0 0 6px ${color_cult}"></span>` +
      `<strong style="color:${color_cult};font-size:13px;letter-spacing:0.3px">${p.nombre ?? p.Nombre ?? "—"}</strong>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px;color:#cdd6f4">` +
      `<span style="color:#7f849c">Estado</span><span>${p.nom_ent ?? p.NOM_ENT ?? "—"}</span>` +
      `<span style="color:#7f849c">Municipio</span><span>${p.nom_mun ?? p.NOM_MUN ?? "—"}</span>` +
      `<span style="color:#7f849c">Localización</span><span>${p.localizacion ?? p.Localizacion ?? p.localización ?? "—"}</span>` +
      `</div></div>`;
    map.on("mouseenter", "zonascult", () => {
      if (!checkMeasurement()) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mousemove", "zonascult", (e: maplibregl.MapMouseEvent & { features?: Feature[] }) => {
      if (checkMeasurement() || !e.features || e.features.length === 0) return;
      const f = e.features[0] as any;
      if (f.properties) tooltipManager.show("zonascult", getCultHTML(f.properties), e.lngLat);
      setHoverPoint(f.geometry, color_cult);
    });
    map.on("mouseleave", "zonascult", () => {
      if (!checkMeasurement()) { map.getCanvas().style.cursor = ""; tooltipManager.hide("zonascult"); clearHoverPoint(); }
    });

  }, []);

  const addRouteToMap = useCallback(
    async (points: LngLatLike[]) => {
      const map = mapRef.current;
      if (!map) return;
      const [startPoint, endPoint] = points.map((p) => LngLat.convert(p));
      const startCoords = `${startPoint.lng},${startPoint.lat}`;
      const endCoords = `${endPoint.lng},${endPoint.lat}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${startCoords};${endCoords}?overview=full&geometries=geojson`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.code !== "Ok" || data.routes.length === 0)
          throw new Error("No se pudo encontrar una ruta.");
        const route = data.routes[0];
        const distance = (route.distance / 1000).toFixed(2);
        const totalSeconds = route.duration;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.round((totalSeconds % 3600) / 60);
        const durationParts: string[] = [];
        if (hours > 0)
          durationParts.push(`${hours} hora${hours > 1 ? "s" : ""}`);
        if (minutes > 0 || durationParts.length === 0)
          durationParts.push(`${minutes} min`);
        const duration = durationParts.join(" ");
        const newRouteData: RouteData = {
          id: routeIdCounter.current++,
          startPoint,
          endPoint,
          geometry: route.geometry,
          distance,
          duration,
        };
        drawSingleRouteOnMap(map, newRouteData);
        setRoutesData((prev) => [...prev, newRouteData]);
      } catch (error) {
        console.error("Error al obtener la ruta:", error);
        alert("No se pudo calcular la ruta. Por favor, inténtelo de nuevo.");
      } finally {
        clearCurrentPoints();
        setCurrentPoints([]);
      }
    },
    [clearCurrentPoints, drawSingleRouteOnMap],
  );

  const addLineToMap = useCallback(
    (points: LngLatLike[]) => {
      const map = mapRef.current;
      if (!map) return;

      const [startPoint, endPoint] = points.map((p) => LngLat.convert(p));

      /*== Calcular distancia en línea recta usando fórmula de Haversine ==*/
      const calculateDistance = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
      ) => {
        const R = 6371; // Radio de la Tierra en km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      /*== Fin cálculo de distancia ==*/
      const distanceKm = calculateDistance(
        startPoint.lat,
        startPoint.lng,
        endPoint.lat,
        endPoint.lng,
      );
      const distance = distanceKm.toFixed(2);

      const newLineData: RouteData = {
        id: routeIdCounter.current++,
        startPoint,
        endPoint,
        geometry: {
          type: "LineString",
          coordinates: [
            [startPoint.lng, startPoint.lat],
            [endPoint.lng, endPoint.lat],
          ],
        },
        distance,
        duration: "Línea recta",
      };

      drawSingleLineOnMap(map, newLineData);
      setLinesData((prev) => [...prev, newLineData]);
      clearCurrentPoints();
      setCurrentLinePoints([]);
    },
    [clearCurrentPoints, drawSingleLineOnMap],
  );

  const updateLayerVisibility = useCallback(
    (map: maplibregl.Map) => {
      Object.entries(layersVisibility).forEach(([id, visible]) => {
        const vis = visible ? "visible" : "none";
        try {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", vis);
          }
          // También controlar la visibilidad del halo y pulso de comind
          if (id === "comind") {
            if (map.getLayer("comind-halo")) {
              map.setLayoutProperty("comind-halo", "visibility", vis);
            }
            if (map.getLayer("comind-pulse")) {
              map.setLayoutProperty("comind-pulse", "visibility", vis);
            }
          }
          if (id === "ent") {
            if (map.getLayer("ent-click-border")) map.setLayoutProperty("ent-click-border", "visibility", vis);
            if (map.getLayer("ent-border")) map.setLayoutProperty("ent-border", "visibility", vis);
          }
          if (id === "camposres_comind") {
            ["camposres_comind-halo", "camposres_comind-pulse"].forEach((sub) => {
              if (map.getLayer(sub)) map.setLayoutProperty(sub, "visibility", vis);
            });
          }
          if (id === "LocalidadesSedeINPI") {
            ["LocalidadesSedeINPI-halo", "LocalidadesSedeINPI-pulse"].forEach((sub) => {
              if (map.getLayer(sub)) map.setLayoutProperty(sub, "visibility", vis);
            });
          }
        } catch {}
      });
      // Capas de utilidad (hover, rutas) → por encima de los datos
      [
        "ent-click-border",
        "hover-polygon-fill", "hover-polygon-stroke",
        "hover-point-glow", "hover-point",
        "asentamientos-highlight", "asentamientos-labels",
        "asentamientos-comind-dots", "asentamientos-comind-labels",
      ].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });
      // Mantener camposres_comind siempre encima de todas las capas
      ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });
    },
    [layersVisibility],
  );

  // Función animateTerrainExaggeration para crear efecto de realce gradual
  const animateTerrainExaggeration = useCallback(
    (map: any, targetExaggeration: number, duration: number = 2000) => {
      const startTime = Date.now();
      const startExaggeration = 0;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function para suavizar la animación
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        const currentExaggeration =
          startExaggeration +
          (targetExaggeration - startExaggeration) * easeOutQuart;

        try {
          if (map.getTerrain()) {
            map.setTerrain({
              source: "terrain-rgb",
              exaggeration: currentExaggeration,
            });
          }
        } catch (error) {
          console.warn("Error animating terrain exaggeration:", error);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    },
    [],
  );

  // Función toggle3D corregida para funcionar como switch
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentIsSatellite = isSatellite; // Estado del switch satelital
    const newIs3D = !is3D; // Nuevo estado del switch 3D

    // Limpiar efectos 3D actuales
    if (map.getTerrain()) {
      map.setTerrain(null);
    }
    if (map.getLayer("sky")) {
      map.removeLayer("sky");
    }

    setIs3D(newIs3D);

    const newStyle = getStyle(currentIsSatellite, newIs3D, isDarkRef.current);
    const isSatTerrain = currentIsSatellite && newIs3D;

    // Siempre cambiar estilo (sat+3D usa inline sin calles)
    map.setStyle(newStyle, { diff: false });

    map.once("styledata", () => {
      addVectorLayers(map);

      updateLayerVisibility(map);
        routesData.forEach((route) => drawSingleRouteOnMap(map, route));
        linesData.forEach((line) => drawSingleLineOnMap(map, line));
        attachAllTooltipEvents(map);

        // Reiniciar animación comind
        if (blinkAnimationId.current) cancelAnimationFrame(blinkAnimationId.current);
        const animateComindPulse = (timestamp: number) => {
          blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
          try {
            const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
            const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
            const pulseOpacity = 1 - pulseRadius / 25;
            const haloOpacity = 0.1 + 0.15 * pulseProgress;
            const currentRadius = 8 + 4 * pulseProgress;
            const currentHaloRadius = 12 + 6 * pulseProgress;
            if (map.getLayer("comind")) map.setPaintProperty("comind", "circle-radius", currentRadius);
            if (map.getLayer("comind-halo")) {
              map.setPaintProperty("comind-halo", "circle-radius", currentHaloRadius);
              map.setPaintProperty("comind-halo", "circle-opacity", haloOpacity);
            }
            if (map.getLayer("comind-pulse")) {
              map.setPaintProperty("comind-pulse", "circle-radius", pulseRadius);
              map.setPaintProperty("comind-pulse", "circle-opacity", pulseOpacity * 0.4);
            }
            if (map.getLayer("camposres_comind")) map.setPaintProperty("camposres_comind", "circle-radius", 4 + 2 * pulseProgress);
            if (map.getLayer("camposres_comind-halo")) {
              map.setPaintProperty("camposres_comind-halo", "circle-radius", 10 + 6 * pulseProgress);
              map.setPaintProperty("camposres_comind-halo", "circle-opacity", 0.08 + 0.12 * pulseProgress);
            }
            if (map.getLayer("camposres_comind-pulse")) {
              map.setPaintProperty("camposres_comind-pulse", "circle-radius", pulseRadius * 0.9);
              map.setPaintProperty("camposres_comind-pulse", "circle-stroke-opacity", pulseOpacity * 0.6);
            }
            if (map.getLayer("LocalidadesSedeINPI")) map.setPaintProperty("LocalidadesSedeINPI", "circle-radius", 3.2 + 1.2 * pulseProgress);
            if (map.getLayer("LocalidadesSedeINPI-halo")) {
              map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-radius", 9 + 5 * pulseProgress);
              map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-opacity", 0.1 + 0.12 * pulseProgress);
            }
            if (map.getLayer("LocalidadesSedeINPI-pulse")) {
              map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-radius", pulseRadius * 0.7);
              map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-stroke-opacity", pulseOpacity * 0.55);
            }
          } catch {}
        };
        animateComindPulse(0);

        // Restaurar posición
        map.jumpTo({
          center: currentCenter,
          zoom: currentZoom,
          bearing: currentBearing,
          pitch: 0,
        });

        // sat+3D usa inline: terreno ya está en el spec; solo añadir sky + pitch
        // sat solo o base: applyOrRemove3DEffects gestiona terreno y sky
        if (!isSatTerrain) {
          setTimeout(() => applyOrRemove3DEffects(map, newIs3D, currentIsSatellite), 200);
        } else if (newIs3D) {
          setTimeout(() => {
            if (!map.getLayer("sky")) {
              map.addLayer({ id: "sky", type: "sky", paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 0.0], "sky-atmosphere-sun-intensity": 5 } } as any);
            }
            if (map.getPitch() < 5) {
              map.easeTo({ pitch: 65, duration: 1500, easing: (t: number) => t * (2 - t) });
            }
          }, 200);
        }
      });
  };

  // Función helper para aplicar o quitar efectos 3D
  const applyOrRemove3DEffects = (
    map: any,
    is3DActive: boolean,
    isSatelliteActive: boolean,
  ) => {
    if (is3DActive) {
      // Aplicar efectos 3D
      try {
        if (!map.getSource("terrain-rgb")) {
          map.addSource("terrain-rgb", {
            type: "raster-dem",
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${API_KEY}`,
            tileSize: 256,
          });
        }

        const exaggeration = isSatelliteActive ? 1.2 : 1.5;
        const targetPitch = isSatelliteActive ? 60 : 70;
        const sunIntensity = isSatelliteActive ? 3 : 5;

        // Iniciar con terreno sin exageración y animarlo
        map.setTerrain({
          source: "terrain-rgb",
          exaggeration: 0.1, // Empezar con valor mínimo
        });

        // Animar la exageración del terreno
        animateTerrainExaggeration(map, exaggeration, 2500);

        if (!map.getLayer("sky")) {
          const skyPaint = isSatelliteActive
            ? { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 0.0], "sky-atmosphere-sun-intensity": sunIntensity }
            : { "sky-type": "gradient", "sky-gradient": ["interpolate", ["linear"], ["sky-radial-progress"], 0.8, "rgba(0,0,0,1)", 1, "rgba(0,0,0,1)"], "sky-gradient-center": [0, 0] };
          map.addLayer({ id: "sky", type: "sky", paint: skyPaint } as any);
        }

        // Animar inclinación solo si está plano
        const currentPitch = map.getPitch();
        if (currentPitch < 5) {
          map.easeTo({
            pitch: targetPitch,
            bearing: map.getBearing(),
            duration: 1500,
            easing: (t: number) => t * (2 - t),
          });
        }
      } catch (error) {
        console.warn("Error aplicando efectos 3D:", error);
      }
    } else {
      // Quitar efectos 3D
      try {
        const currentPitch = map.getPitch();
        if (currentPitch > 0) {
          map
            .easeTo({
              pitch: 0,
              duration: 1200,
              easing: (t: number) => t * (2 - t),
            })
            .once("moveend", () => {
              if (map.getLayer("sky")) {
                map.removeLayer("sky");
              }
              if (map.getTerrain()) {
                map.setTerrain(null);
              }
            });
        } else {
          if (map.getLayer("sky")) {
            map.removeLayer("sky");
          }
          if (map.getTerrain()) {
            map.setTerrain(null);
          }
        }
      } catch (error) {
        console.warn("Error quitando efectos 3D:", error);
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
      pitch: is3D ? map.getPitch() : 0,
      duration: 1000,
      easing: (t: number) => t * (2 - t),
    });
  };

  const resetNorth2 = () => {
    const map2 = map2Ref.current;
    if (!map2) return;
    map2.easeTo({ bearing: 0, pitch: is3D2 ? map2.getPitch() : 0, duration: 1000, easing: (t) => t * (2 - t) });
  };

  const toggle3D2 = () => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const currentCenter = map2.getCenter();
    const currentZoom = map2.getZoom();
    const currentBearing = map2.getBearing();
    const newIs3D = !is3D2;
    if (map2.getTerrain()) map2.setTerrain(null);
    if (map2.getLayer("sky")) map2.removeLayer("sky");
    setIs3D2(newIs3D);
    const needsStyleChange = !isSatellite2;
    if (needsStyleChange) {
      map2.setStyle(getStyleUrl(isSatellite2, newIs3D, isDark), { diff: false });
      map2.once("styledata", () => {
        addVectorLayers(map2);
        applyPanel2State(map2);
        map2.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: currentBearing, pitch: 0 });
        setTimeout(() => applyOrRemove3DEffects(map2, newIs3D, isSatellite2), 200);
      });
    } else {
      setTimeout(() => applyOrRemove3DEffects(map2, newIs3D, isSatellite2), 100);
    }
  };

  const toggleSatellite2 = () => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const currentCenter = map2.getCenter();
    const currentZoom = map2.getZoom();
    const currentBearing = map2.getBearing();
    const currentPitch = map2.getPitch();
    const newIsSatellite = !isSatellite2;
    if (map2.getTerrain()) map2.setTerrain(null);
    if (map2.getLayer("sky")) map2.removeLayer("sky");
    setIsSatellite2(newIsSatellite);
    map2.setStyle(getStyleUrl(newIsSatellite, is3D2, isDark), { diff: false });
    map2.once("styledata", () => {
      addVectorLayers(map2);
      applyPanel2State(map2);
      routesData2.forEach((r) => drawSingleRouteOnMap(map2, r));
      linesData2.forEach((l) => drawSingleLineOnMap(map2, l));
      map2.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: currentBearing, pitch: currentPitch });
      if (is3D2) setTimeout(() => applyOrRemove3DEffects(map2, true, newIsSatellite), 200);
    });
  };

  const clearCurrentPoints2 = useCallback(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    ["start-point-2-current","start-point-2-current-pulse","end-point-2-current","end-point-2-current-pulse",
     "start-point-2-line-current","start-point-2-line-current-pulse","end-point-2-current","end-point-2-current-pulse"]
      .forEach((id) => { try { if (map2.getLayer(id)) map2.removeLayer(id); } catch {} });
    ["start-point-2-current","end-point-2-current","start-point-2-line-current","end-point-2-line-current"]
      .forEach((id) => { try { if (map2.getSource(id)) map2.removeSource(id); } catch {} });
  }, []);

  const clearAllRoutes2 = useCallback(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    setRoutesData2((prev) => {
      prev.forEach(({ id }) => {
        [`route-layer-${id}`,`start-point-${id}`,`end-point-${id}`].forEach((l) => { try { if (map2.getLayer(l)) map2.removeLayer(l); } catch {} });
        [`route-source-${id}`,`start-point-${id}`,`end-point-${id}`].forEach((s) => { try { if (map2.getSource(s)) map2.removeSource(s); } catch {} });
      });
      return [];
    });
    setLinesData2((prev) => {
      prev.forEach(({ id }) => {
        [`line-layer-${id}`,`start-line-${id}`,`end-line-${id}`].forEach((l) => { try { if (map2.getLayer(l)) map2.removeLayer(l); } catch {} });
        [`line-source-${id}`,`start-line-${id}`,`end-line-${id}`].forEach((s) => { try { if (map2.getSource(s)) map2.removeSource(s); } catch {} });
      });
      return [];
    });
    clearCurrentPoints2();
  }, [clearCurrentPoints2]);

  const addRouteToMap2 = useCallback(async (points: LngLatLike[]) => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const [startPoint, endPoint] = points.map((p) => LngLat.convert(p));
    const url = `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes.length) throw new Error();
      const route = data.routes[0];
      const distance = (route.distance / 1000).toFixed(2);
      const h = Math.floor(route.duration / 3600);
      const m = Math.round((route.duration % 3600) / 60);
      const duration = [h > 0 ? `${h}h` : "", m > 0 ? `${m}min` : ""].filter(Boolean).join(" ") || "0min";
      const newRoute: RouteData = { id: routeIdCounter2.current++, startPoint, endPoint, geometry: route.geometry, distance, duration };
      drawSingleRouteOnMap(map2, newRoute);
      setRoutesData2((prev) => [...prev, newRoute]);
    } catch {
      alert("No se pudo calcular la ruta.");
    } finally {
      clearCurrentPoints2();
      setCurrentPoints2([]);
    }
  }, [clearCurrentPoints2, drawSingleRouteOnMap]);

  const addLineToMap2 = useCallback((points: LngLatLike[]) => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const [startPoint, endPoint] = points.map((p) => LngLat.convert(p));
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(endPoint.lat - startPoint.lat);
    const dLon = toRad(endPoint.lng - startPoint.lng);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(startPoint.lat)) * Math.cos(toRad(endPoint.lat)) * Math.sin(dLon/2)**2;
    const distance = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
    const newLine: RouteData = {
      id: routeIdCounter2.current++, startPoint, endPoint,
      geometry: { type: "LineString", coordinates: [[startPoint.lng, startPoint.lat],[endPoint.lng, endPoint.lat]] },
      distance, duration: "Línea recta",
    };
    drawSingleLineOnMap(map2, newLine);
    setLinesData2((prev) => [...prev, newLine]);
    clearCurrentPoints2();
    setCurrentLinePoints2([]);
  }, [clearCurrentPoints2, drawSingleLineOnMap]);

  /*== Medición panel 2 — click handler ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const addPoint2 = (e: maplibregl.MapMouseEvent) => {
      if (isMeasuring2) {
        if (currentPoints2.length >= 2) return;
        const pt = e.lngLat;
        const pid = currentPoints2.length === 0 ? "start-point-2-current" : "end-point-2-current";
        const feat = { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [pt.lng, pt.lat] }, properties: {} };
        if (map2.getSource(pid)) (map2.getSource(pid) as GeoJSONSource).setData(feat);
        else {
          map2.addSource(pid, { type: "geojson", data: feat });
          map2.addLayer({ id: `${pid}-pulse`, type: "circle", source: pid, paint: { "circle-radius": 10, "circle-color": "#009f81", "circle-opacity": 0.8 } });
          map2.addLayer({ id: pid, type: "circle", source: pid, paint: { "circle-radius": 6, "circle-color": "#009f81", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
        }
        setCurrentPoints2((prev) => [...prev, pt]);
      } else if (isMeasuringLine2) {
        if (currentLinePoints2.length >= 2) return;
        const pt = e.lngLat;
        const pid = currentLinePoints2.length === 0 ? "start-point-2-line-current" : "end-point-2-line-current";
        const feat = { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [pt.lng, pt.lat] }, properties: {} };
        if (map2.getSource(pid)) (map2.getSource(pid) as GeoJSONSource).setData(feat);
        else {
          map2.addSource(pid, { type: "geojson", data: feat });
          map2.addLayer({ id: `${pid}-pulse`, type: "circle", source: pid, paint: { "circle-radius": 10, "circle-color": "#ff6b35", "circle-opacity": 0.8 } });
          map2.addLayer({ id: pid, type: "circle", source: pid, paint: { "circle-radius": 6, "circle-color": "#ff6b35", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
        }
        setCurrentLinePoints2((prev) => [...prev, pt]);
      }
    };
    if (isMeasuring2 || isMeasuringLine2) {
      map2.getCanvas().style.cursor = "crosshair";
      map2.on("click", addPoint2);
    }
    return () => {
      if (map2.getCanvas()) map2.getCanvas().style.cursor = "";
      map2.off("click", addPoint2);
    };
  }, [isMeasuring2, isMeasuringLine2, currentPoints2, currentLinePoints2]);

  useEffect(() => {
    if (currentPoints2.length === 2) addRouteToMap2(currentPoints2);
  }, [currentPoints2, addRouteToMap2]);

  useEffect(() => {
    if (currentLinePoints2.length === 2) addLineToMap2(currentLinePoints2);
  }, [currentLinePoints2, addLineToMap2]);

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
    if (map.getLayer("sky")) map.removeLayer("sky");

    setIsSatellite(newIsSatellite);

    /*== Elección del estilo ==*/
    const newStyleUrl = getStyleUrl(newIsSatellite, was3D, isDarkRef.current);

    map.setStyle(newStyleUrl, { diff: false });

    map.once("styledata", () => {
      addVectorLayers(map);
      updateLayerVisibility(map);
      routesData.forEach((route) => drawSingleRouteOnMap(map, route));
      linesData.forEach((line) => drawSingleLineOnMap(map, line));
      attachAllTooltipEvents(map);

      // Reiniciar animación de pulso
      if (blinkAnimationId.current) cancelAnimationFrame(blinkAnimationId.current);
      const animateComindPulse = (timestamp: number) => {
        blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
        try {
          const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
          const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
          const pulseOpacity = 1 - pulseRadius / 25;
          const haloOpacity = 0.1 + 0.15 * pulseProgress;
          const currentRadius = 8 + 4 * pulseProgress;
          const currentHaloRadius = 12 + 6 * pulseProgress;
          if (map.getLayer("comind")) map.setPaintProperty("comind", "circle-radius", currentRadius);
          if (map.getLayer("comind-halo")) {
            map.setPaintProperty("comind-halo", "circle-radius", currentHaloRadius);
            map.setPaintProperty("comind-halo", "circle-opacity", haloOpacity);
          }
          if (map.getLayer("comind-pulse")) {
            map.setPaintProperty("comind-pulse", "circle-radius", pulseRadius);
            map.setPaintProperty("comind-pulse", "circle-opacity", pulseOpacity * 0.4);
          }
          if (map.getLayer("camposres_comind")) map.setPaintProperty("camposres_comind", "circle-radius", 4 + 2 * pulseProgress);
          if (map.getLayer("camposres_comind-halo")) {
            map.setPaintProperty("camposres_comind-halo", "circle-radius", 10 + 6 * pulseProgress);
            map.setPaintProperty("camposres_comind-halo", "circle-opacity", 0.08 + 0.12 * pulseProgress);
          }
          if (map.getLayer("camposres_comind-pulse")) {
            map.setPaintProperty("camposres_comind-pulse", "circle-radius", pulseRadius * 0.9);
            map.setPaintProperty("camposres_comind-pulse", "circle-stroke-opacity", pulseOpacity * 0.6);
          }
          if (map.getLayer("LocalidadesSedeINPI")) map.setPaintProperty("LocalidadesSedeINPI", "circle-radius", 3.2 + 1.2 * pulseProgress);
          if (map.getLayer("LocalidadesSedeINPI-halo")) {
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-radius", 9 + 5 * pulseProgress);
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-opacity", 0.1 + 0.12 * pulseProgress);
          }
          if (map.getLayer("LocalidadesSedeINPI-pulse")) {
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-radius", pulseRadius * 0.7);
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-stroke-opacity", pulseOpacity * 0.55);
          }
        } catch {}
      };
      animateComindPulse(0);

      // Restaurar posición con el pitch original
      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: was3D ? currentPitch : 0, // Mantener pitch si estaba en 3D, sino 0
      });

      /*== REAPLICAR EFECTOS 3D SIN PITCH ANIMATION SI YA ESTABA EN 3D ==*/
      if (was3D) {
        // Asegurar fuente de terreno
        if (!map.getSource("terrain-rgb")) {
          map.addSource("terrain-rgb", {
            type: "raster-dem",
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${API_KEY}`,
            tileSize: 256,
          });
        }

        const exaggeration = newIsSatellite ? 1.2 : 1.5;
        const sunIntensity = newIsSatellite ? 3 : 5;

        // Aplicar terreno con animación de exageración
        setTimeout(() => {
          map.setTerrain({ source: "terrain-rgb", exaggeration: 0.1 });
          animateTerrainExaggeration(map, exaggeration, 1500);
        }, 100);

        if (!map.getLayer("sky")) {
          map.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0, 0],
              "sky-atmosphere-sun-intensity": sunIntensity,
            },
          } as any);
        }
      }
    });
  };

  const toggleDark = () => {
    const map = mapRef.current;
    if (!map) return;

    const newIsDark = !isDarkRef.current;
    onToggleDark();
    isDarkRef.current = newIsDark; // actualizar ref antes de cualquier uso

    // Satelital o 3D activos: mantener su estilo, solo guardar estado
    if (isSatellite || is3D) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();

    map.once("styledata", () => {
      addVectorLayers(map);
      updateLayerVisibility(map);
      routesData.forEach((route) => drawSingleRouteOnMap(map, route));
      linesData.forEach((line) => drawSingleLineOnMap(map, line));
      attachAllTooltipEvents(map);

      if (blinkAnimationId.current) cancelAnimationFrame(blinkAnimationId.current);
      const animateComindPulse = (timestamp: number) => {
        blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
        try {
          const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
          const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
          const pulseOpacity = 1 - pulseRadius / 25;
          const haloOpacity = 0.1 + 0.15 * pulseProgress;
          const currentRadius = 8 + 4 * pulseProgress;
          const currentHaloRadius = 12 + 6 * pulseProgress;
          if (map.getLayer("comind")) map.setPaintProperty("comind", "circle-radius", currentRadius);
          if (map.getLayer("comind-halo")) {
            map.setPaintProperty("comind-halo", "circle-radius", currentHaloRadius);
            map.setPaintProperty("comind-halo", "circle-opacity", haloOpacity);
          }
          if (map.getLayer("comind-pulse")) {
            map.setPaintProperty("comind-pulse", "circle-radius", pulseRadius);
            map.setPaintProperty("comind-pulse", "circle-opacity", pulseOpacity * 0.4);
          }
          if (map.getLayer("camposres_comind")) map.setPaintProperty("camposres_comind", "circle-radius", 4 + 2 * pulseProgress);
          if (map.getLayer("camposres_comind-halo")) {
            map.setPaintProperty("camposres_comind-halo", "circle-radius", 10 + 6 * pulseProgress);
            map.setPaintProperty("camposres_comind-halo", "circle-opacity", 0.08 + 0.12 * pulseProgress);
          }
          if (map.getLayer("camposres_comind-pulse")) {
            map.setPaintProperty("camposres_comind-pulse", "circle-radius", pulseRadius * 0.9);
            map.setPaintProperty("camposres_comind-pulse", "circle-stroke-opacity", pulseOpacity * 0.6);
          }
          if (map.getLayer("LocalidadesSedeINPI")) map.setPaintProperty("LocalidadesSedeINPI", "circle-radius", 3.2 + 1.2 * pulseProgress);
          if (map.getLayer("LocalidadesSedeINPI-halo")) {
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-radius", 9 + 5 * pulseProgress);
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-opacity", 0.1 + 0.12 * pulseProgress);
          }
          if (map.getLayer("LocalidadesSedeINPI-pulse")) {
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-radius", pulseRadius * 0.7);
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-stroke-opacity", pulseOpacity * 0.55);
          }
        } catch {}
      };
      animateComindPulse(0);

      map.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: currentBearing, pitch: 0 });
    });
  };

  /*== Animación continua de la brújula (interpolación suave hacia el bearing del mapa) ==*/
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
    maplibregl.addProtocol("pmtiles", protocol.tile);
    const mexicoBounds: [LngLatLike, LngLatLike] = [
    [-137.82575, 7.10986], 
    [-65.55923, 34.86389]
    ];

    const map = new maplibregl.Map({
      container,
      style: BASE_STYLE_URL,
      center: [-102.67736, 23.65307],
      zoom: 4.89,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      maxBounds: mexicoBounds,
      maxPitch: 85,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addControl(
        new maplibregl.AttributionControl({
          customAttribution: "Secretaría de Gobernación",
          compact: true,
        }),
        "bottom-right",
      );

      // El mapa base inicia siempre plano (no tiene efectos de terreno por defecto)
      if (map.getPitch() > 0) {
        map.setPitch(0);
      }

      addVectorLayers(map);

      // Ocultar todas las capas vectoriales al iniciar
      [ 
        "pozosap", "pozosc", "pozosi", "pozosp", "pozoss",
        // Zonas geológicas
        "zonaver", "zonatam", "zonacuencas", "zonaburgos", "zonaas", "zonaap",
        // Social
        "territoriospi", "com_ind",
        // Riesgo Hídrico (4 niveles)
        "riesgohic", "riesgohia", "riesgohim", "riesgohib", "riesgohc", "riesgoha",
        // Provincias (12)
        "burgos", "chihuahua", "cinturon_plegado_chiapas", "cinturon_plegado_smo",
        "golfo_california", "golfo_mexico_profundo", "plataforma_yucatan",
        "sabinas_burro_picachos", "sureste", "tampico_misantla", "veracruz", "vizcaino_purisima_iray",
         // Campos (3 tipos)
        "camposresas", "camposresm", "camposrest", "camposres_comind",
        // Otros energía
        "areaspotnc",
        // Diputados (5 partidos)
        "diputados_morena", "diputados_pri", "diputados_pan", "diputados_pvem", "diputados_pt",
        // Ambiental
        "anp", "zonascult",
        // División política
        "ent", "ent-border", "mun",
        // Comunidades
        "LocalidadesSedeINPI", "asentamientos",
      ].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      });

      // Capas visibles al iniciar
      ["rm","camposres_comind", "camposrest"].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", "visible");
        }
      });

      // Capas de utilidad por encima de los datos
      [
        "ent-click-border",
        "hover-polygon-fill", "hover-polygon-stroke",
        "hover-point-glow", "hover-point",
        "asentamientos-highlight", "asentamientos-labels",
      ].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });
      // camposres_comind siempre encima de todo
      ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });

      // Aplicar opacidad inicial — igual que applyPanel2State para que ambos paneles sean consistentes
      Object.entries(opa1Ref.current).forEach(([id, opacity]) => {
        const prop = layerOpacityProp[id];
        if (!prop) return;
        try {
          if (!map.getLayer(id)) return;
          if (id === "mun") {
            map.setPaintProperty(id, "fill-opacity", ["case",
              ["boolean", ["feature-state", "clicked"], false], 0.3, 0,
            ] as any);
          } else if (id === "ent") {
            const hov = Math.min(opacity * 8, 1);
            map.setPaintProperty(id, "fill-opacity", ["case",
              ["boolean", ["feature-state", "hover"], false], hov, opacity * 0.1,
            ] as any);
          } else {
            map.setPaintProperty(id, prop, opacity);
          }
        } catch {}
      });

      attachAllTooltipEvents(map);

      const updatePopupPositions = () => setMapView((v) => v + 1);
      map.on("move", updatePopupPositions);
      map.on("zoom", updatePopupPositions);

      const animatePulse = (timestamp: number) => {
        const radius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
        const opacity = 1 - radius / 25;

        // Animar puntos de medición de ruta
        ["start-point-current-pulse", "end-point-current-pulse"].forEach(
          (layerId) => {
            if (map.getLayer(layerId)) {
              map.setPaintProperty(layerId, "circle-radius", radius);
              map.setPaintProperty(layerId, "circle-opacity", opacity);
            }
          },
        );

        // Animar puntos de medición de línea recta
        [
          "start-point-line-current-pulse",
          "end-point-line-current-pulse",
        ].forEach((layerId) => {
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "circle-radius", radius);
            map.setPaintProperty(layerId, "circle-opacity", opacity);
          }
        });

        animationFrameId.current = requestAnimationFrame(animatePulse);
      };
      animatePulse(0);

      // Animación pulsante — rAF se agenda PRIMERO para que ninguna excepción mate el loop
      const animateComindPulse = (timestamp: number) => {
        blinkAnimationId.current = requestAnimationFrame(animateComindPulse);
        try {
          const pulseProgress = (Math.sin(timestamp / 1200) + 1) / 2;
          const pulseRadius = 15 * (Math.abs(Math.sin(timestamp / 500)) + 0.5);
          const pulseOpacity = 1 - pulseRadius / 25;
          const haloOpacity = 0.1 + 0.15 * pulseProgress;
          const currentRadius = 8 + 4 * pulseProgress;
          const currentHaloRadius = 12 + 6 * pulseProgress;

          if (map.getLayer("comind")) map.setPaintProperty("comind", "circle-radius", currentRadius);
          if (map.getLayer("comind-halo")) {
            map.setPaintProperty("comind-halo", "circle-radius", currentHaloRadius);
            map.setPaintProperty("comind-halo", "circle-opacity", haloOpacity);
          }
          if (map.getLayer("comind-pulse")) {
            map.setPaintProperty("comind-pulse", "circle-radius", pulseRadius);
            map.setPaintProperty("comind-pulse", "circle-opacity", pulseOpacity * 0.4);
          }
          if (map.getLayer("camposres_comind")) map.setPaintProperty("camposres_comind", "circle-radius", 4 + 2 * pulseProgress);
          if (map.getLayer("camposres_comind-halo")) {
            map.setPaintProperty("camposres_comind-halo", "circle-radius", 10 + 6 * pulseProgress);
            map.setPaintProperty("camposres_comind-halo", "circle-opacity", 0.08 + 0.12 * pulseProgress);
          }
          if (map.getLayer("camposres_comind-pulse")) {
            map.setPaintProperty("camposres_comind-pulse", "circle-radius", pulseRadius * 0.9);
            map.setPaintProperty("camposres_comind-pulse", "circle-stroke-opacity", pulseOpacity * 0.6);
          }
          if (map.getLayer("LocalidadesSedeINPI")) map.setPaintProperty("LocalidadesSedeINPI", "circle-radius", 3.2 + 1.2 * pulseProgress);
          if (map.getLayer("LocalidadesSedeINPI-halo")) {
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-radius", 9 + 5 * pulseProgress);
            map.setPaintProperty("LocalidadesSedeINPI-halo", "circle-opacity", 0.1 + 0.12 * pulseProgress);
          }
          if (map.getLayer("LocalidadesSedeINPI-pulse")) {
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-radius", pulseRadius * 0.7);
            map.setPaintProperty("LocalidadesSedeINPI-pulse", "circle-stroke-opacity", pulseOpacity * 0.55);
          }
        } catch {}
      };
      animateComindPulse(0);


      /*== Iniciar animación de brújula ==*/
      if (!compassAnimId.current) {
        compassAnimId.current = requestAnimationFrame(animateCompass);
      }
    });

    return () => {
      if (animationFrameId.current)
        cancelAnimationFrame(animationFrameId.current);
      if (blinkAnimationId.current)
        cancelAnimationFrame(blinkAnimationId.current);
      if (asentPulseId.current)
        cancelAnimationFrame(asentPulseId.current);
      if (compassAnimId.current) cancelAnimationFrame(compassAnimId.current);
      compassAnimId.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (minimapRef.current) {
        minimapRef.current.remove();
        minimapRef.current = null;
      }
      maplibregl.removeProtocol("pmtiles");
    };
  }, [attachAllTooltipEvents, animateCompass]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      updateLayerVisibility(map);
    } else {
      map.once("styledata", () => updateLayerVisibility(map));
    }
  }, [layersVisibility, updateLayerVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      Object.entries(layersOpacity).forEach(([id, opacity]) => {
        const prop = layerOpacityProp[id];
        if (!prop) return;
        try {
          if (!map.getLayer(id)) return;
          // ent/mun: fill-opacity con feature-state para preservar hover y clicked
          if (id === "ent" || id === "mun") {
            const hoverOpacity = Math.min(opacity * 8, 1);
            const expr = id === "mun"
              ? ["case",
                  ["boolean", ["feature-state", "clicked"], false], 0.3,
                  0,
                ]
              : ["case",
                  ["boolean", ["feature-state", "hover"], false], hoverOpacity,
                  opacity * 0.1,
                ];
            map.setPaintProperty(id, "fill-opacity", expr as any);
          } else {
            map.setPaintProperty(id, prop, opacity);
          }
        } catch {}
      });
    };
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("styledata", apply);
    }
  }, [layersOpacity]);

  /*== Panel 2 — aplicar visibilidad y opacidad a map2 ==*/
  const applyPanel2State = (map2: maplibregl.Map) => {
    Object.entries(vis2Ref.current).forEach(([id, visible]) => {
      const vis = visible ? "visible" : "none";
      try {
        if (map2.getLayer(id)) map2.setLayoutProperty(id, "visibility", vis);
        if (id === "comind") {
          ["comind-halo", "comind-pulse"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
          });
        }
        if (id === "camposres_comind") {
          ["camposres_comind-halo", "camposres_comind-pulse"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
          });
        }
        if (id === "LocalidadesSedeINPI") {
          ["LocalidadesSedeINPI-halo", "LocalidadesSedeINPI-pulse"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
          });
        }
        if (id === "buffer20m" && map2.getLayer("buffer20m-fill"))
          map2.setLayoutProperty("buffer20m-fill", "visibility", vis);
        if (id === "afect_buffer20m" && map2.getLayer("afect_buffer20m-fill"))
          map2.setLayoutProperty("afect_buffer20m-fill", "visibility", vis);
      } catch {}
    });
    Object.entries(opa2Ref.current).forEach(([id, opacity]) => {
      const prop = layerOpacityProp[id];
      if (!prop) return;
      try { if (map2.getLayer(id)) map2.setPaintProperty(id, prop, opacity); } catch {}
    });
  };

  /*== Panel 2 — ciclo de vida: crear al abrir, destruir al cerrar ==*/
  useEffect(() => {
    if (!splitActive) {
      if (map2Ref.current) {
        map2Ref.current.remove();
        map2Ref.current = null;
      }
      return;
    }
    if (!container2Ref.current || map2Ref.current) return;

    // Inicializar estado del panel 2 desde snapshot del panel 1
    const initVis = { ...vis1Ref.current };
    const initOpa = { ...opa1Ref.current };
    setLayersVisibility2(initVis);
    setLayersOpacity2(initOpa);
    vis2Ref.current = initVis;
    opa2Ref.current = initOpa;
    setSectionOrders2(sections.map((s) => s.items.map((i) => i.id)));
    const currentIsSat = isSatellite;
    const currentIs3D = is3D;
    setIsSatellite2(currentIsSat);
    setIs3D2(currentIs3D);

    const map2 = new maplibregl.Map({
      container: container2Ref.current,
      style: getStyleUrl(currentIsSat, currentIs3D, isDark),
      center: [-101.28044, 23.65978],
      zoom: 4.73,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      maxBounds: [[-121, 14], [-84, 33.5]],
      maxPitch: 85,
    });
    map2Ref.current = map2;

    map2.on("load", () => {
      addVectorLayers(map2);
      applyPanel2State(map2);
    });

    map2.on("rotate", () => setDisplayBearing2(map2.getBearing()));

    return () => {
      map2.remove();
      map2Ref.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitActive]);

  /*== Panel 2 — isDark sincronizado ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const url = getStyleUrl(isSatellite2, is3D2, isDark);
    map2.setStyle(url, { diff: false });
    map2.once("styledata", () => {
      addVectorLayers(map2);
      applyPanel2State(map2);
      if (is3D2) setTimeout(() => applyOrRemove3DEffects(map2, true, isSatellite2), 200);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  /*== Panel 2 — visibilidad → map2 ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const apply = () => {
      Object.entries(layersVisibility2).forEach(([id, visible]) => {
        const vis = visible ? "visible" : "none";
        try {
          if (map2.getLayer(id)) map2.setLayoutProperty(id, "visibility", vis);
          if (id === "comind") {
            ["comind-halo", "comind-pulse"].forEach((sub) => {
              if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
            });
          }
          if (id === "camposres_comind") {
            ["camposres_comind-halo", "camposres_comind-pulse"].forEach((sub) => {
              if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
            });
          }
        } catch {}
      });
    };
    if (map2.isStyleLoaded()) apply();
    else map2.once("styledata", apply);
  }, [layersVisibility2]);

  /*== Panel 2 — opacidad → map2 ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const apply = () => {
      Object.entries(layersOpacity2).forEach(([id, opacity]) => {
        const prop = layerOpacityProp[id];
        if (!prop) return;
        try { if (map2.getLayer(id)) map2.setPaintProperty(id, prop, opacity); } catch {}
      });
    };
    if (map2.isStyleLoaded()) apply();
    else map2.once("styledata", apply);
  }, [layersOpacity2]);

  /*== Panel 2 — reordenar capas → map2 ==*/
  const layerOrder2 = sectionOrders2.flat();
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2 || !layerOrder2.length) return;
    const doReorder = () => {
      for (let i = layerOrder2.length - 1; i >= 0; i--) {
        const id = layerOrder2[i];
        if (id === "comind") {
          ["comind-halo", "comind-pulse", "comind"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.moveLayer(sub);
          });
        } else if (id === "camposres_comind") {
          ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.moveLayer(sub);
          });
        } else if (map2.getLayer(id)) {
          map2.moveLayer(id);
        }
      }
      // camposres_comind siempre encima de capas de datos
      ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
        try { if (map2.getLayer(sub)) map2.moveLayer(sub); } catch {}
      });
    };
    if (map2.isStyleLoaded()) doReorder();
    else map2.once("styledata", doReorder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerOrder2]);

  /*== Resize ambos mapas al cambiar el divisor ==*/
  useEffect(() => {
    requestAnimationFrame(() => {
      mapRef.current?.resize();
      if (splitActive) map2Ref.current?.resize();
    });
  }, [dividerX, splitActive]);

  /*== Reordenar capas en el mapa según el orden del panel (índice 0 = encima) ==*/
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layerOrder || layerOrder.length === 0) return;

    const doReorder = () => {
      // Procesamos de abajo hacia arriba: el último en layerOrder queda abajo,
      // el primero (índice 0) queda encima — igual que en QGIS.
      for (let i = layerOrder.length - 1; i >= 0; i--) {
        const id = layerOrder[i];
        if (id === "comind") {
          ["comind-halo", "comind-pulse", "comind"].forEach((sub) => {
            if (map.getLayer(sub)) map.moveLayer(sub);
          });
        } else if (id === "camposres_comind") {
          ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
            if (map.getLayer(sub)) map.moveLayer(sub);
          });
        } else {
          if (map.getLayer(id)) map.moveLayer(id);
        }
      }
      // Capas de utilidad (hover, rutas) que no están en el panel → subirlas por encima de los datos
      [
        "ent-click-border",
        "hover-polygon-fill", "hover-polygon-stroke",
        "hover-point-glow", "hover-point",
        "asentamientos-highlight", "asentamientos-labels",
        "asentamientos-comind-dots", "asentamientos-comind-labels",
      ].forEach((id) => {
        try { if (map.getLayer(id)) map.moveLayer(id); } catch {}
      });
      // camposres_comind siempre encima de capas de datos
      ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });
      // Pins siempre encima de todo
      [
        "pin-prop-halo", "pin-prop-ring", "pin-prop-segob",
        "pin-km21-halo", "pin-km21-ring", "pin-km21",
      ].forEach((id) => {
        if (map.getLayer(id)) map.moveLayer(id);
      });
    };

    if (map.isStyleLoaded()) {
      doReorder();
    } else {
      map.once("styledata", doReorder);
    }
  }, [layerOrder]);

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

    const addOrUpdateAnimatedPoint = (
      id: "start" | "end",
      lngLat: LngLat,
      isLine: boolean = false,
    ) => {
      const prefix = isLine ? "line-" : "";
      const sourceId = `${id}-point-${prefix}current`;
      const pointFeature: Feature<Point> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lngLat.lng, lngLat.lat] },
        properties: {},
      };
      const color = isLine ? "#ff6b35" : "#009f81";

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as GeoJSONSource).setData(pointFeature);
      } else {
        map.addSource(sourceId, { type: "geojson", data: pointFeature });
        map.addLayer({
          id: `${sourceId}-pulse`,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 10,
            "circle-color": color,
            "circle-opacity": 0.8,
          },
        });
        map.addLayer({
          id: sourceId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 6,
            "circle-color": color,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    };

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (isMeasuring) {
        if (currentPoints.length >= 2) return;
        const newPoint = e.lngLat;
        const pointId = currentPoints.length === 0 ? "start" : "end";
        addOrUpdateAnimatedPoint(pointId, newPoint, false);
        setCurrentPoints((prev) => [...prev, newPoint]);
      } else if (isMeasuringLine) {
        if (currentLinePoints.length >= 2) return;
        const newPoint = e.lngLat;
        const pointId = currentLinePoints.length === 0 ? "start" : "end";
        addOrUpdateAnimatedPoint(pointId, newPoint, true);
        setCurrentLinePoints((prev) => [...prev, newPoint]);
      }
    };

    if (isMeasuring || isMeasuringLine) {
      map.getCanvas().style.cursor = "crosshair";
      map.on("click", handleMapClick);
    }

    return () => {
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = "";
      }
      map.off("click", handleMapClick);
    };
  }, [
    isMeasuring,
    isMeasuringLine,
    currentPoints,
    currentLinePoints,
    addRouteToMap,
    addLineToMap,
  ]);

  /*== Handlers del panel 2 ==*/
  const handleToggle2 = (id: string) =>
    setLayersVisibility2((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleOpacityChange2 = (id: string, value: number) =>
    setLayersOpacity2((prev) => ({ ...prev, [id]: value }));
  const handleReorder2 = (sectionIdx: number, newIds: string[]) =>
    setSectionOrders2((prev) => { const n = [...prev]; n[sectionIdx] = newIds; return n; });
  const handleToggleAll2 = (visible: boolean) =>
    setLayersVisibility2((prev) =>
      Object.fromEntries(Object.keys(prev).map((id) => [id, visible])),
    );

  /*== Secciones del panel 2 — misma estructura, estado independiente ==*/
  const sections2: InfoBoxSection[] = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      checked: layersVisibility2[item.id] ?? false,
      opacity: layersOpacity2[item.id] ?? 1,
    })),
  }));

  /*== Estilos de botones de control — reactivos al tema ==*/
  const controlStackStyle: React.CSSProperties = {
    position: "absolute",
    top: "20px",
    right: splitActive ? `calc(${100 - dividerX}% + 10px)` : "20px",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };
  const controlButtonStyle: React.CSSProperties = isDark
    ? {
        width: 40,
        height: 40,
        borderRadius: 9999,
        background: "rgba(10, 8, 6, 0.62)",
        border: "1px solid rgba(200, 185, 155, 0.14)",
        padding: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(220,205,175,0.05)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        cursor: "pointer",
      }
    : {
        width: 40,
        height: 40,
        borderRadius: 9999,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        padding: 6,
        boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
        cursor: "pointer",
      };
  const buttonIconStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    display: "block",
  };
  // Invierte ícono BW en modo oscuro para que se vea blanco
  const bwIconStyle = (isActive: boolean): React.CSSProperties => ({
    ...buttonIconStyle,
    filter: isDark && !isActive
      ? "brightness(0) saturate(0) invert(1) sepia(0.2) brightness(0.85) opacity(0.82)"
      : undefined,
  });

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%", height: "100vh" }}>
      {/* Panel 1 — izquierdo */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 0, bottom: 0, left: 0,
          right: splitActive ? `${100 - dividerX}%` : 0,
        }}
      />

      {/* Panel 2 — derecho, solo visible cuando split activo */}
      <div
        ref={container2Ref}
        style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: `${dividerX}%`, right: 0,
          display: splitActive ? "block" : "none",
        }}
      />

      {/* Logo institucional — sobre atribuciones MapLibre (bottom-right) */}
      <a
        href="https://www.gob.mx/segob"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute",
          bottom: 5,
          left: 5,
          zIndex: 25,
          background: "rgba(255, 255, 255, 0.7)",
          borderRadius: 12,
          padding: "2px 8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          width: 180,
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoHovered ? 0.95 : 0.75,
          transition: "opacity 0.25s ease",
          textDecoration: "none",
        }}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
      >
        <img
          src={`./logo_SEGOB.png`}
          alt="SEGOB"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </a>

      <div className="custom-popup-container">
        {routesData.map((route) => {
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
              <strong>Distancia:</strong> {route.distance} km
              <br />
              <strong>Tiempo:</strong> {route.duration}
            </div>
          );
        })}
        {linesData.map((line) => {
          if (!mapRef.current) return null;
          const screenPoint = mapRef.current.project(line.endPoint);
          return (
            <div
              key={`line-${line.id}`}
              className="custom-route-popup"
              style={{
                left: `${screenPoint.x}px`,
                top: `${screenPoint.y}px`,
                backgroundColor: "#ff6b35",
                color: "#ffffff",
              }}
            >
              <strong>Distancia:</strong> {line.distance} km
              <br />
              <strong>Tipo:</strong> {line.duration}
            </div>
          );
        })}
      </div>

      {/* Panel fijo de comunidad en campo de reserva — a la izquierda del stack de botones */}
      {pinnedComindData && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: splitActive ? `calc(${100 - dividerX}% + 70px)` : "70px",
          zIndex: 25,
          background: "#0f1117",
          border: "1px solid #D50000",
          borderRadius: "8px",
          padding: "12px 14px",
          minWidth: "210px",
          maxWidth: "265px",
          boxShadow: "0 4px 20px rgba(213,0,0,0.35)",
          pointerEvents: "all",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flexShrink: 0, width: 10, height: 10, borderRadius: "50%", background: "#D50000", boxShadow: "0 0 6px #D50000", display: "inline-block" }} />
              <strong style={{ color: "#ff5252", fontSize: 13, lineHeight: 1.3 }}>{pinnedComindData.NOM_COM ?? "—"}</strong>
            </div>
            <button
              onClick={() => {
                setPinnedComindData(null);
                pinnedComindIdRef.current = null;
                const m = mapRef.current;
                if (m) {
                  if (m.getLayer("asentamientos-comind-dots")) m.setFilter("asentamientos-comind-dots", ["==", ["literal", 1], 0]);
                  if (m.getLayer("asentamientos-comind-labels")) m.setFilter("asentamientos-comind-labels", ["==", ["literal", 1], 0]);
                  if (prevMapViewRef.current) {
                    m.flyTo({ ...prevMapViewRef.current, duration: 800 });
                    prevMapViewRef.current = null;
                  }
                }
              }}
              style={{ background: "none", border: "none", color: "#D50000", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "0 0 0 8px", flexShrink: 0 }}
              title="Cerrar"
            >×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 11.5, color: "#cdd6f4" }}>
            <span style={{ color: "#7f849c" }}>Estado</span><span>{pinnedComindData.NOM_ENT ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Municipio</span><span>{pinnedComindData.NOM_MUN ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Pueblo</span><span>{pinnedComindData.Pueblo ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Pob. total</span>
            <span style={{ color: "#ff8a80", fontWeight: 600 }}>
              {pinnedComindData._pobtot != null
                ? Number(String(pinnedComindData._pobtot).replace(/,/g, "")).toLocaleString("es-MX")
                : "…"}
            </span>
            <span style={{ color: "#7f849c" }}>Asentamientos</span>
            <span style={{ color: "#ff7626", fontWeight: 700 }}>
              {pinnedComindData._asentCount != null ? pinnedComindData._asentCount : "…"}
            </span>
          </div>
        </div>
      )}

      <div style={controlStackStyle}>
        <button
          className={`map-control-button ${isSatellite ? "active" : ""}`}
          onClick={toggleSatellite}
          title={isSatellite ? "Volver a mapa normal" : "Ver mapa satelital"}
          aria-label="Cambiar vista"
          style={controlButtonStyle}
        >
          <img
            src={
              isSatellite
                ? `./satelitec.png`
                : `./satelitebw.png`
            }
            alt="Cambiar vista"
            className="button-icon"
            style={bwIconStyle(isSatellite)}
          />
        </button>

        <button
          className={`map-control-button ${isMeasuring ? "active" : ""}`}
          onClick={toggleMeasurement}
          title={isMeasuring ? "Terminar medición de ruta" : "Medir ruta"}
          aria-label="Medir ruta"
          style={controlButtonStyle}
        >
          <img
            src={
              isMeasuring
                ? `./rutac.png`
                : `./rutabw.png`
            }
            alt="Medir ruta"
            className="button-icon"
            style={bwIconStyle(isMeasuring)}
          />
        </button>
        <button
          className={`map-control-button ${isMeasuringLine ? "active" : ""}`}
          onClick={toggleLineMeasurement}
          title={
            isMeasuringLine
              ? "Terminar medición línea recta"
              : "Medir línea recta"
          }
          aria-label="Medir línea recta"
          style={controlButtonStyle}
        >
          <div
            className="button-icon"
            style={{
              ...buttonIconStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "bold",
              color: isMeasuringLine ? "#007cbf" : isDark ? "#94a3b8" : "#6c757d",
            }}
          >
            ⟷
          </div>
        </button>
        <button
          className={`map-control-button ${is3D ? "active" : ""}`}
          onClick={toggle3D}
          title={is3D ? "Desactivar vista 3D" : "Activar vista 3D"}
          aria-label="Vista 3D"
          style={controlButtonStyle}
        >
          <img
            src={get3DIcon(is3D, isDark)}
            alt="Vista 3D"
            className="button-icon"
            style={buttonIconStyle}
          />
        </button>

        {/*== Vista comparada ==*/}
        <button
          className={`map-control-button ${splitActive ? "active" : ""}`}
          onClick={() => setSplitActive((v) => !v)}
          title={splitActive ? "Desactivar vista comparada" : "Comparar mapa base / satélite"}
          aria-label="Vista comparada"
          style={controlButtonStyle}
        >
          <svg
            style={{
              ...buttonIconStyle,
              color: splitActive ? "#007cbf" : isDark ? "#94a3b8" : "#6c757d",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="9" height="18" rx="1.5" />
            <rect x="13" y="3" width="9" height="18" rx="1.5" />
            <line x1="11.5" y1="3" x2="11.5" y2="21" />
          </svg>
        </button>

        {/*== Brújula interactiva ==*/}
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
            style={{ display: "block", width: "100%", height: "100%" }}
          >
            {/* Disco */}
            <circle
              cx="50" cy="50" r="46"
              fill={isDark ? "rgba(14,11,8,0.90)" : "#ffffff"}
              stroke={isDark ? "rgba(180,140,60,0.22)" : "#e5e7eb"}
              strokeWidth="4"
            />
            <circle
              cx="50" cy="50" r="42"
              fill={isDark ? "#1a1610" : "#f9fafb"}
              stroke={isDark ? "rgba(180,140,60,0.10)" : "#d1d5db"}
              strokeWidth="1"
            />

            {/* Marca N */}
            <text
              x="50" y="18"
              textAnchor="middle"
              fontSize="12"
              fontFamily="Inter, system-ui"
              fill={isDark ? "rgba(212,168,67,0.6)" : "#6b7280"}
            >
              N
            </text>

            {/* Aguja */}
            <g
              style={{
                transformOrigin: "50px 50px",
                transform: `rotate(${-displayBearing}deg)`,
              }}
            >
              <polygon points="50,12 44,50 56,50" fill={isDark ? "#b8a47c" : "#ef4444"} />
              <polygon points="50,88 44,50 56,50" fill={isDark ? "rgba(238,232,220,0.60)" : "#374151"} />
              <circle cx="50" cy="50" r="4" fill={isDark ? "#b8a47c" : "#111827"} />
            </g>
          </svg>
        </button>
      </div>

      <div ref={minimapContainerRef} className="minimap-container" />

      {/*== Panel 2 — InfoBox y controles de estilo ==*/}
      <AnimatePresence>
        {splitActive && (
          <>
            {/* Contenedor clip del InfoBox del panel 2 — confina la animación de cierre al panel 2 */}
            <div style={{
              position: "absolute",
              left: `${dividerX}%`,
              right: 0,
              top: 0,
              bottom: 0,
              overflow: "hidden",
              transform: "translateZ(0)",
              zIndex: 1000,
              pointerEvents: "none",
            }}>
              <InfoBox
                key="infobox-p2"
                title="FRACKING EN MÉXICO"
                subtitle="Panel derecho"
                sections={sections2}
                onToggle={handleToggle2}
                onOpacityChange={handleOpacityChange2}
                onReorder={handleReorder2}
                onToggleAll={handleToggleAll2}
                isDark={isDark}
                xOffset="10px"
              />
            </div>

            {/* Controles panel derecho — idénticos al panel izquierdo sin botón de split */}
            <div style={{ position: "absolute", top: 20, right: 10, zIndex: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={controlButtonStyle} onClick={toggleSatellite2}
                title={isSatellite2 ? "Volver a mapa normal" : "Ver mapa satelital"}>
                <img src={isSatellite2 ? `./satelitec.png` : `./satelitebw.png`}
                  alt="Satelital" style={bwIconStyle(isSatellite2)} />
              </button>
              <button style={controlButtonStyle} onClick={() => { setIsMeasuring2((v) => { if (!v) { setIsMeasuringLine2(false); clearAllRoutes2(); setCurrentPoints2([]); setCurrentLinePoints2([]); } return !v; }); }}
                title={isMeasuring2 ? "Terminar medición de ruta" : "Medir ruta"}>
                <img src={isMeasuring2 ? `./rutac.png` : `./rutabw.png`}
                  alt="Medir ruta" style={bwIconStyle(isMeasuring2)} />
              </button>
              <button style={controlButtonStyle} onClick={() => { setIsMeasuringLine2((v) => { if (!v) { setIsMeasuring2(false); clearAllRoutes2(); setCurrentPoints2([]); setCurrentLinePoints2([]); } return !v; }); }}
                title={isMeasuringLine2 ? "Terminar medición línea recta" : "Medir línea recta"}>
                <div style={{ ...buttonIconStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", color: isMeasuringLine2 ? "#007cbf" : isDark ? "#94a3b8" : "#6c757d" }}>⟷</div>
              </button>
              <button style={controlButtonStyle} onClick={toggle3D2}
                title={is3D2 ? "Desactivar vista 3D" : "Activar vista 3D"}>
                <img src={get3DIcon(is3D2, isDark)} alt="3D" style={buttonIconStyle} />
              </button>
              <button className="map-control-button compass-btn" onClick={resetNorth2}
                title="Restaurar norte" style={{ ...controlButtonStyle, padding: 0 }}>
                <svg viewBox="0 0 100 100" className="compass-svg" style={{ display: "block", width: "100%", height: "100%" }}>
                  <circle cx="50" cy="50" r="46" fill={isDark ? "rgba(14,11,8,0.90)" : "#ffffff"} stroke={isDark ? "rgba(180,140,60,0.22)" : "#e5e7eb"} strokeWidth="4" />
                  <circle cx="50" cy="50" r="42" fill={isDark ? "#1a1610" : "#f9fafb"} stroke={isDark ? "rgba(180,140,60,0.10)" : "#d1d5db"} strokeWidth="1" />
                  <text x="50" y="18" textAnchor="middle" fontSize="12" fontFamily="Inter, system-ui" fill={isDark ? "rgba(212,168,67,0.6)" : "#6b7280"}>N</text>
                  <g style={{ transformOrigin: "50px 50px", transform: `rotate(${-displayBearing2}deg)` }}>
                    <polygon points="50,12 44,50 56,50" fill={isDark ? "#b8a47c" : "#ef4444"} />
                    <polygon points="50,88 44,50 56,50" fill={isDark ? "rgba(238,232,220,0.60)" : "#374151"} />
                    <circle cx="50" cy="50" r="4" fill={isDark ? "#b8a47c" : "#111827"} />
                  </g>
                </svg>
              </button>
            </div>

            {/* Popups de rutas y líneas del panel 2 */}
            {routesData2.map((route) => {
              if (!map2Ref.current) return null;
              const pt = map2Ref.current.project(route.endPoint);
              return (
                <div key={`r2-${route.id}`} className="custom-route-popup" style={{ left: `${pt.x}px`, top: `${pt.y}px` }}>
                  <strong>Distancia:</strong> {route.distance} km<br /><strong>Tiempo:</strong> {route.duration}
                </div>
              );
            })}
            {linesData2.map((line) => {
              if (!map2Ref.current) return null;
              const pt = map2Ref.current.project(line.endPoint);
              return (
                <div key={`l2-${line.id}`} className="custom-route-popup" style={{ left: `${pt.x}px`, top: `${pt.y}px`, backgroundColor: "#ff6b35", color: "#ffffff" }}>
                  <strong>Distancia:</strong> {line.distance} km<br /><strong>Tipo:</strong> Línea recta
                </div>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/*== Divisor de vista ==*/}
      <AnimatePresence>
        {splitActive && (
          <SplitHandle
            position={dividerX}
            onChange={setDividerX}
            isDark={isDark}
            containerRef={wrapperRef}
            leftLabel="Panel izquierdo"
            rightLabel="Panel derecho"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Map;
