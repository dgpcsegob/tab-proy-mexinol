import React, { useState } from "react";
import InfoBox, { InfoBoxSection, LegendItem } from "./components/InfoBox/InfoBox";
import Map from "./components/Map/Map";
import "./App.css";

const INITIAL_SECTION_ORDERS: string[][] = [
  ["aip_group", "infraestructura_group", "ejidos_group"],
  ["localidades_inpi", "asent_com"],
  ["anp_ahome", "cuerpos_agua_group", "uso_suelo_group"],
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

  const [groupChildOrders, setGroupChildOrders] = useState<Record<string, string[]>>({
    aip_group: [
      "aip_direct_group",
      "e01_group", "e02_group", "e03_group", "e04_group",
      "e05a_group", "e05b_group", "e06_group",
      "e07a", "e07b",
      "e08_group", "e09_group", "e13_group", "e14_group", "esc12_group",
    ],
    aip_direct_group: [
      "aip_area_t1", "aip_area_t2", "aip_area_t3", "aip_area_t4", "aip_area_t5",
      "aip_area_t6", "aip_area_t7", "aip_area_t8", "aip_area_t9", "aip_area_t10",
      "aip_area_t11", "aip_area_t12", "aip_area_t13",
      "aip_derecho_via", "aip_pol_norte", "aip_predio_sur", "aip_camino",
    ],
    e01_group:  ["e01_zona",  "e01_predio"],
    e02_group:  ["e02_zona",  "e02_predio"],
    e03_group:  ["e03_zona",  "e03_predio"],
    e04_group:  ["e04_zona",  "e04_predio"],
    e05a_group: ["e05a_zona", "e05a_predio"],
    e05b_group: ["e05b_zona", "e05b_predio"],
    e06_group:  ["e06_zona",  "e06_predio"],
    e08_group:  ["e08_zona",  "e08_adecuacion"],
    e09_group:  ["e09_zona",  "e09_adecuacion"],
    e13_group:  ["e13_zona",  "e13_predio"],
    e14_group:  ["e14_zona",  "e14_predio"],
    esc12_group: [
      "esc12_t1", "esc12_t2", "esc12_t3", "esc12_t4", "esc12_t5", "esc12_t6", "esc12_t7",
      "esc12_t8", "esc12_t9", "esc12_t10", "esc12_t11", "esc12_t12", "esc12_t13",
      "esc12_ddv", "esc12_dvia", "esc12_znube", "esc12_nube2",
      "esc12_pnorte", "esc12_psur", "esc12_a", "esc12_b", "esc12_c", "esc12_camino",
    ],
    infraestructura_group: ["educ_group", "hospitales_group"],
    educ_group: [
      "educ_preesc_pub", "educ_preesc_priv",
      "educ_prim_pub", "educ_prim_priv",
      "educ_media_sup_pub", "educ_media_sup_priv",
      "educ_media_tec_priv",
      "educ_superior_pub", "educ_superior_priv",
    ],
    hospitales_group: ["salu_pub", "salu_priv"],
    ejidos_group: ["ejidos_rosendo", "ejidos_topoviejo"],
    cuerpos_agua_group: ["cuerpos_agua_perenne", "cuerpos_agua_intermit"],
    uso_suelo_group: [
      "uso_suelo_acuicola", "uso_suelo_riego_anual", "uso_suelo_riego_semi",
      "uso_suelo_riego_perm", "uso_suelo_temporal", "uso_suelo_asent_hum",
    ],
  });

  const handleReorderChildren = (groupId: string, newChildIds: string[]) => {
    setGroupChildOrders(prev => ({ ...prev, [groupId]: newChildIds }));
  };

  const expandId = (id: string): string[] => {
    const children = groupChildOrders[id];
    if (!children) return [id];
    return children.flatMap(expandId);
  };
  const layerOrder = sectionOrders.flat().flatMap(expandId);

  const [layersVisibility, setLayersVisibility] = useState<Record<string, boolean>>({
    // Área de impacto directa
    aip_area_t1:    false,
    aip_area_t2:    false,
    aip_area_t3:    false,
    aip_area_t4:    false,
    aip_area_t5:    false,
    aip_area_t6:    false,
    aip_area_t7:    false,
    aip_area_t8:    false,
    aip_area_t9:    false,
    aip_area_t10:   false,
    aip_area_t11:   false,
    aip_area_t12:   false,
    aip_area_t13:   false,
    aip_derecho_via: true,
    aip_pol_norte:  false,
    aip_predio_sur: false,
    aip_camino:     false,
    // E-escenarios — sub-capas por Name
    e01_zona: false,    e01_predio: false,
    e02_zona: false,   e02_predio: false,
    e03_zona: false,    e03_predio: false,
    e04_zona: false,    e04_predio: false,
    e05a_zona: false,  e05a_predio: false,
    e05b_zona: false,  e05b_predio: false,
    e06_zona: false,   e06_predio: false,
    e07a: false,
    e07b: false,
    e08_zona: false,    e08_adecuacion: false,
    e09_zona: false,    e09_adecuacion: false,
    e13_zona: false,    e13_predio: false,
    e14_zona: false,    e14_predio: false,
    esc12_t1: false,    esc12_t2: false,    esc12_t3: false,    esc12_t4: false,
    esc12_t5: false,    esc12_t6: false,    esc12_t7: false,    esc12_t8: false,
    esc12_t9: false,    esc12_t10: false,   esc12_t11: false,   esc12_t12: false, //ok
    esc12_t13: true,   esc12_ddv: true,   esc12_dvia: true, //ok
    esc12_znube: true, esc12_nube2: true,
    esc12_pnorte: true, esc12_psur: true, esc12_a: true, esc12_b: true,
    esc12_c: true,     esc12_camino: true,
    // Centros escolares
    educ_preesc_pub: false,
    educ_preesc_priv: false,
    educ_prim_pub: false,
    educ_prim_priv: false,
    educ_media_sup_pub: false,
    educ_media_sup_priv: false,
    educ_media_tec_priv: false,
    educ_superior_pub: false,
    educ_superior_priv: false,
    // Hospitales
    salu_pub: false,
    salu_priv: false,
    // Ejidos
    ejidos_rosendo:   false,
    ejidos_topoviejo: false,
    // Comunidades
    localidades_inpi: false,
    asent_com: true,
    // Ambiental
    anp_ahome: false,
    cuerpos_agua_perenne:  false,
    cuerpos_agua_intermit: false,
    uso_suelo_acuicola:    false,
    uso_suelo_riego_anual: false,
    uso_suelo_riego_semi:  false,
    uso_suelo_riego_perm:  false,
    uso_suelo_temporal:    false,
    uso_suelo_asent_hum:   false,
  });

  const [layersOpacity, setLayersOpacity] = useState<Record<string, number>>({
    aip_area_t1:    0.5,
    aip_area_t2:    0.5,
    aip_area_t3:    0.5,
    aip_area_t4:    0.5,
    aip_area_t5:    0.5,
    aip_area_t6:    0.5,
    aip_area_t7:    0.5,
    aip_area_t8:    0.5,
    aip_area_t9:    0.5,
    aip_area_t10:   0.5,
    aip_area_t11:   0.5,
    aip_area_t12:   0.5,
    aip_area_t13:   0.5,
    aip_derecho_via: 0.5,
    aip_pol_norte:  0.5,
    aip_predio_sur: 0.5,
    aip_camino:     0.5,
    e01_zona: 0.55,    e01_predio: 0.55,
    e02_zona: 0.55,    e02_predio: 0.55,
    e03_zona: 0.55,    e03_predio: 0.55,
    e04_zona: 0.55,    e04_predio: 0.55,
    e05a_zona: 0.55,   e05a_predio: 0.55,
    e05b_zona: 0.55,   e05b_predio: 0.55,
    e06_zona: 0.55,    e06_predio: 0.55,
    e07a: 0.55,
    e07b: 0.55,
    e08_zona: 0.55,    e08_adecuacion: 0.55,
    e09_zona: 0.55,    e09_adecuacion: 0.55,
    e13_zona: 0.55,    e13_predio: 0.55,
    e14_zona: 0.55,    e14_predio: 0.55,
    esc12_t1: 0.55,    esc12_t2: 0.55,    esc12_t3: 0.55,    esc12_t4: 0.55,
    esc12_t5: 0.55,    esc12_t6: 0.55,    esc12_t7: 0.55,    esc12_t8: 0.55,
    esc12_t9: 0.55,    esc12_t10: 0.55,   esc12_t11: 0.55,   esc12_t12: 0.55,
    esc12_t13: 0.55,   esc12_ddv: 0.55,   esc12_dvia: 0.55,
    esc12_znube: 0.55, esc12_nube2: 0.55,
    esc12_pnorte: 0.55, esc12_psur: 0.55, esc12_a: 0.55, esc12_b: 0.55,
    esc12_c: 0.55,     esc12_camino: 0.55,
    educ_preesc_pub: 0.9,
    educ_preesc_priv: 0.9,
    educ_prim_pub: 0.9,
    educ_prim_priv: 0.9,
    educ_media_sup_pub: 0.9,
    educ_media_sup_priv: 0.9,
    educ_media_tec_priv: 0.9,
    educ_superior_pub: 0.9,
    educ_superior_priv: 0.9,
    salu_pub: 0.9,
    salu_priv: 0.9,
    ejidos_rosendo:   0.6,
    ejidos_topoviejo: 0.6,
    localidades_inpi: 0.9,
    asent_com: 0.9,
    anp_ahome: 0.5,
    cuerpos_agua_perenne:  0.7,
    cuerpos_agua_intermit: 0.7,
    uso_suelo_acuicola:    0.5,
    uso_suelo_riego_anual: 0.5,
    uso_suelo_riego_semi:  0.5,
    uso_suelo_riego_perm:  0.5,
    uso_suelo_temporal:    0.5,
    uso_suelo_asent_hum:   0.5,
  });

  const handleToggle = (id: string) => {
    setLayersVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const handleOpacityChange = (id: string, value: number) => {
    setLayersOpacity((prev) => ({ ...prev, [id]: value }));
  };
  const handleToggleAll = (visible: boolean) => {
    setLayersVisibility((prev) =>
      Object.fromEntries(Object.keys(prev).map((id) => [id, visible])),
    );
  };

  const mkItem = (id: string, label: string, color: string, shape: "circle" | "square") => ({
    id, label, color, shape,
    switch: true as const,
    checked: layersVisibility[id],
    opacity: layersOpacity[id] ?? 1,
  });

  const mkGroup = (id: string, label: string, children: LegendItem[], defaultOpen = false) => ({
    id, label, type: "group" as const, children, defaultOpen,
  });

  const sections: InfoBoxSection[] = [
    {
      title: "Proyecto MEXINOL Pacífico",
      items: [
        mkGroup("aip_group", "Áreas de Impacto del Proyecto", [
          mkGroup("aip_direct_group", "Área de Impacto Directa", [
            mkItem("aip_area_t1",    "Area T1",          "#FF073A", "square"),
            mkItem("aip_area_t2",    "Area T2",          "#FF6B00", "square"),
            mkItem("aip_area_t3",    "Area T3",          "#FFE500", "square"),
            mkItem("aip_area_t4",    "Area T4",          "#39FF14", "square"),
            mkItem("aip_area_t5",    "Area T5",          "#00FFFF", "square"),
            mkItem("aip_area_t6",    "Area T6",          "#00B3FF", "square"),
            mkItem("aip_area_t7",    "Area T7",          "#7B2FFF", "square"),
            mkItem("aip_area_t8",    "Area T8",          "#FF00FF", "square"),
            mkItem("aip_area_t9",    "Area T9",          "#FF1493", "square"),
            mkItem("aip_area_t10",   "Area T10",         "#ADFF2F", "square"),
            mkItem("aip_area_t11",   "Area T11",         "#00FF7F", "square"),
            mkItem("aip_area_t12",   "Area T12",         "#00FFBF", "square"),
            mkItem("aip_area_t13",   "Area T13",         "#FF9F00", "square"),
            mkItem("aip_derecho_via","Derecho de Vía P", "#FF6EC7", "square"),
            mkItem("aip_pol_norte",  "Polígono Norte",   "#CCFF00", "square"),
            mkItem("aip_predio_sur", "Predio Sur",       "#FF3EFF", "square"),
            mkItem("aip_camino",     "Camino",           "#4DFFFF", "square"),
          ]),
          mkGroup("e01_group", "E01 — Zona Amort. Tanque Metanol 4101T001A-B", [
            mkItem("e01_zona",   "Zona de Amortiguamiento", "#E91E63", "square"),
            mkItem("e01_predio", "Predio NORTE",            "#39FF14", "square"),
          ]),
          mkGroup("e02_group", "E02 — Zona Amort. Tanque Metanol 4101T001A-B", [
            mkItem("e02_zona",   "Zona de Amortiguamiento", "#F48FB1", "square"),
            mkItem("e02_predio", "Predio NORTE",            "#00FFFF", "square"),
          ]),
          mkGroup("e03_group", "E03 — Zona Amort. Tanque Metanol 4101T003", [
            mkItem("e03_zona",   "Zona de Amortiguamiento", "#9C27B0", "square"),
            mkItem("e03_predio", "Predio NORTE",            "#ADFF2F", "square"),
          ]),
          mkGroup("e04_group", "E04 — Zona Amort. Tanque Metanol 4101T003", [
            mkItem("e04_zona",   "Zona de Amortiguamiento", "#CE93D8", "square"),
            mkItem("e04_predio", "Predio NORTE",            "#FF073A", "square"),
          ]),
          mkGroup("e05a_group", "E05 — Zona Amort. Tanque Metanol 9531T001A-C", [
            mkItem("e05a_zona",   "Zona de Amortiguamiento", "#00BCD4", "square"),
            mkItem("e05a_predio", "Predio NORTE",             "#FF6EC7", "square"),
          ]),
          mkGroup("e05b_group", "E05b — Zona Amort. Tanque Metanol 9531 (buffer)", [
            mkItem("e05b_zona",   "Zona de Amortiguamiento", "#80DEEA", "square"),
            mkItem("e05b_predio", "Predio NORTE",             "#FF6B00", "square"),
          ]),
          mkGroup("e06_group", "E06 — Zona Amort. Tanque Metanol 9531T001A-C", [
            mkItem("e06_zona",   "Zona de Amortiguamiento", "#009688", "square"),
            mkItem("e06_predio", "Predio NORTE",            "#FF3EFF", "square"),
          ]),

          mkGroup("e08_group", "E08 — Zona Amort. Brazos de descarga", [
            mkItem("e08_zona",       "Zona de Amortiguamiento", "#FF9800", "square"),
            mkItem("e08_adecuacion", "Adecuación Vial",         "#7B2FFF", "square"),
          ]),
          mkGroup("e09_group", "E09 — Zona Amort. Brazos de descarga", [
            mkItem("e09_zona",       "Zona de Amortiguamiento", "#FFCC80", "square"),
            mkItem("e09_adecuacion", "Adecuación Vial",         "#00FF7F", "square"),
          ]),
          mkGroup("e13_group", "E13 — Zona Amort. Gas Cloro", [
            mkItem("e13_zona",   "Zona de Amortiguamiento", "#FFEB3B", "square"),
            mkItem("e13_predio", "Predio NORTE",            "#00B3FF", "square"),
          ]),
          mkGroup("e14_group", "E14 — Zona Amort. Gas Cloro", [
            mkItem("e14_zona",   "Zona de Amortiguamiento", "#FFF176", "square"),
            mkItem("e14_predio", "Predio NORTE",            "#FF1493", "square"),
          ]),
          mkGroup("esc12_group", "Escenario 12 — Zona Amort. Tanque Gas Cloro", [
            mkItem("esc12_t1",     "Area T1",          "#FF073A", "square"),
            mkItem("esc12_t2",     "Area T2",          "#FF6B00", "square"),
            mkItem("esc12_t3",     "Area T3",          "#FFE500", "square"),
            mkItem("esc12_t4",     "Area T4",          "#39FF14", "square"),
            mkItem("esc12_t5",     "Area T5",          "#00FFFF", "square"),
            mkItem("esc12_t6",     "Area T6",          "#00B3FF", "square"),
            mkItem("esc12_t7",     "Area T7",          "#7B2FFF", "square"),
            mkItem("esc12_t8",     "Area T8",          "#FF00FF", "square"),
            mkItem("esc12_t9",     "Area T9",          "#FF1493", "square"),
            mkItem("esc12_t10",    "Area T10",         "#ADFF2F", "square"),
            mkItem("esc12_t11",    "Area T11",         "#00FF7F", "square"),
            mkItem("esc12_t12",    "Area T12",         "#00FFBF", "square"),
            mkItem("esc12_t13",    "Area T13",         "#FF9F00", "square"),
            mkItem("esc12_ddv",    "Derecho de Vía P", "#FF6EC7", "square"),
            mkItem("esc12_dvia",   "Derecho de Via",   "#CCFF00", "square"),
            mkItem("esc12_znube",  "Nube Tóxica (Zona Amort.)", "#F44336", "square"),
            mkItem("esc12_nube2",  "Nube Tóxica (Amort. 12)",   "#FF4500", "square"),
            mkItem("esc12_pnorte", "Predio NORTE",     "#FFD700", "square"),
            mkItem("esc12_psur",   "Predio Sur",       "#FF3EFF", "square"),
            mkItem("esc12_a",      "A",                "#4DFFFF", "square"),
            mkItem("esc12_b",      "B",                "#00FF41", "square"),
            mkItem("esc12_c",      "C",                "#FF5EFF", "square"),
            mkItem("esc12_camino", "Camino",           "#00BFFF", "square"),
          ]),

          mkItem("e07a", "E07 — Zona Amort. Ducto de Metanol",              "#4CAF50", "square"),
          mkItem("e07b", "E07b — Zona Amort. Ducto de Metanol (buffer eje)","#A5D6A7", "square"),
        ], true),

        mkGroup("infraestructura_group", "Infraestructura", [
          mkGroup("educ_group", "Centros Escolares", [
            mkItem("educ_preesc_pub",    "Preescolar Público",          "#FFD54F", "circle"),
            mkItem("educ_preesc_priv",   "Preescolar Privado",          "#FFA726", "circle"),
            mkItem("educ_prim_pub",      "Primaria Pública",            "#66BB6A", "circle"),
            mkItem("educ_prim_priv",     "Primaria Privada",            "#26A69A", "circle"),
            mkItem("educ_media_sup_pub", "Media Superior Pública",      "#42A5F5", "circle"),
            mkItem("educ_media_sup_priv","Media Superior Privada",      "#7E57C2", "circle"),
            mkItem("educ_media_tec_priv","Media Técnica Privada",       "#EC407A", "circle"),
            mkItem("educ_superior_pub",  "Superior Pública",            "#26C6DA", "circle"),
            mkItem("educ_superior_priv", "Superior Privada",            "#AB47BC", "circle"),
          ]),
          mkGroup("hospitales_group", "Hospitales", [
            mkItem("salu_pub",  "Hospitales Públicos",  "#EF5350", "circle"),
            mkItem("salu_priv", "Hospitales Privados",  "#FF8A65", "circle"),
          ]),
        ]),

        mkGroup("ejidos_group", "Ejidos con Afectaciones", [
          mkItem("ejidos_rosendo",   "Rosendo G. Castro", "#1E5B4F", "square"),
          mkItem("ejidos_topoviejo", "Topoviejo",         "#002F2A", "square"),
        ]),
      ],
    },
    {
      title: "Comunidades",
      items: [
        mkItem("localidades_inpi", "Localidades Indígenas (INPI)", "#ec3db8", "circle"),
        mkItem("asent_com",        "Asentamientos Comunidad",      "#ff7626", "circle"),
      ],
    },
    {
      title: "Ambiental y Territorio",
      items: [
        mkItem("anp_ahome", "Áreas Naturales Protegidas (Ahome)", "#AEEA00", "square"),
        mkGroup("cuerpos_agua_group", "Cuerpos de Agua", [
          mkItem("cuerpos_agua_perenne",  "Perenne",      "#0288D1", "square"),
          mkItem("cuerpos_agua_intermit", "Intermitente", "#81D4FA", "square"),
        ]),
        mkGroup("uso_suelo_group", "Uso de Suelo", [
          mkItem("uso_suelo_acuicola",    "Acuícola",                                    "#00ACC1", "square"),
          mkItem("uso_suelo_riego_anual", "Agricultura de riego anual",                  "#388E3C", "square"),
          mkItem("uso_suelo_riego_semi",  "Agricultura de riego anual y semipermanente", "#66BB6A", "square"),
          mkItem("uso_suelo_riego_perm",  "Agricultura de riego permanente",             "#1B5E20", "square"),
          mkItem("uso_suelo_temporal",    "Agricultura de temporal anual",               "#AED581", "square"),
          mkItem("uso_suelo_asent_hum",   "Asentamientos humanos",                       "#FF7043", "square"),
        ]),
      ],
    },
  ];

  return (
    <div className="App">
      <InfoBox
        title="Proyecto: MEXINOL PACÍFICO"
        subtitle="DGPC-Mayo 2026"
        sections={sections}
        onToggle={handleToggle}
        onOpacityChange={handleOpacityChange}
        onReorder={handleReorder}
        onReorderChildren={handleReorderChildren}
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
