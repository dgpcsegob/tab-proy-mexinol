import React, { useState } from "react";
import InfoBox, { InfoBoxSection, LegendItem } from "./components/InfoBox/InfoBox";
import Map from "./components/Map/Map";
import "./App.css";

// Orden inicial: índice 0 = sección "Zonas", índice 1 = sección "Comunidades"
const INITIAL_SECTION_ORDERS: string[][] = [
  [
    "zonasgeo_group",
    "territoriospi",
    "riesgohi_group",
    "provincias_group",
    "pozosfa_group",
    "areaspotnc",
    "camposres_comind",
    "camposres",
    "diputados_group",
    "anp",
  ],
  ["LocalidadesSedeINPI", "asentamientos"],
];

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  const [sectionOrders, setSectionOrders] = useState<string[][]>(
    INITIAL_SECTION_ORDERS,
  );

  const handleReorder = (sectionIdx: number, newIds: string[]) => {
    setSectionOrders((prev) => {
      const next = [...prev];
      next[sectionIdx] = newIds;
      return next;
    });
  };

  // Expande grupos al aplanar para que moveLayer funcione con los IDs reales de capas
  const GROUP_CHILDREN: Record<string, string[]> = {
    zonasgeo_group:   ["zonaver", "zonatam", "zonacuencas", "zonaburgos", "zonaas", "zonaap"],
    riesgohi_group:   ["riesgohic", "riesgohia", "riesgohim", "riesgohib"],
    provincias_group: ["burgos", "chihuahua", "cinturon_plegado_chiapas", "cinturon_plegado_smo",
                       "golfo_california", "golfo_mexico_profundo", "plataforma_yucatan",
                       "sabinas_burro_picachos", "sureste", "tampico_misantla", "veracruz", "vizcaino_purisima_iray"],
    pozosfa_group:    ["pozosap", "pozosc", "pozosi", "pozosp", "pozoss"],
    camposres:        ["camposresas", "camposresm", "camposrest"],
    diputados_group:  ["diputados_morena", "diputados_pri", "diputados_pan", "diputados_pvem", "diputados_pt"],
    div_pol_group:     ["ent", "mun"],
  };
  const layerOrder = sectionOrders.flat().flatMap(id => GROUP_CHILDREN[id] ?? [id]);

  const [layersVisibility, setLayersVisibility] = useState<
    Record<string, boolean>
  >({
    // Zonas geológicas
    zonaver: false,
    zonatam: false,
    zonacuencas: false,
    zonaburgos: false,
    zonaas: false,
    zonaap: false,
    // Social
    // comind: false,
    // Riesgo Hídrico (4 niveles)
    riesgohic: false,
    riesgohia: false,
    riesgohim: false,
    riesgohib: false,
    // Provincias (12)
    burgos: false,
    chihuahua: false,
    cinturon_plegado_chiapas: false,
    cinturon_plegado_smo: false,
    golfo_california: false,
    golfo_mexico_profundo: false,
    plataforma_yucatan: false,
    sabinas_burro_picachos: false,
    sureste: false,
    tampico_misantla: false,
    veracruz: false,
    vizcaino_purisima_iray: false,
    // Pozos (5 condiciones)
    pozosap: false,
    pozosc: false,
    pozosi: false,
    pozosp: false,
    pozoss: false,
    // Energía
    areaspotnc: false,
    camposres_comind: true,
    // Campos de Reserva (3 tipos)
    camposresas: false,
    camposresm: false,
    camposrest: true,
    // Diputados (5 partidos)
    diputados_morena: false,
    diputados_pan: false,
    diputados_pri: false,
    diputados_pvem: false,
    diputados_pt: false,
    // División política
    mun: false,
    ent: false,
    territoriospi: false,
    rm: false,
    // Ambiental
    anp: false,
    zonascult: false,
    // Comunidades
    LocalidadesSedeINPI: false,
    asentamientos: false,
  });
  const [layersOpacity, setLayersOpacity] = useState<Record<string, number>>({
    // Zonas geológicas
    zonaver: 0.5,
    zonatam: 0.5,
    zonacuencas: 0.5,
    zonaburgos: 0.5,
    zonaas: 0.5,
    zonaap: 0.5,
    // Social
    // comind: 1,
    // Riesgo Hídrico (4 niveles)
    riesgohic: 0.6,
    riesgohia: 0.6,
    riesgohim: 0.6,
    riesgohib: 0.6,
    // Provincias (12)
    burgos: 0.6,
    chihuahua: 0.6,
    cinturon_plegado_chiapas: 0.6,
    cinturon_plegado_smo: 0.6,
    golfo_california: 0.6,
    golfo_mexico_profundo: 0.6,
    plataforma_yucatan: 0.6,
    sabinas_burro_picachos: 0.6,
    sureste: 0.6,
    tampico_misantla: 0.6,
    veracruz: 0.6,
    vizcaino_purisima_iray: 0.6,
    // Pozos (5 condiciones)
    pozosap: 0.8,
    pozosc: 0.8,
    pozosi: 0.8,
    pozosp: 0.8,
    pozoss: 0.8,
    // Energía
    areaspotnc: 0.6,
    camposres_comind: 0.7,
    // Campos de Reserva (3 tipos)
    camposresas: 0.6,
    camposresm: 0.6,
    camposrest: 0.6,
    // Diputados (5 partidos)
    diputados_morena: 0.6,
    diputados_pan: 0.6,
    diputados_pri: 0.6,
    diputados_pvem: 0.6,
    diputados_pt: 0.6,
    // División política
    mun: 0.1,
    ent: 0.1,
    rm: 0.8,
    territoriospi: 0.5,
    // Ambiental
    anp: 0.5,
    zonascult: 0.8,
    // Comunidades
    LocalidadesSedeINPI: 1,
    asentamientos: 0.8,
  });
  /*== Manejar el toggle de visibilidad de capas ===*/
  const handleToggle = (id: string) => {
    setLayersVisibility((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  const handleOpacityChange = (id: string, value: number) => {
    setLayersOpacity((prev) => ({ ...prev, [id]: value }));
  };

  const handleToggleAll = (visible: boolean) => {
    setLayersVisibility((prev) =>
      Object.fromEntries(Object.keys(prev).map((id) => [id, visible])),
    );
  };

  const mkItem = (
    id: string,
    label: string,
    color: string,
    shape: "circle" | "square",
  ) => ({
    id,
    label,
    color,
    shape,
    switch: true as const,
    checked: layersVisibility[id],
    opacity: layersOpacity[id] ?? 1,
  });

  const mkGroup = (id: string, label: string, children: LegendItem[], defaultOpen = false) => ({
    id,
    label,
    type: "group" as const,
    children,
    defaultOpen,
  });

  const sections: InfoBoxSection[] = [
    {
      title: "Zonas",
items: [
        mkItem("camposres_comind", "Comunidades Indígenas en Campos de Reserva", "#D50000", "circle"), // Rojo puro

         // --- CATEGORÍA CAMPOS DE RESERVA POR TIPO ---
        mkGroup("camposres", "Campos de Reserva", [
          mkItem("camposresas", "Aguas Someras", "#52c0ff", "square"),
          mkItem("camposresm", "Marino", "#3d1aff", "square"),
          mkItem("camposrest", "Terrestre", "#00a808", "square"),
        ], true),
        // --- CATEGORÍA: ZONAS GEOLÓGICAS / PETROLERAS (Tonos Neón/Cian/Azul) ---
        mkGroup("zonasgeo_group", "Zonas Geológicas y Petroleras", [
          mkItem("zonaver", "Zona Veracruz", "#00F5FF", "circle"), // Cian eléctrico
          mkItem("zonatam", "Zona Tampico-Misantla", "#3D5AFE", "circle"), // Azul índigo brillante
          mkItem("zonacuencas", "Zona Cuencas del Sureste", "#7C4DFF", "circle"), // Violeta vibrante
          mkItem("zonaburgos", "Zona Burgos", "#1DE9B6", "circle"), // Verde turquesa
          mkItem("zonaas", "Zona Aguas Someras", "#00B0FF", "circle"), // Azul claro
          mkItem("zonaap", "Zona Aguas Profundas", "#0070FF", "circle"),
        ]), // Azul profundo saturado


        // --- CATEGORÍA: RIESGO HÍDRICO (Tonos Verdes/Amarillos/Limón) ---
        mkGroup("riesgohi_group", "Riesgo Hídrico Integrado", [
          mkItem("riesgohic",  "Crítico",  "#D32F2F", "square"),
          mkItem("riesgohia",     "Alto",     "#F57C00", "square"),
          mkItem("riesgohim", "Moderado", "#F9A825", "square"),
          mkItem("riesgohib",     "Bajo",     "#388E3C", "square"),
        ]),
        // mkItem("riesgohc", "Riesgo Hídrico (Cuencas)", "#00E676", "circle"), // Verde primavera
        // mkItem("riesgoha", "Riesgo Hídrico (Acuíferos)", "#64DD17", "square"), // Verde brillante

        // --- CATEGORÍA: ENERGÍA Y FRACKING (Tonos Naranjas/Rojos/Cálidos) ---
        mkGroup("provincias_group", "Provincias Geológicas", [
          mkItem("burgos", "Burgos", "#E57373", "square"),
          mkItem("chihuahua", "Chihuahua", "#90A4AE", "square"),
          mkItem("cinturon_plegado_chiapas", "Cinturón Plegado de Chiapas", "#F06292", "square"),
          mkItem("cinturon_plegado_smo", "Cinturón Plegado de la Sierra Madre Oriental", "#BA68C8", "square"),
          mkItem("golfo_california", "Golfo de Baja California", "#4FC3F7", "square"),
          mkItem("golfo_mexico_profundo", "Golfo de México Profundo", "#9575CD", "square"),
          mkItem("plataforma_yucatan", "Plataforma de Yucatán", "#4DB6AC", "square"),
          mkItem("sabinas_burro_picachos", "Sabinas - Burro - Picachos", "#A1887F", "square"),
          mkItem("sureste", "Sureste", "#7986CB", "square"),
          mkItem("tampico_misantla", "Tampico - Misantla", "#4DD0E1", "square"),
          mkItem("veracruz", "Veracruz", "#AED581", "square"),
          mkItem("vizcaino_purisima_iray", "Vizcaíno de la Purísima-IRAY", "#81C784", "square"), // Naranja fuerte
        ]),
        mkGroup("pozosfa_group", "Pozos Fracking y No Convencionales", [
          mkItem("pozosap","Abandono Permanente", "#FF3D00", "square"),
          mkItem("pozosc", "Cerrado", "#FFAB40", "square"),
          mkItem("pozosi", "Inactivo", "#FF6D00", "square"),
          mkItem("pozosp", "Productor", "#1e5b4f", "square"),
          mkItem("pozoss", "Suspendido", "#FFC107", "square"),
        ]),

        mkItem("areaspotnc", "Áreas Potenciales (No Convencionales)", "#FFAB40", "square"), // Naranja claro
        


        mkGroup("diputados_group", "Diputados por Distrito", [
          mkItem("diputados_morena", "MORENA", "#611232", "square"),
          mkItem("diputados_pri", "PRI", "#ff0707", "square"),
          mkItem("diputados_pan", "PAN", "#3e49ec", "square"),
          mkItem("diputados_pvem", "PVEM", "#01803a", "square"),
          mkItem("diputados_pt", "PT", "#9b0f47", "square"), // Gris muy claro (Casi blanco)
        ]),

        mkGroup("divpol_group", "División Política", [
          mkItem("ent", "Estatal", "#fdff72", "square"),
          mkItem("mun", "Municipal", "#90f2ff", "square"),
          mkItem("territoriospi", "Territorios de Pueblos Indígenas", "#ec3db8ff", "square"),
        ]),

        // --- CATEGORÍA: AMBIENTAL ---
        // ANP: capa única — las subcategorías INEGI requieren un PMTiles de uso de suelo adicional
        mkItem("anp", "Áreas Naturales Protegidas", "#AEEA00", "square"),
        mkItem("zonascult", "Zonas Culturales", "#d3c611", "square")
      ],
    },
    {
      title: "Comunidades Indígenas y Afromexicanas",
      items: [
        mkItem("LocalidadesSedeINPI", "Pueblos Indígenas", "#ec3db8ff", "circle"),
        mkItem("asentamientos", "Asentamientos Humanos", "#ff7626", "circle"),
      ],
    },
  ];

  return (
    <div className="App">
      <InfoBox
        title="FRACKING EN MÉXICO"
        subtitle="DGPC-Abril 2026"
        sections={sections}
        onToggle={handleToggle}
        onOpacityChange={handleOpacityChange}
        onReorder={handleReorder}
        onToggleAll={handleToggleAll}
        isDark={isDark}
      />
      <Map
        layersVisibility={layersVisibility}
        layersOpacity={layersOpacity}
        layerOrder={layerOrder}
        isDark={isDark}
        onToggleDark={() => setIsDark((v) => !v)}
        sections={sections}
      />
    </div>
  );
};

export default App;
