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
import InfoBox, { InfoBoxSection, LegendItem } from "../InfoBox/InfoBox";

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
  // Municipio Ahome
  ahome_mun: "fill-opacity",
  // Área de impacto del Proyecto (E-escenarios — fill)
  aip_area_t1:       "fill-opacity",
  aip_area_t2:       "fill-opacity",
  aip_area_t3:       "fill-opacity",
  aip_area_t4:       "fill-opacity",
  aip_area_t5:       "fill-opacity",
  aip_area_t6:       "fill-opacity",
  aip_area_t7:       "fill-opacity",
  aip_area_t8:       "fill-opacity",
  aip_area_t9:       "fill-opacity",
  aip_area_t10:      "fill-opacity",
  aip_area_t11:      "fill-opacity",
  aip_area_t12:      "fill-opacity",
  aip_area_t13:      "fill-opacity",
  aip_derecho_via:   "fill-opacity",
  aip_pol_norte:     "fill-opacity",
  aip_predio_sur:    "fill-opacity",
  aip_camino:        "fill-opacity",
  // E-escenarios — sub-capas por Name
  e01_zona: "fill-opacity",  e01_predio: "fill-opacity",
  e02_zona: "fill-opacity",  e02_predio: "fill-opacity",
  e03_zona: "fill-opacity",  e03_predio: "fill-opacity",
  e04_zona: "fill-opacity",  e04_predio: "fill-opacity",
  e05a_zona: "fill-opacity", e05a_predio: "fill-opacity",
  e05b_zona: "fill-opacity", e05b_predio: "fill-opacity",
  e06_zona: "fill-opacity",  e06_predio: "fill-opacity",
  e07a: "fill-opacity",
  e07b: "fill-opacity",
  e08_zona: "fill-opacity",  e08_adecuacion: "fill-opacity",
  e09_zona: "fill-opacity",  e09_adecuacion: "fill-opacity",
  e13_zona: "fill-opacity",  e13_predio: "fill-opacity",
  e14_zona: "fill-opacity",  e14_predio: "fill-opacity",
  esc12_t1: "fill-opacity",  esc12_t2: "fill-opacity",  esc12_t3: "fill-opacity",
  esc12_t4: "fill-opacity",  esc12_t5: "fill-opacity",  esc12_t6: "fill-opacity",
  esc12_t7: "fill-opacity",  esc12_t8: "fill-opacity",  esc12_t9: "fill-opacity",
  esc12_t10: "fill-opacity", esc12_t11: "fill-opacity", esc12_t12: "fill-opacity",
  esc12_t13: "fill-opacity", esc12_ddv: "fill-opacity",  esc12_dvia: "fill-opacity",
  esc12_znube: "fill-opacity", esc12_nube2: "fill-opacity", esc12_pnorte: "fill-opacity",
  esc12_psur: "fill-opacity",  esc12_a: "fill-opacity",  esc12_b: "fill-opacity",
  esc12_c: "fill-opacity",     esc12_camino: "fill-opacity",
  // Centros Escolares (symbol — cuadrado)
  educ_preesc_pub:    "icon-opacity",
  educ_preesc_priv:   "icon-opacity",
  educ_prim_pub:      "icon-opacity",
  educ_prim_priv:     "icon-opacity",
  educ_media_sup_pub: "icon-opacity",
  educ_media_sup_priv:"icon-opacity",
  educ_media_tec_priv:"icon-opacity",
  educ_superior_pub:  "icon-opacity",
  educ_superior_priv: "icon-opacity",
  // Otros
  ejidos_rosendo:   "fill-opacity",
  ejidos_topoviejo: "fill-opacity",
  salu_pub:  "icon-opacity",
  salu_priv: "icon-opacity",
  // Comunidades
  localidades_inpi: "circle-opacity",
  asent_com:        "circle-opacity",
  // Ambiental
  anp_ahome:               "fill-opacity",
  cuerpos_agua_perenne:    "fill-opacity",
  cuerpos_agua_intermit:   "fill-opacity",
  uso_suelo_acuicola:    "fill-opacity",
  uso_suelo_riego_anual: "fill-opacity",
  uso_suelo_riego_semi:  "fill-opacity",
  uso_suelo_riego_perm:  "fill-opacity",
  uso_suelo_temporal:    "fill-opacity",
  uso_suelo_asent_hum:   "fill-opacity",
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

  /*== Municipio de Ahome ==*/
  if (!map.getSource("ahome_mun")) {
    map.addSource("ahome_mun", {
      type: "vector",
      url: "pmtiles://data/ahome_mun.pmtiles",
    });
  }
  if (!map.getLayer("ahome_mun")) {
    map.addLayer({
      id: "ahome_mun",
      type: "fill",
      source: "ahome_mun",
      "source-layer": "ahome_mun_tile",
      paint: { "fill-color": "#90f2ff", "fill-opacity": 0.08, "fill-antialias": false },
    });
  }
  if (!map.getLayer("ahome_mun-border")) {
    map.addLayer({
      id: "ahome_mun-border",
      type: "line",
      source: "ahome_mun",
      "source-layer": "ahome_mun_tile",
      paint: { "line-color": "#90f2ff", "line-width": 1.8, "line-opacity": 0.85 },
    });
  }

  /*== Área de Impacto Directa — sub-capas por Name ==*/
  if (!map.getSource("aip")) {
    map.addSource("aip", {
      type: "vector",
      url: "pmtiles://data/Area de Impacto_Proyecto.pmtiles",
    });
  }
  const aipCats: { id: string; name: string; color: string }[] = [
    { id: "aip_area_t1",     name: "Area T1",           color: "#FF073A" },
    { id: "aip_area_t2",     name: "Area T2",           color: "#FF6B00" },
    { id: "aip_area_t3",     name: "Area T3",           color: "#FFE500" },
    { id: "aip_area_t4",     name: "Area T4",           color: "#39FF14" },
    { id: "aip_area_t5",     name: "Area T5",           color: "#00FFFF" },
    { id: "aip_area_t6",     name: "Area T6",           color: "#00B3FF" },
    { id: "aip_area_t7",     name: "Area T7",           color: "#7B2FFF" },
    { id: "aip_area_t8",     name: "Area T8",           color: "#FF00FF" },
    { id: "aip_area_t9",     name: "Area T9",           color: "#FF1493" },
    { id: "aip_area_t10",    name: "Area T10",          color: "#ADFF2F" },
    { id: "aip_area_t11",    name: "Area T11",          color: "#00FF7F" },
    { id: "aip_area_t12",    name: "Area T12",          color: "#00FFBF" },
    { id: "aip_area_t13",    name: "Area T13",          color: "#FF9F00" },
    { id: "aip_derecho_via", name: "Derecho de via P",  color: "#FF6EC7" },
    { id: "aip_pol_norte",   name: "Polígono Norte",    color: "#CCFF00" },
    { id: "aip_predio_sur",  name: "Predio Sur",        color: "#FF3EFF" },
    { id: "aip_camino",      name: "camino",            color: "#4DFFFF" },
  ];
  for (const cat of aipCats) {
    if (!map.getLayer(cat.id)) {
      map.addLayer({
        id: cat.id,
        type: "fill",
        source: "aip",
        "source-layer": "AreadeImpacto_Proyecto_tile",
        filter: ["==", ["get", "Name"], cat.name],
        paint: { "fill-color": cat.color, "fill-opacity": 0.45, "fill-antialias": false },
      });
    }
  }

  /*== E-escenarios: zonas de amortiguamiento desagregadas por Name ==*/
  type ESubLayer = { id: string; name: string; color: string };
  type EScenarioDef = { sourceId: string; file: string; sourceLayer: string; subLayers: ESubLayer[] };

  const eScenarioDefs: EScenarioDef[] = [
    { sourceId: "e01", file: "E01_Zona de Amortiguamiento_Tanque de Metanol 4101T001A-B.pmtiles", sourceLayer: "E01_ZonadeAmortiguamiento_TanquedeMetanol4101T001AB_tile",
      subLayers: [
        { id: "e01_zona",   name: "E01_Zona de Amortiguamiento_Metanol", color: "#E91E63" },
        { id: "e01_predio", name: "Predio NORTE",                        color: "#39FF14" },
      ] },
    { sourceId: "e02", file: "E02_Zona de Amortiguamiento_Tanque de Metanol 4101T001A-B.pmtiles", sourceLayer: "E02_ZonadeAmortiguamiento_TanquedeMetanol4101T001AB_tile",
      subLayers: [
        { id: "e02_zona",   name: "E02_Zona de Amortiguamiento_Metanol", color: "#F48FB1" },
        { id: "e02_predio", name: "Predio NORTE",                        color: "#00FFFF" },
      ] },
    { sourceId: "e03", file: "E03_Zona de amortiguamiento_Tanque de Metanol 4101T003.pmtiles", sourceLayer: "E03_Zonadeamortiguamiento_TanquedeMetanol4101T003_tile",
      subLayers: [
        { id: "e03_zona",   name: "E03_Zona de amortiguamiento_Metanol", color: "#9C27B0" },
        { id: "e03_predio", name: "Predio NORTE",                        color: "#ADFF2F" },
      ] },
    { sourceId: "e04", file: "E04_Zona de Amortiguamiento_Tanque de Metanol 4101T003.pmtiles", sourceLayer: "E04_ZonadeAmortiguamiento_TanquedeMetanol4101T003_tile",
      subLayers: [
        { id: "e04_zona",   name: "E04_Zona de amortiguamiento_Metanol", color: "#CE93D8" },
        { id: "e04_predio", name: "Predio NORTE",                        color: "#FF073A" },
      ] },
    { sourceId: "e05a", file: "E05_Zona de Amortiguamiento_Tanque de Metanol  9531T001A-C.pmtiles", sourceLayer: "E05_ZonadeAmortiguamiento_TanquedeMetanol9531T001AC_tile",
      subLayers: [
        { id: "e05a_zona",   name: "E05_Zona de Amortiguamiento_Metanol", color: "#00BCD4" },
        { id: "e05a_predio", name: "Predio NORTE",                         color: "#FF6EC7" },
      ] },
    { sourceId: "e05b", file: "E05_Zona_de_Amortiguamiento_Tanque_de_Metanol _9531T001A-C.pmtiles", sourceLayer: "E05_Zona_de_Amortiguamiento_Tanque_de_Metanol_9531T001AC_tile",
      subLayers: [
        { id: "e05b_zona",   name: "E05_Zona de Amortiguamiento_Metanol", color: "#80DEEA" },
        { id: "e05b_predio", name: "Predio NORTE",                         color: "#FF6B00" },
      ] },
    { sourceId: "e06", file: "E06_Zona de Amortiguamiento_Tanque de Metanol  9531T001A-C.pmtiles", sourceLayer: "E06_ZonadeAmortiguamiento_TanquedeMetanol9531T001AC_tile",
      subLayers: [
        { id: "e06_zona",   name: "E06_Zona de Amortiguamiento_Metanol", color: "#009688" },
        { id: "e06_predio", name: "Predio NORTE",                        color: "#FF3EFF" },
      ] },
    { sourceId: "e08", file: "E08_Zona de Amortiguamiento_Brazos de descarga.pmtiles", sourceLayer: "E08_ZonadeAmortiguamiento_Brazosdedescarga_tile",
      subLayers: [
        { id: "e08_zona",       name: "E08_Zona de amortiguamiento_Brazos", color: "#FF9800" },
        { id: "e08_adecuacion", name: "Adecuacion IP",                      color: "#7B2FFF" },
      ] },
    { sourceId: "e09", file: "E09_Zona de Amortiguamiento_Brazos de descarga.pmtiles", sourceLayer: "E09_ZonadeAmortiguamiento_Brazosdedescarga_tile",
      subLayers: [
        { id: "e09_zona",       name: "E09_Zona de amortiguamiento_Brazos", color: "#FFCC80" },
        { id: "e09_adecuacion", name: "Adecuacion IP",                      color: "#00FF7F" },
      ] },
    { sourceId: "e13", file: "E13_Zona de Amortiguamiento_Gas Cloro.pmtiles", sourceLayer: "E13_ZonadeAmortiguamiento_GasCloro_tile",
      subLayers: [
        { id: "e13_zona",   name: "E13_Zona de Amortiguamiento_Gas Cloro", color: "#FFEB3B" },
        { id: "e13_predio", name: "Predio NORTE",                          color: "#00B3FF" },
      ] },
    { sourceId: "e14", file: "E14_Zona de Amortiguamiento_Gas Cloro.pmtiles", sourceLayer: "E14_ZonadeAmortiguamiento_GasCloro_tile",
      subLayers: [
        { id: "e14_zona",   name: "E14_Zona de Amortiguamiento_Gas Cloro", color: "#FFF176" },
        { id: "e14_predio", name: "Predio NORTE",                          color: "#FF1493" },
      ] },
    { sourceId: "esc12", file: "Escenario 12_Zona de Amortiguamiento_Tanque de Gas Cloro.pmtiles", sourceLayer: "Escenario12_ZonadeAmortiguamiento_TanquedeGasCloro_tile",
      subLayers: [
        { id: "esc12_t1",    name: "Area T1",                                           color: "#FF073A" },
        { id: "esc12_t2",    name: "Area T2",                                           color: "#FF6B00" },
        { id: "esc12_t3",    name: "Area T3",                                           color: "#FFE500" },
        { id: "esc12_t4",    name: "Area T4",                                           color: "#39FF14" },
        { id: "esc12_t5",    name: "Area T5",                                           color: "#00FFFF" },
        { id: "esc12_t6",    name: "Area T6",                                           color: "#00B3FF" },
        { id: "esc12_t7",    name: "Area T7",                                           color: "#7B2FFF" },
        { id: "esc12_t8",    name: "Area T8",                                           color: "#FF00FF" },
        { id: "esc12_t9",    name: "Area T9",                                           color: "#FF1493" },
        { id: "esc12_t10",   name: "Area T10",                                          color: "#ADFF2F" },
        { id: "esc12_t11",   name: "Area T11",                                          color: "#00FF7F" },
        { id: "esc12_t12",   name: "Area T12",                                          color: "#00FFBF" },
        { id: "esc12_t13",   name: "Area T13",                                          color: "#FF9F00" },
        { id: "esc12_ddv",   name: "DDV DERECHO",                                       color: "#FF6EC7" },
        { id: "esc12_dvia",  name: "Derecho de via P",                                  color: "#CCFF00" },
        { id: "esc12_znube", name: "Escenario 12 Nube toxica Zona de Amortiguamiento",  color: "#F44336" },
        { id: "esc12_nube2", name: "Escenario Nube toxica Amortiguamiento 12",          color: "#FF4500" },
        { id: "esc12_pnorte",name: "Predio NORTE",                                      color: "#FFD700" },
        { id: "esc12_psur",  name: "Predio Sur",                                        color: "#FF3EFF" },
        { id: "esc12_a",     name: "a",                                                 color: "#4DFFFF" },
        { id: "esc12_b",     name: "b",                                                 color: "#00FF41" },
        { id: "esc12_c",     name: "c",                                                 color: "#FF5EFF" },
        { id: "esc12_camino",name: "camino",                                            color: "#00BFFF" },
      ] },
  ];

  for (const sc of eScenarioDefs) {
    if (!map.getSource(sc.sourceId)) {
      map.addSource(sc.sourceId, { type: "vector", url: `pmtiles://data/${sc.file}` });
    }
    for (const sub of sc.subLayers) {
      if (!map.getLayer(sub.id)) {
        map.addLayer({
          id: sub.id, type: "fill", source: sc.sourceId, "source-layer": sc.sourceLayer,
          filter: ["==", ["get", "Name"], sub.name],
          paint: { "fill-color": sub.color, "fill-opacity": 0.35, "fill-antialias": true },
        });
      }
      if (!map.getLayer(`${sub.id}-glow`)) {
        map.addLayer({
          id: `${sub.id}-glow`, type: "line", source: sc.sourceId, "source-layer": sc.sourceLayer,
          filter: ["==", ["get", "Name"], sub.name],
          paint: { "line-color": sub.color, "line-width": 8, "line-opacity": 0.35, "line-blur": 6 },
        });
      }
      if (!map.getLayer(`${sub.id}-border`)) {
        map.addLayer({
          id: `${sub.id}-border`, type: "line", source: sc.sourceId, "source-layer": sc.sourceLayer,
          filter: ["==", ["get", "Name"], sub.name],
          paint: { "line-color": sub.color, "line-width": 1, "line-opacity": 0.85 },
        });
      }
    }
  }

  /*== E07a y E07b — capa única (1 feature cada una) ==*/
  const e07Single = [
    { id: "e07a", color: "#4CAF50", file: "E07_Zona de Amortiguamiento_Ducto de Metanol.pmtiles",            sourceLayer: "E07_ZonadeAmortiguamiento_DuctodeMetanol_tile" },
    { id: "e07b", color: "#A5D6A7", file: "E07_Zona_de_Amortiguamiento_Ducto_de_Metanol-Buffer_Eje.pmtiles", sourceLayer: "E07_Zona_de_Amortiguamiento_Ducto_de_MetanolBuffer_Eje_tile" },
  ];
  for (const sc of e07Single) {
    if (!map.getSource(sc.id)) map.addSource(sc.id, { type: "vector", url: `pmtiles://data/${sc.file}` });
    if (!map.getLayer(sc.id)) {
      map.addLayer({ id: sc.id, type: "fill", source: sc.id, "source-layer": sc.sourceLayer,
        paint: { "fill-color": sc.color, "fill-opacity": 0.35, "fill-antialias": true } });
    }
    if (!map.getLayer(`${sc.id}-glow`)) {
      map.addLayer({ id: `${sc.id}-glow`, type: "line", source: sc.id, "source-layer": sc.sourceLayer,
        paint: { "line-color": sc.color, "line-width": 8, "line-opacity": 0.35, "line-blur": 6 } });
    }
    if (!map.getLayer(`${sc.id}-border`)) {
      map.addLayer({ id: `${sc.id}-border`, type: "line", source: sc.id, "source-layer": sc.sourceLayer,
        paint: { "line-color": sc.color, "line-width": 1, "line-opacity": 0.85 } });
    }
  }

  /*== Centros Escolares ==*/
  const educLayers: { id: string; file: string; sourceLayer: string; color: string }[] = [
    { id: "educ_preesc_pub",    file: "educ_escuelas_preescolar_pub_1122_xy_p_clipped.pmtiles",  sourceLayer: "educ_escuelas_preescolar_pub_1122_xy_p_clipped_tile",  color: "#FFD54F" },
    { id: "educ_preesc_priv",   file: "educ_escuelas_preescolar_priv_1122_xy_p_clipped.pmtiles", sourceLayer: "educ_escuelas_preescolar_priv_1122_xy_p_clipped_tile", color: "#FFA726" },
    { id: "educ_prim_pub",      file: "educ_esc_primaria_pub_1122_xy_p_clipped.pmtiles",         sourceLayer: "educ_esc_primaria_pub_1122_xy_p_clipped_tile",         color: "#66BB6A" },
    { id: "educ_prim_priv",     file: "educ_esc_primaria_priv_1122_xy_p_clipped.pmtiles",        sourceLayer: "educ_esc_primaria_priv_1122_xy_p_clipped_tile",        color: "#26A69A" },
    { id: "educ_media_sup_pub", file: "educ_escuelas_media_sup_pub_1122_xy_p_clipped.pmtiles",   sourceLayer: "educ_escuelas_media_sup_pub_1122_xy_p_clipped_tile",   color: "#42A5F5" },
    { id: "educ_media_sup_priv",file: "educ_escuelas_media_sup_priv_1122_xy_p_clipped.pmtiles",  sourceLayer: "educ_escuelas_media_sup_priv_1122_xy_p_clipped_tile",  color: "#7E57C2" },
    { id: "educ_media_tec_priv",file: "educ_escuelas_media_tec_priv_1122_xy_p_clipped.pmtiles",  sourceLayer: "educ_escuelas_media_tec_priv_1122_xy_p_clipped_tile",  color: "#EC407A" },
    { id: "educ_superior_pub",  file: "educ_esc_superior_pub_1122_xy_p_clipped.pmtiles",         sourceLayer: "educ_esc_superior_pub_1122_xy_p_clipped_tile",         color: "#26C6DA" },
    { id: "educ_superior_priv", file: "educ_esc_superior_priv_1122_xy_p_clipped.pmtiles",        sourceLayer: "educ_esc_superior_priv_1122_xy_p_clipped_tile",        color: "#AB47BC" },
  ];
  for (const ed of educLayers) {
    if (!map.getSource(ed.id)) {
      map.addSource(ed.id, { type: "vector", url: `pmtiles://data/${ed.file}` });
    }
    const educIconId = `sq-${ed.color.replace("#", "")}`;
    if (!map.hasImage(educIconId)) {
      map.addImage(educIconId, createMapIcon("square", ed.color, 32));
    }
    if (!map.getLayer(ed.id)) {
      map.addLayer({
        id: ed.id,
        type: "symbol",
        source: ed.id,
        "source-layer": ed.sourceLayer,
        layout: {
          "icon-image": educIconId,
          "icon-size": 0.75,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": 0.88 },
      });
    }
  }

  /*== Ejidos afectados — sub-capas por NOM_NUC ==*/
  if (!map.getSource("ejidos")) {
    map.addSource("ejidos", { type: "vector", url: "pmtiles://data/ejidos_afectados_mexinol.pmtiles" });
  }
  const ejidosCats: { id: string; nomNuc: string; color: string }[] = [
    { id: "ejidos_rosendo", nomNuc: "ROSENDO G. CASTRO", color: "#1E5B4F" },
    { id: "ejidos_topoviejo", nomNuc: "TOPOVIEJO",       color: "#002F2A" },
  ];
  for (const ej of ejidosCats) {
    if (!map.getLayer(ej.id)) {
      map.addLayer({
        id: ej.id,
        type: "fill",
        source: "ejidos",
        "source-layer": "ejidos_afectados_mexinol_tile",
        filter: ["==", ["get", "NOM_NUC"], ej.nomNuc],
        paint: { "fill-color": ej.color, "fill-opacity": 0.45, "fill-antialias": false },
      });
    }
    if (!map.getLayer(`${ej.id}-border`)) {
      map.addLayer({
        id: `${ej.id}-border`,
        type: "line",
        source: "ejidos",
        "source-layer": "ejidos_afectados_mexinol_tile",
        filter: ["==", ["get", "NOM_NUC"], ej.nomNuc],
        paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.7 },
      });
    }
  }

  /*== Hospitales ==*/
  const saluLayers: { id: string; file: string; sourceLayer: string; color: string }[] = [
    { id: "salu_pub",  file: "salu_hospitales_generales_pub_1122_xy_p_clipped.pmtiles",  sourceLayer: "salu_hospitales_generales_pub_1122_xy_p_clipped_tile",  color: "#EF5350" },
    { id: "salu_priv", file: "salu_hospitales_generales_priv_1122_xy_p_clipped.pmtiles", sourceLayer: "salu_hospitales_generales_priv_1122_xy_p_clipped_tile", color: "#FF8A65" },
  ];
  for (const sl of saluLayers) {
    if (!map.getSource(sl.id)) {
      map.addSource(sl.id, { type: "vector", url: `pmtiles://data/${sl.file}` });
    }
    const saluIconId = `cx-${sl.color.replace("#", "")}`;
    if (!map.hasImage(saluIconId)) {
      map.addImage(saluIconId, createMapIcon("cross", sl.color, 34));
    }
    if (!map.getLayer(sl.id)) {
      map.addLayer({
        id: sl.id,
        type: "symbol",
        source: sl.id,
        "source-layer": sl.sourceLayer,
        layout: {
          "icon-image": saluIconId,
          "icon-size": 0.95,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": 0.92 },
      });
    }
  }

  /*== Localidades Indígenas INPI — Ahome ==*/
  if (!map.getSource("localidades_inpi")) {
    map.addSource("localidades_inpi", {
      type: "vector",
      url: "pmtiles://data/localidades_indígenas_INPI_ahome.pmtiles",
    });
  }
  if (!map.getLayer("localidades_inpi")) {
    map.addLayer({
      id: "localidades_inpi",
      type: "circle",
      source: "localidades_inpi",
      "source-layer": "localidades_indígenas_INPI_ahome_tile",
      paint: {
        "circle-color": "#ec3db8",
        "circle-radius": 5,
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 0.8,
      },
    });
  }

  /*== Asentamientos Comunidad ==*/
  if (!map.getSource("asent_com")) {
    map.addSource("asent_com", {
      type: "vector",
      url: "pmtiles://data/asentamientos_comunidad.pmtiles",
    });
  }
  if (!map.getLayer("asent_com-halo")) {
    map.addLayer({
      id: "asent_com-halo",
      type: "circle",
      source: "asent_com",
      "source-layer": "asentamientos_comunidad_tile",
      paint: {
        "circle-color": "#ff7626",
        "circle-radius": 10,
        "circle-opacity": 0.12,
        "circle-stroke-width": 0,
      },
    });
  }
  if (!map.getLayer("asent_com-pulse")) {
    map.addLayer({
      id: "asent_com-pulse",
      type: "circle",
      source: "asent_com",
      "source-layer": "asentamientos_comunidad_tile",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 12,
        "circle-opacity": 0,
        "circle-stroke-color": "#ff7626",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.4,
      },
    });
  }
  if (!map.getLayer("asent_com")) {
    map.addLayer({
      id: "asent_com",
      type: "circle",
      source: "asent_com",
      "source-layer": "asentamientos_comunidad_tile",
      paint: {
        "circle-color": "#ff7626",
        "circle-radius": 4,
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 0.5,
      },
    });
  }

  /*== Áreas Naturales Protegidas — Ahome ==*/
  if (!map.getSource("anp_ahome")) {
    map.addSource("anp_ahome", { type: "vector", url: "pmtiles://data/anp_ahome_sin_clipped.pmtiles" });
  }
  if (!map.getLayer("anp_ahome")) {
    map.addLayer({
      id: "anp_ahome",
      type: "fill",
      source: "anp_ahome",
      "source-layer": "anp_ahome_sin_clipped_tile",
      paint: { "fill-color": "#AEEA00", "fill-opacity": 0.4, "fill-antialias": false },
    });
  }

  /*== Cuerpos de Agua — sub-capas por condición ==*/
  if (!map.getSource("cuerpos_agua")) {
    map.addSource("cuerpos_agua", { type: "vector", url: "pmtiles://data/cuerpos_agua_ahome.pmtiles" });
  }
  const cuerposAguaCats: { id: string; condicion: string; color: string }[] = [
    { id: "cuerpos_agua_perenne",  condicion: "Perenne",      color: "#0288D1" },
    { id: "cuerpos_agua_intermit", condicion: "Intermitente", color: "#81D4FA" },
  ];
  for (const ca of cuerposAguaCats) {
    if (!map.getLayer(ca.id)) {
      map.addLayer({
        id: ca.id,
        type: "fill",
        source: "cuerpos_agua",
        "source-layer": "cuerpos_agua_ahome_tile",
        filter: ["==", ["get", "condicion"], ca.condicion],
        paint: { "fill-color": ca.color, "fill-opacity": 0.55, "fill-antialias": false },
      });
    }
  }

  /*== Uso de Suelo — sub-capas filtradas por descripcion ==*/
  if (!map.getSource("uso_suelo")) {
    map.addSource("uso_suelo", { type: "vector", url: "pmtiles://data/uso_suelo_ahome_clipped.pmtiles" });
  }
  const usoSueloCats: { id: string; descripcion: string; color: string }[] = [
    { id: "uso_suelo_acuicola",    descripcion: "Acuícola",                                    color: "#00ACC1" },
    { id: "uso_suelo_riego_anual", descripcion: "Agricultura de riego anual",                  color: "#388E3C" },
    { id: "uso_suelo_riego_semi",  descripcion: "Agricultura de riego anual y semipermanente", color: "#66BB6A" },
    { id: "uso_suelo_riego_perm",  descripcion: "Agricultura de riego permanente",             color: "#1B5E20" },
    { id: "uso_suelo_temporal",    descripcion: "Agricultura de temporal anual",               color: "#AED581" },
    { id: "uso_suelo_asent_hum",   descripcion: "Asentamientos humanos",                       color: "#FF7043" },
  ];
  for (const cat of usoSueloCats) {
    if (!map.getLayer(cat.id)) {
      map.addLayer({
        id: cat.id,
        type: "fill",
        source: "uso_suelo",
        "source-layer": "uso_suelo_ahome_clipped_tile",
        filter: ["==", ["get", "descripcion"], cat.descripcion],
        paint: { "fill-color": cat.color, "fill-opacity": 0.5, "fill-antialias": false },
      });
    }
  }

  // Overlay de hover/pin para puntos
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

const ahomeBounds: [LngLatLike, LngLatLike] = [[-109.62, 25.0], [-108.1, 26.4]];

/*== Genera ImageData para iconos de símbolo (cuadrado / cruz) con efecto blur translúcido ==*/
const createMapIcon = (shape: "square" | "cross", color: string, size = 32): ImageData => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.38;
  ctx.globalAlpha = 0.9;
  if (shape === "square") {
    const pad = 7;
    ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
  } else {
    const arm = Math.round(size * 0.30);
    const c = size / 2;
    const h = arm / 2;
    ctx.fillRect(3, c - h, size - 6, arm);
    ctx.fillRect(c - h, 3, arm, size - 6);
  }
  return ctx.getImageData(0, 0, size, size);
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
  const [groupChildOrders2, setGroupChildOrders2] = useState<Record<string, string[]>>({});
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

  // Refs específicas de Panel 2 para tooltips
  const isMeasuringRef2 = useRef(isMeasuring2);
  const isMeasuringLineRef2 = useRef(isMeasuringLine2);
  isMeasuringRef2.current = isMeasuring2;
  isMeasuringLineRef2.current = isMeasuringLine2;
  const pinnedPuebloIdRef2 = useRef<number | null>(null);
  const pinnedComindIdRef2 = useRef<number | null>(null);
  const prevMapViewRef2 = useRef<{ center: maplibregl.LngLatLike; zoom: number; bearing: number; pitch: number } | null>(null);
  const asentPulseId2 = useRef<number | null>(null);
  const [pinnedComindData2, setPinnedComindData2] = useState<Record<string, any> | null>(null);
  const pinnedComindSetRef2 = useRef(setPinnedComindData2);
  pinnedComindSetRef2.current = setPinnedComindData2;

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
  const attachAllTooltipEvents = useCallback((map: MaplibreMap, panelCfg?: {
    isMeasuringRef: React.MutableRefObject<boolean>;
    isMeasuringLineRef: React.MutableRefObject<boolean>;
    pinnedPuebloIdRef: React.MutableRefObject<number | null>;
    pinnedComindIdRef: React.MutableRefObject<number | null>;
    pinnedComindSetRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<Record<string, any> | null>>>;
    prevMapViewRef: React.MutableRefObject<{ center: maplibregl.LngLatLike; zoom: number; bearing: number; pitch: number } | null>;
    asentPulseId: React.MutableRefObject<number | null>;
  }) => {
    // Aliases: usa refs del cfg (Panel 2) o los de Panel 1 por defecto
    const _isMeasuringRef      = panelCfg?.isMeasuringRef      ?? isMeasuringRef;
    const _isMeasuringLineRef  = panelCfg?.isMeasuringLineRef  ?? isMeasuringLineRef;
    const _pinnedPuebloIdRef   = panelCfg?.pinnedPuebloIdRef   ?? pinnedPuebloIdRef;
    const _pinnedComindIdRef   = panelCfg?.pinnedComindIdRef   ?? pinnedComindIdRef;
    const _pinnedComindSetRef  = panelCfg?.pinnedComindSetRef  ?? pinnedComindSetRef;
    const _prevMapViewRef      = panelCfg?.prevMapViewRef      ?? prevMapViewRef;
    const _asentPulseId        = panelCfg?.asentPulseId        ?? asentPulseId;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    const checkMeasurement = () =>
      _isMeasuringRef.current || _isMeasuringLineRef.current;

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

    /*== Helpers de highlight de punto hover (para capas circle) ==*/
    const setHoverPoint = (geom: any, color: string) => {
      if (_pinnedPuebloIdRef.current != null) return;
      try {
        map.setPaintProperty("hover-point", "circle-color", color);
        map.setPaintProperty("hover-point-glow", "circle-color", color);
      } catch {}
      const src = map.getSource("hover-point") as GeoJSONSource | undefined;
      if (src && geom) src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] } as any);
    };
    const clearHoverPoint = () => {
      if (_pinnedPuebloIdRef.current != null) return;
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
        className: "custom-tooltip", maxWidth: "720px",
        offset: [0, -18],
      });
      // camposres_comind es la capa prioritaria: siempre primera y ancla la posición del popup
      const PRIORITY_FIRST = "camposres_comind";
      const hoverLngLatReg: Record<string, maplibregl.LngLat> = {};

      const rebuild = () => {
        const pinned = Object.values(pinnedReg);
        // Ordenar hover: camposres_comind primero, el resto en orden de inserción
        const hoverEntries = Object.entries(hoverReg);
        const priority = hoverEntries.filter(([k]) => k === PRIORITY_FIRST);
        const rest     = hoverEntries.filter(([k]) => k !== PRIORITY_FIRST);
        const hover    = [...priority, ...rest].map(([, v]) => v);
        const all = [...pinned, ...hover];
        if (!all.length) { master.remove(); return; }
        // Posición: si camposres_comind está activa usa su lngLat, si no el último hover, si no el pin
        const lngLat = hoverLngLatReg[PRIORITY_FIRST]
          ?? (hover.length && hoverLngLat ? hoverLngLat : pinnedLngLat);
        if (!lngLat) { master.remove(); return; }
        const html = all.length === 1
          ? all[0]
          : `<div style="display:grid;grid-template-columns:repeat(auto-fill,215px);gap:6px">${all.join("")}</div>`;
        master.setLngLat(lngLat).setHTML(html).addTo(map);
      };
      return {
        show:  (key: string, html: string, ll: maplibregl.LngLat) => {
          hoverReg[key] = html; hoverLngLat = ll; hoverLngLatReg[key] = ll; rebuild();
        },
        hide:  (key: string) => { delete hoverReg[key]; delete hoverLngLatReg[key]; rebuild(); },
        pin:   (key: string, html: string, ll: maplibregl.LngLat) => {
          pinnedReg[key] = html; pinnedLngLat = ll; rebuild();
        },
        unpin: (key: string) => { delete pinnedReg[key]; rebuild(); },
        hasPinned: (key: string) => key in pinnedReg,
      };
    })();

    /*== Tarjeta de tooltip estandarizada: ancho fijo, tipografía uniforme ==*/
    const tc = (accent: string, title: string, rows: Array<[string, string, string?]>) => {
      const body = rows.length
        ? `<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:11px;color:#cdd6f4">` +
          rows.map(([lbl, val, col]) =>
            `<span style="color:#7f849c;white-space:nowrap">${lbl}</span>` +
            `<span style="${col ? `color:${col};font-weight:600` : ""}">${val}</span>`
          ).join("") +
          `</div>`
        : "";
      return `<div style="background:#0f1117;border:1px solid ${accent};border-radius:8px;padding:10px 12px;min-width:200px;max-width:280px;box-sizing:border-box;box-shadow:0 3px 16px ${accent}44">` +
        `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:${rows.length ? "7" : "0"}px">` +
        `<span style="display:inline-block;width:9px;height:9px;flex-shrink:0;border-radius:50%;background:${accent};box-shadow:0 0 5px ${accent};margin-top:2px"></span>` +
        `<strong style="color:${accent};font-size:12px;letter-spacing:0.3px;word-break:break-word;line-height:1.35">${title}</strong>` +
        `</div>${body}</div>`;
    };

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

    /*== Tooltips Área de Impacto Directa (sub-capas por Name) ==*/
    const aipTooltipLayers: { id: string; color: string }[] = [
      { id: "aip_area_t1",     color: "#FF073A" },
      { id: "aip_area_t2",     color: "#FF6B00" },
      { id: "aip_area_t3",     color: "#FFE500" },
      { id: "aip_area_t4",     color: "#39FF14" },
      { id: "aip_area_t5",     color: "#00FFFF" },
      { id: "aip_area_t6",     color: "#00B3FF" },
      { id: "aip_area_t7",     color: "#7B2FFF" },
      { id: "aip_area_t8",     color: "#FF00FF" },
      { id: "aip_area_t9",     color: "#FF1493" },
      { id: "aip_area_t10",    color: "#ADFF2F" },
      { id: "aip_area_t11",    color: "#00FF7F" },
      { id: "aip_area_t12",    color: "#00FFBF" },
      { id: "aip_area_t13",    color: "#FF9F00" },
      { id: "aip_derecho_via", color: "#FF6EC7" },
      { id: "aip_pol_norte",   color: "#CCFF00" },
      { id: "aip_predio_sur",  color: "#FF3EFF" },
      { id: "aip_camino",      color: "#4DFFFF" },
    ];
    for (const at of aipTooltipLayers) {
      addHoverTooltip(at.id, (p) => tc(at.color, p.Name ?? "—", [
        ["Descripción", p.Description ?? "—"],
      ]));
    }

    /*== Tooltips E-escenarios: sub-capas por Name ==*/
    const eSubTooltipLayers: { id: string; color: string }[] = [
      { id: "e01_zona",        color: "#E91E63" },
      { id: "e01_predio",      color: "#39FF14" },
      { id: "e02_zona",        color: "#F48FB1" },
      { id: "e02_predio",      color: "#00FFFF" },
      { id: "e03_zona",        color: "#9C27B0" },
      { id: "e03_predio",      color: "#ADFF2F" },
      { id: "e04_zona",        color: "#CE93D8" },
      { id: "e04_predio",      color: "#FF073A" },
      { id: "e05a_zona",       color: "#00BCD4" },
      { id: "e05a_predio",     color: "#FF6EC7" },
      { id: "e05b_zona",       color: "#80DEEA" },
      { id: "e05b_predio",     color: "#FF6B00" },
      { id: "e06_zona",        color: "#009688" },
      { id: "e06_predio",      color: "#FF3EFF" },
      { id: "e07a",            color: "#4CAF50" },
      { id: "e07b",            color: "#A5D6A7" },
      { id: "e08_zona",        color: "#FF9800" },
      { id: "e08_adecuacion",  color: "#7B2FFF" },
      { id: "e09_zona",        color: "#FFCC80" },
      { id: "e09_adecuacion",  color: "#00FF7F" },
      { id: "e13_zona",        color: "#FFEB3B" },
      { id: "e13_predio",      color: "#00B3FF" },
      { id: "e14_zona",        color: "#FFF176" },
      { id: "e14_predio",      color: "#FF1493" },
      { id: "esc12_t1",        color: "#FF073A" },
      { id: "esc12_t2",        color: "#FF6B00" },
      { id: "esc12_t3",        color: "#FFE500" },
      { id: "esc12_t4",        color: "#39FF14" },
      { id: "esc12_t5",        color: "#00FFFF" },
      { id: "esc12_t6",        color: "#00B3FF" },
      { id: "esc12_t7",        color: "#7B2FFF" },
      { id: "esc12_t8",        color: "#FF00FF" },
      { id: "esc12_t9",        color: "#FF1493" },
      { id: "esc12_t10",       color: "#ADFF2F" },
      { id: "esc12_t11",       color: "#00FF7F" },
      { id: "esc12_t12",       color: "#00FFBF" },
      { id: "esc12_t13",       color: "#FF9F00" },
      { id: "esc12_ddv",       color: "#FF6EC7" },
      { id: "esc12_dvia",      color: "#CCFF00" },
      { id: "esc12_znube",     color: "#F44336" },
      { id: "esc12_nube2",     color: "#FF4500" },
      { id: "esc12_pnorte",    color: "#FFD700" },
      { id: "esc12_psur",      color: "#FF3EFF" },
      { id: "esc12_a",         color: "#4DFFFF" },
      { id: "esc12_b",         color: "#00FF41" },
      { id: "esc12_c",         color: "#FF5EFF" },
      { id: "esc12_camino",    color: "#00BFFF" },
    ];
    for (const es of eSubTooltipLayers) {
      addHoverTooltip(es.id, (p) => tc(es.color, p.Name ?? p.name ?? es.id.toUpperCase(), [
        ...(p.Description ?? p.description ? [["Descripción", p.Description ?? p.description] as [string, string]] : []),
      ]));
    }

    /*== Tooltips Centros Escolares ==*/
    const educTooltipDefs: { id: string; label: string; color: string }[] = [
      { id: "educ_preesc_pub",    label: "Preescolar Público",    color: "#FFD54F" },
      { id: "educ_preesc_priv",   label: "Preescolar Privado",    color: "#FFA726" },
      { id: "educ_prim_pub",      label: "Primaria Pública",      color: "#66BB6A" },
      { id: "educ_prim_priv",     label: "Primaria Privada",      color: "#26A69A" },
      { id: "educ_media_sup_pub", label: "Media Superior Pública",color: "#42A5F5" },
      { id: "educ_media_sup_priv",label: "Media Superior Privada",color: "#7E57C2" },
      { id: "educ_media_tec_priv",label: "Media Técnica Privada", color: "#EC407A" },
      { id: "educ_superior_pub",  label: "Superior Pública",      color: "#26C6DA" },
      { id: "educ_superior_priv", label: "Superior Privada",      color: "#AB47BC" },
    ];
    for (const ed of educTooltipDefs) {
      addHoverTooltip(ed.id, (p) => tc(ed.color, p.nom_estab ?? p.nombre ?? ed.label, [
        ["Municipio", p.nom_mun ?? "—"],
        ["Localidad", p.nom_loc ?? "—"],
      ]));
      map.on("mouseenter", ed.id, () => { if (map.getLayer(ed.id)) map.setLayoutProperty(ed.id, "icon-size", 1.05); });
      map.on("mouseleave", ed.id, () => { if (map.getLayer(ed.id)) map.setLayoutProperty(ed.id, "icon-size", 0.75); });
    }

    /*== Tooltip Ejidos Afectados ==*/
    const ejidosTooltipDefs = [
      { id: "ejidos_rosendo",   color: "#1e5b4f" },
      { id: "ejidos_topoviejo", color: "#002f2a" },
    ];
    for (const ej of ejidosTooltipDefs) {
      addHoverTooltip(ej.id, (p) => tc(ej.color, p.NOM_NUC ?? "—", [
        ["Municipio", p.MUNICIPIO ?? "—"],
        ["Clave",     p.CLAVE ?? "—"],
      ]));
    }

    /*== Tooltips Hospitales ==*/
    const saluTooltipDefs = [
      { id: "salu_pub",  label: "Hospital Público",  color: "#EF5350" },
      { id: "salu_priv", label: "Hospital Privado",  color: "#FF8A65" },
    ];
    for (const sl of saluTooltipDefs) {
      addHoverTooltip(sl.id, (p) => tc(sl.color, p.nom_estab ?? sl.label, [
        ["Municipio", p.nom_mun ?? "—"],
        ["Localidad", p.nom_loc ?? "—"],
      ]));
      map.on("mouseenter", sl.id, () => { if (map.getLayer(sl.id)) map.setLayoutProperty(sl.id, "icon-size", 1.25); });
      map.on("mouseleave", sl.id, () => { if (map.getLayer(sl.id)) map.setLayoutProperty(sl.id, "icon-size", 0.95); });
    }

    /*== Tooltip Localidades Indígenas INPI ==*/
    addHoverTooltip("localidades_inpi", (p) => tc("#ec3db8", p.NOM_LOC ?? "—", [
      ["Municipio", p.NOM_MUN ?? "—"],
      ["Estado",    p.NOM_ENT ?? "—"],
    ]));

    /*== Tooltip Asentamientos Comunidad ==*/
    addHoverTooltip("asent_com", (p) => tc("#ff7626", p.Nombre ?? p.Localidad ?? "—", [
      ["Categoría",  p["Categoría"] ?? p.Categoria ?? "—"],
      ["Municipio",  p.Municipio ?? "—"],
      ["Población",  p["Población"] ?? p.Poblacion ?? "—", "#ff7626"],
    ]));

    /*== Tooltip ANP Ahome ==*/
    addHoverTooltip("anp_ahome", (p) => tc("#AEEA00", p.nom_anp ?? "—", [
      ["Región",     p.nom_region ?? "—"],
      ["Superficie", p.superficie != null ? Number(p.superficie).toLocaleString("es-MX") + " ha" : "—", "#AEEA00"],
    ]));

    /*== Tooltips Cuerpos de Agua (sub-capas por condición) ==*/
    const cuerposAguaTooltipLayers: { id: string; color: string }[] = [
      { id: "cuerpos_agua_perenne",  color: "#0288D1" },
      { id: "cuerpos_agua_intermit", color: "#81D4FA" },
    ];
    for (const ca of cuerposAguaTooltipLayers) {
      addHoverTooltip(ca.id, (p) => tc(ca.color, p.nom_geo ?? p.nom_obj ?? "—", [
        ["Condición", p.condicion ?? "—"],
        ["Tipo",      p.term_gen ?? p.nom_cono ?? "—"],
      ]));
    }

    /*== Tooltips Uso de Suelo (sub-capas por descripción) ==*/
    const usoSueloTooltipLayers: { id: string; color: string }[] = [
      { id: "uso_suelo_acuicola",    color: "#00ACC1" },
      { id: "uso_suelo_riego_anual", color: "#388E3C" },
      { id: "uso_suelo_riego_semi",  color: "#66BB6A" },
      { id: "uso_suelo_riego_perm",  color: "#1B5E20" },
      { id: "uso_suelo_temporal",    color: "#AED581" },
      { id: "uso_suelo_asent_hum",   color: "#FF7043" },
    ];
    for (const uc of usoSueloTooltipLayers) {
      addHoverTooltip(uc.id, (p) => tc(uc.color, p.descripcion ?? "—", []));
    }

    // === placeholder — getComindHTML no usado en mexinol ===
    const getComindHTML = (_p: any) => "";


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

      const calculateDistance = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
      ) => {
        const R = 6371;
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

  const animateTerrainExaggeration = useCallback(
    (map: any, targetExaggeration: number, duration: number = 2000) => {
      const startTime = Date.now();
      const startExaggeration = 0;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

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

  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentIsSatellite = isSatellite;
    const newIs3D = !is3D;

    if (map.getTerrain()) {
      map.setTerrain(null);
    }
    if (map.getLayer("sky")) {
      map.removeLayer("sky");
    }

    setIs3D(newIs3D);

    const newStyle = getStyle(currentIsSatellite, newIs3D, isDarkRef.current);
    const isSatTerrain = currentIsSatellite && newIs3D;

    map.setStyle(newStyle, { diff: false });

    map.once("styledata", () => {
      addVectorLayers(map);

      updateLayerVisibility(map);
        routesData.forEach((route) => drawSingleRouteOnMap(map, route));
        linesData.forEach((line) => drawSingleLineOnMap(map, line));
        attachAllTooltipEvents(map);

        map.jumpTo({
          center: currentCenter,
          zoom: currentZoom,
          bearing: currentBearing,
          pitch: 0,
        });

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

  const applyOrRemove3DEffects = (
    map: any,
    is3DActive: boolean,
    isSatelliteActive: boolean,
  ) => {
    if (is3DActive) {
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

        map.setTerrain({
          source: "terrain-rgb",
          exaggeration: 0.1,
        });

        animateTerrainExaggeration(map, exaggeration, 2500);

        if (!map.getLayer("sky")) {
          const skyPaint = isSatelliteActive
            ? { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 0.0], "sky-atmosphere-sun-intensity": sunIntensity }
            : { "sky-type": "gradient", "sky-gradient": ["interpolate", ["linear"], ["sky-radial-progress"], 0.8, "rgba(0,0,0,1)", 1, "rgba(0,0,0,1)"], "sky-gradient-center": [0, 0] };
          map.addLayer({ id: "sky", type: "sky", paint: skyPaint } as any);
        }

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
    setIsMeasuringLine(false);
    if (wasMeasuring) clearAllRoutes();
    setCurrentPoints([]);
    setCurrentLinePoints([]);
  };

  const toggleLineMeasurement = () => {
    const wasMeasuringLine = isMeasuringLine;
    setIsMeasuringLine(!wasMeasuringLine);
    setIsMeasuring(false);
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

  const toggleMeasurement2 = () => {
    const wasMeasuring = isMeasuring2;
    setIsMeasuring2(!wasMeasuring);
    setIsMeasuringLine2(false);
    if (wasMeasuring) clearAllRoutes2();
    setCurrentPoints2([]);
    setCurrentLinePoints2([]);
  };

  const toggleLineMeasurement2 = () => {
    const wasMeasuringLine = isMeasuringLine2;
    setIsMeasuringLine2(!wasMeasuringLine);
    setIsMeasuring2(false);
    if (wasMeasuringLine) clearAllRoutes2();
    setCurrentPoints2([]);
    setCurrentLinePoints2([]);
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
        attachAllTooltipEvents(map2, { isMeasuringRef: isMeasuringRef2, isMeasuringLineRef: isMeasuringLineRef2, pinnedPuebloIdRef: pinnedPuebloIdRef2, pinnedComindIdRef: pinnedComindIdRef2, pinnedComindSetRef: pinnedComindSetRef2, prevMapViewRef: prevMapViewRef2, asentPulseId: asentPulseId2 });
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
      attachAllTooltipEvents(map2, { isMeasuringRef: isMeasuringRef2, isMeasuringLineRef: isMeasuringLineRef2, pinnedPuebloIdRef: pinnedPuebloIdRef2, pinnedComindIdRef: pinnedComindIdRef2, pinnedComindSetRef: pinnedComindSetRef2, prevMapViewRef: prevMapViewRef2, asentPulseId: asentPulseId2 });
      routesData2.forEach((r) => drawSingleRouteOnMap(map2, r));
      linesData2.forEach((l) => drawSingleLineOnMap(map2, l));
      map2.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: currentBearing, pitch: currentPitch });
      if (is3D2) setTimeout(() => applyOrRemove3DEffects(map2, true, newIsSatellite), 200);
    });
  };

  const clearCurrentPoints2 = useCallback(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    [
      "start-point-2-current", "start-point-2-current-pulse",
      "end-point-2-current",   "end-point-2-current-pulse",
      "start-point-2-line-current", "start-point-2-line-current-pulse",
      "end-point-2-line-current",   "end-point-2-line-current-pulse",
    ].forEach((id) => { try { if (map2.getLayer(id)) map2.removeLayer(id); } catch {} });
    [
      "start-point-2-current", "end-point-2-current",
      "start-point-2-line-current", "end-point-2-line-current",
    ].forEach((id) => { try { if (map2.getSource(id)) map2.removeSource(id); } catch {} });
  }, []);

  const clearAllRoutes2 = useCallback(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    routesData2.forEach(({ id }) => {
      if (map2.getLayer(`route-layer-${id}`))   map2.removeLayer(`route-layer-${id}`);
      if (map2.getSource(`route-source-${id}`)) map2.removeSource(`route-source-${id}`);
      if (map2.getLayer(`start-point-${id}`))   map2.removeLayer(`start-point-${id}`);
      if (map2.getSource(`start-point-${id}`))  map2.removeSource(`start-point-${id}`);
      if (map2.getLayer(`end-point-${id}`))     map2.removeLayer(`end-point-${id}`);
      if (map2.getSource(`end-point-${id}`))    map2.removeSource(`end-point-${id}`);
    });
    linesData2.forEach(({ id }) => {
      if (map2.getLayer(`line-layer-${id}`))         map2.removeLayer(`line-layer-${id}`);
      if (map2.getSource(`line-source-${id}`))       map2.removeSource(`line-source-${id}`);
      if (map2.getLayer(`start-line-point-${id}`))   map2.removeLayer(`start-line-point-${id}`);
      if (map2.getSource(`start-line-point-${id}`))  map2.removeSource(`start-line-point-${id}`);
      if (map2.getLayer(`end-line-point-${id}`))     map2.removeLayer(`end-line-point-${id}`);
      if (map2.getSource(`end-line-point-${id}`))    map2.removeSource(`end-line-point-${id}`);
    });
    setRoutesData2([]);
    setLinesData2([]);
    clearCurrentPoints2();
  }, [routesData2, linesData2, clearCurrentPoints2]);

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
    const currentPitch = map.getPitch();
    const was3D = is3D;
    const newIsSatellite = !isSatellite;

    if (map.getTerrain()) map.setTerrain(null);
    if (map.getLayer("sky")) map.removeLayer("sky");

    setIsSatellite(newIsSatellite);

    const newStyleUrl = getStyleUrl(newIsSatellite, was3D, isDarkRef.current);

    map.setStyle(newStyleUrl, { diff: false });

    map.once("styledata", () => {
      addVectorLayers(map);
      updateLayerVisibility(map);
      routesData.forEach((route) => drawSingleRouteOnMap(map, route));
      linesData.forEach((line) => drawSingleLineOnMap(map, line));
      attachAllTooltipEvents(map);

      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: was3D ? currentPitch : 0,
      });

      if (was3D) {
        if (!map.getSource("terrain-rgb")) {
          map.addSource("terrain-rgb", {
            type: "raster-dem",
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${API_KEY}`,
            tileSize: 256,
          });
        }

        const exaggeration = newIsSatellite ? 1.2 : 1.5;
        const sunIntensity = newIsSatellite ? 3 : 5;

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
    isDarkRef.current = newIsDark;

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
      map.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: currentBearing, pitch: 0 });
    });
  };

  /*== Animación continua de la brújula ==*/
  const animateCompass = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      compassAnimId.current = requestAnimationFrame(animateCompass);
      return;
    }

    const target = map.getBearing();
    const current = displayBearingRef.current;

    const diff = ((target - current + 540) % 360) - 180;

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

    const map = new maplibregl.Map({
      container,
      style: BASE_STYLE_URL,
      center: [-109.05496, 25.62861],
      zoom: 10.5,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      maxBounds: ahomeBounds,
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

      // Aplicar visibilidad inicial desde el estado (ocultar todo y dejar visibles los indicados)
      Object.keys(vis1Ref.current).forEach((id) => {
        const vis = vis1Ref.current[id] ? "visible" : "none";
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
        [`${id}-border`, `${id}-glow`].forEach((companion) => {
          if (map.getLayer(companion)) map.setLayoutProperty(companion, "visibility", vis);
        });
        if (id === "asent_com") {
          ["asent_com-halo", "asent_com-pulse"].forEach((sub) => {
            if (map.getLayer(sub)) map.setLayoutProperty(sub, "visibility", vis);
          });
        }
      });

      // Capas de utilidad siempre encima de los datos
      ["hover-point-glow", "hover-point"].forEach((sub) => {
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
          if (map.getLayer("asent_com")) map.setPaintProperty("asent_com", "circle-radius", 3.5 + 1.5 * pulseProgress);
          if (map.getLayer("asent_com-halo")) {
            map.setPaintProperty("asent_com-halo", "circle-radius", 9 + 5 * pulseProgress);
            map.setPaintProperty("asent_com-halo", "circle-opacity", 0.1 + 0.14 * pulseProgress);
          }
          if (map.getLayer("asent_com-pulse")) {
            map.setPaintProperty("asent_com-pulse", "circle-radius", pulseRadius * 0.8);
            map.setPaintProperty("asent_com-pulse", "circle-stroke-opacity", pulseOpacity * 0.5);
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

  const updateLayerVisibility = React.useCallback(
    (map: maplibregl.Map) => {
      Object.entries(layersVisibility).forEach(([id, visible]) => {
        const vis = visible ? "visible" : "none";
        try {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
          const borderLayer = `${id}-border`;
          if (map.getLayer(borderLayer)) map.setLayoutProperty(borderLayer, "visibility", vis);
          const glowLayer = `${id}-glow`;
          if (map.getLayer(glowLayer)) map.setLayoutProperty(glowLayer, "visibility", vis);
          if (id === "asent_com") {
            ["asent_com-halo", "asent_com-pulse"].forEach((sub) => {
              if (map.getLayer(sub)) map.setLayoutProperty(sub, "visibility", vis);
            });
          }
        } catch {}
      });
      // Utility layers always on top
      ["hover-point-glow", "hover-point"].forEach((sub) => {
        try { if (map.getLayer(sub)) map.moveLayer(sub); } catch {}
      });
    },
    [layersVisibility],
  );

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
          map.setPaintProperty(id, prop, opacity);
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
        // Companion layers: border + glow (E-escenarios, AIP, etc.)
        const borderLayer = `${id}-border`;
        if (map2.getLayer(borderLayer)) map2.setLayoutProperty(borderLayer, "visibility", vis);
        const glowLayer = `${id}-glow`;
        if (map2.getLayer(glowLayer)) map2.setLayoutProperty(glowLayer, "visibility", vis);
        if (id === "asent_com") {
          ["asent_com-halo", "asent_com-pulse"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
          });
        }
        if (id === "comind") {
          ["comind-halo", "comind-pulse"].forEach((sub) => {
            if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
          });
        }
        if (id === "ent") {
          ["ent-click-border", "ent-border"].forEach((sub) => {
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
    // Capas de utilidad siempre al frente
    [
      "ent-click-border",
      "hover-point-glow", "hover-point",
      "asentamientos-highlight", "asentamientos-labels",
      "asentamientos-comind-dots", "asentamientos-comind-labels",
    ].forEach((sub) => {
      try { if (map2.getLayer(sub)) map2.moveLayer(sub); } catch {}
    });
    ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
      try { if (map2.getLayer(sub)) map2.moveLayer(sub); } catch {}
    });
    // Opacidad — misma lógica que Panel 1 (ent/mun usan feature-state)
    Object.entries(opa2Ref.current).forEach(([id, opacity]) => {
      const prop = layerOpacityProp[id];
      if (!prop) return;
      try {
        if (!map2.getLayer(id)) return;
        if (id === "ent" || id === "mun") {
          const hoverOpacity = Math.min(opacity * 8, 1);
          const expr = id === "mun"
            ? ["case", ["boolean", ["feature-state", "clicked"], false], 0.3, 0]
            : ["case", ["boolean", ["feature-state", "hover"], false], hoverOpacity, opacity * 0.1];
          map2.setPaintProperty(id, "fill-opacity", expr as any);
        } else {
          map2.setPaintProperty(id, prop, opacity);
        }
      } catch {}
    });
  };

  /*== Panel 2 — ciclo de vida: crear al abrir, destruir al cerrar (con retraso para animación) ==*/
  useEffect(() => {
    if (!splitActive) {
      const tid = setTimeout(() => {
        if (map2Ref.current) {
          map2Ref.current.remove();
          map2Ref.current = null;
        }
      }, 440);
      return () => clearTimeout(tid);
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
    // Inicializar orden de hijos de grupos desde sections
    const initGroups: Record<string, string[]> = {};
    const extractGroups2 = (items: LegendItem[]) => {
      items.forEach(item => {
        if (item.type === "group" && item.children) {
          initGroups[item.id] = item.children.map(c => c.id);
          extractGroups2(item.children);
        }
      });
    };
    sections.forEach(s => extractGroups2(s.items));
    setGroupChildOrders2(initGroups);
    const currentIsSat = isSatellite;
    const currentIs3D = is3D;
    setIsSatellite2(currentIsSat);
    setIs3D2(currentIs3D);

    const map1 = mapRef.current;
    const map2 = new maplibregl.Map({
      container: container2Ref.current,
      style: getStyleUrl(currentIsSat, currentIs3D, isDark),
      center: map1 ? map1.getCenter() : [-101.28044, 23.65978],
      zoom:   map1 ? map1.getZoom()   : 4.73,
      pitch:  map1 ? map1.getPitch()  : 0,
      bearing: map1 ? map1.getBearing() : 0,
      attributionControl: false,
      maxBounds: ahomeBounds,
      maxPitch: 85,
    });
    map2Ref.current = map2;

    map2.on("load", () => {
      addVectorLayers(map2);
      applyPanel2State(map2);
      attachAllTooltipEvents(map2, { isMeasuringRef: isMeasuringRef2, isMeasuringLineRef: isMeasuringLineRef2, pinnedPuebloIdRef: pinnedPuebloIdRef2, pinnedComindIdRef: pinnedComindIdRef2, pinnedComindSetRef: pinnedComindSetRef2, prevMapViewRef: prevMapViewRef2, asentPulseId: asentPulseId2 });
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
    let tid: ReturnType<typeof setTimeout> | null = null;
    const onStyle = () => {
      addVectorLayers(map2);
      applyPanel2State(map2);
      attachAllTooltipEvents(map2, { isMeasuringRef: isMeasuringRef2, isMeasuringLineRef: isMeasuringLineRef2, pinnedPuebloIdRef: pinnedPuebloIdRef2, pinnedComindIdRef: pinnedComindIdRef2, pinnedComindSetRef: pinnedComindSetRef2, prevMapViewRef: prevMapViewRef2, asentPulseId: asentPulseId2 });
      if (is3D2) tid = setTimeout(() => applyOrRemove3DEffects(map2, true, isSatellite2), 200);
    };
    map2.once("styledata", onStyle);
    return () => {
      map2.off("styledata", onStyle);
      if (tid !== null) clearTimeout(tid);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  /*== Panel 2 — visibilidad → map2 (espejo exacto de updateLayerVisibility) ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const apply = () => {
      Object.entries(layersVisibility2).forEach(([id, visible]) => {
        const vis = visible ? "visible" : "none";
        try {
          if (map2.getLayer(id)) map2.setLayoutProperty(id, "visibility", vis);
          // Companion layers: border + glow (E-escenarios, AIP, etc.)
          const borderLayer = `${id}-border`;
          if (map2.getLayer(borderLayer)) map2.setLayoutProperty(borderLayer, "visibility", vis);
          const glowLayer = `${id}-glow`;
          if (map2.getLayer(glowLayer)) map2.setLayoutProperty(glowLayer, "visibility", vis);
          if (id === "asent_com") {
            ["asent_com-halo", "asent_com-pulse"].forEach((sub) => {
              if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
            });
          }
          if (id === "comind") {
            ["comind-halo", "comind-pulse"].forEach((sub) => {
              if (map2.getLayer(sub)) map2.setLayoutProperty(sub, "visibility", vis);
            });
          }
          if (id === "ent") {
            ["ent-click-border", "ent-border"].forEach((sub) => {
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
      // Capas de utilidad siempre al frente
      [
        "ent-click-border",
        "hover-point-glow", "hover-point",
        "asentamientos-highlight", "asentamientos-labels",
        "asentamientos-comind-dots", "asentamientos-comind-labels",
      ].forEach((sub) => {
        try { if (map2.getLayer(sub)) map2.moveLayer(sub); } catch {}
      });
      ["camposres_comind-halo", "camposres_comind-pulse", "camposres_comind"].forEach((sub) => {
        try { if (map2.getLayer(sub)) map2.moveLayer(sub); } catch {}
      });
    };
    if (map2.isStyleLoaded()) apply();
    else map2.once("styledata", apply);
  }, [layersVisibility2]);

  /*== Panel 2 — opacidad → map2 (espejo exacto de Panel 1, con feature-state para ent/mun) ==*/
  useEffect(() => {
    const map2 = map2Ref.current;
    if (!map2) return;
    const apply = () => {
      Object.entries(layersOpacity2).forEach(([id, opacity]) => {
        const prop = layerOpacityProp[id];
        if (!prop) return;
        try {
          if (!map2.getLayer(id)) return;
          if (id === "ent" || id === "mun") {
            const hoverOpacity = Math.min(opacity * 8, 1);
            const expr = id === "mun"
              ? ["case", ["boolean", ["feature-state", "clicked"], false], 0.3, 0]
              : ["case", ["boolean", ["feature-state", "hover"], false], hoverOpacity, opacity * 0.1];
            map2.setPaintProperty(id, "fill-opacity", expr as any);
          } else {
            map2.setPaintProperty(id, prop, opacity);
          }
        } catch {}
      });
    };
    if (map2.isStyleLoaded()) apply();
    else map2.once("styledata", apply);
  }, [layersOpacity2]);

  // Expansión recursiva igual que App.tsx: ID de grupo → IDs hoja
  const expandId2 = (id: string): string[] => {
    const children = groupChildOrders2[id];
    if (!children) return [id];
    return children.flatMap(expandId2);
  };

  /*== Panel 2 — reordenar capas → map2 ==*/
  const layerOrder2 = sectionOrders2.flat().flatMap(expandId2);
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
  const handleReorderChildren2 = (groupId: string, newChildIds: string[]) =>
    setGroupChildOrders2((prev) => ({ ...prev, [groupId]: newChildIds }));
  const handleToggleAll2 = (visible: boolean) =>
    setLayersVisibility2((prev) =>
      Object.fromEntries(Object.keys(prev).map((id) => [id, visible])),
    );

  /*== Secciones del panel 2 — misma estructura, estado independiente ==*/
  // Patch checked/opacity recursively for all nesting levels
  const patchItems2 = (items: LegendItem[]): LegendItem[] =>
    items.map((item) => {
      if (item.type === "group") {
        return { ...item, children: patchItems2(item.children ?? []) };
      }
      return {
        ...item,
        checked: layersVisibility2[item.id] ?? false,
        opacity: layersOpacity2[item.id] ?? 1,
      };
    });

  const sections2: InfoBoxSection[] = sections.map((section) => ({
    ...section,
    items: patchItems2(section.items),
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
          transition: "right 0.44s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Panel 2 — derecho, animado al abrir/cerrar */}
      <div
        ref={container2Ref}
        style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: splitActive ? `${dividerX}%` : "100%",
          right: 0,
          opacity: splitActive ? 1 : 0,
          pointerEvents: splitActive ? "auto" : "none",
          transition: "left 0.44s cubic-bezier(0.4,0,0.2,1), opacity 0.38s ease",
          overflow: "hidden",
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

      {/* Panel 2 — comunidad indígena en campo de reserva */}
      {splitActive && pinnedComindData2 && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: "70px",
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
              <strong style={{ color: "#ff5252", fontSize: 13, lineHeight: 1.3 }}>{pinnedComindData2.NOM_COM ?? "—"}</strong>
            </div>
            <button
              onClick={() => {
                setPinnedComindData2(null);
                pinnedComindIdRef2.current = null;
                const m = map2Ref.current;
                if (m) {
                  if (m.getLayer("asentamientos-comind-dots")) m.setFilter("asentamientos-comind-dots", ["==", ["literal", 1], 0]);
                  if (m.getLayer("asentamientos-comind-labels")) m.setFilter("asentamientos-comind-labels", ["==", ["literal", 1], 0]);
                  if (prevMapViewRef2.current) {
                    m.flyTo({ ...prevMapViewRef2.current, duration: 800 });
                    prevMapViewRef2.current = null;
                  }
                }
              }}
              style={{ background: "none", border: "none", color: "#D50000", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "0 0 0 8px", flexShrink: 0 }}
              title="Cerrar"
            >×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 11.5, color: "#cdd6f4" }}>
            <span style={{ color: "#7f849c" }}>Estado</span><span>{pinnedComindData2.NOM_ENT ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Municipio</span><span>{pinnedComindData2.NOM_MUN ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Pueblo</span><span>{pinnedComindData2.Pueblo ?? "—"}</span>
            <span style={{ color: "#7f849c" }}>Pob. total</span>
            <span style={{ color: "#ff8a80", fontWeight: 600 }}>
              {pinnedComindData2._pobtot != null
                ? Number(String(pinnedComindData2._pobtot).replace(/,/g, "")).toLocaleString("es-MX")
                : "…"}
            </span>
            <span style={{ color: "#7f849c" }}>Asentamientos</span>
            <span style={{ color: "#ff7626", fontWeight: 700 }}>
              {pinnedComindData2._asentCount != null ? pinnedComindData2._asentCount : "…"}
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
                onReorderChildren={handleReorderChildren2}
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
              <button style={controlButtonStyle} onClick={toggleMeasurement2}
                title={isMeasuring2 ? "Terminar medición de ruta" : "Medir ruta"}>
                <img src={isMeasuring2 ? `./rutac.png` : `./rutabw.png`}
                  alt="Medir ruta" style={bwIconStyle(isMeasuring2)} />
              </button>
              <button style={controlButtonStyle} onClick={toggleLineMeasurement2}
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

            {/* Popups de rutas y líneas del panel 2 — contenedor posicionado al origen del canvas de Panel 2 */}
            <div style={{ position: "absolute", left: `${dividerX}%`, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
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
            </div>
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
