import React, { useState } from "react";
import InfoBox, { InfoBoxSection } from "./components/InfoBox/InfoBox";
import Map from "./components/Map/Map";
import "./App.css";

const App: React.FC = () => {
  const [layersVisibility, setLayersVisibility] = useState<
    Record<string, boolean>
  >({
    acueducton: true,
    acueducto: false,
    presa: true,
    LocalidadesSedeINPI: false,
    comind: true,
    locvillasola: false,
    lrvillasola: false,
    perimetrales: false,
    perimetralesnc: false,
    municipios: false,
    loc: false,
  });
  /*== Manejar el toggle de visibilidad de capas ===*/
  const handleToggle = (id: string) => {
    setLayersVisibility((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections: InfoBoxSection[] = [
    {
      title: "Capas del Proyecto",
      items: [
        {
          id: "acueducton",
          label: "Acueducto (Nuevo)",
          color: "#00FFF0",
          shape: "square",
          switch: true,
          checked: layersVisibility["acueducton"],
        },

        {
          id: "acueducto",
          label: "Acueducto y Ramales (Anterior)",
          color: "#cf4f4f",
          shape: "square",
          switch: true,
          checked: layersVisibility["acueducto"],
        },

        {
          id: "presa",
          label: "Presa Mujer Solteca",
          color: "#4c9af3ff",
          shape: "square",
          switch: true,
          checked: layersVisibility["presa"],
        },
        {
          id: "municipios",
          label: "Municipios",
          color: "#322fffff",
          shape: "square",
          switch: true,
          checked: layersVisibility["municipios"],
        },
        {
          id: "loc",
          label: "Localidades (Buffer 5km)",
          color: "#ff2fd2ff",
          shape: "square",
          switch: true,
          checked: layersVisibility["loc"],
        },
        {
          id: "comind",
          label: "Comunidades (Área de influencia)",
          color: "#df7649",
          shape: "circle",
          switch: true,
          checked: layersVisibility["comind"],
        },
        {
          id: "locvillasola",
          label: "Localidades Villa Sola",
          color: "#f3ff4dff",
          shape: "square",
          switch: true,
          checked: layersVisibility["locvillasola"],
        },
        {
          id: "lrvillasola",
          label: "Localidaades Rurales",
          color: "#08c567ff",
          shape: "circle",
          switch: true,
          checked: layersVisibility["lrvillasola"],
        },
        {
          id: "perimetrales",
          label: "Nucleos Agrarios",
          color: "#21f84fff",
          shape: "square",
          switch: true,
          checked: layersVisibility["perimetrales"],
        },
        {
          id: "perimetralesnc",
          label: "Nucleos Agrarios no Certificados",
          color: "#ff9e2fff",
          shape: "square",
          switch: true,
          checked: layersVisibility["perimetralesnc"],
        },
      ],
    },
    {
      title: "Comunidades Indígenas y Afromexicanas",
      items: [
        {
          id: "LocalidadesSedeINPI",
          label: "Pueblos Indígenas",
          color: "#ec3db8ff",
          shape: "circle",
          switch: true,
          checked: layersVisibility["LocalidadesSedeINPI"],
        },
      ],
    },
  ];

  return (
    <div className="App">
      <InfoBox
        title="PRESA 'MUJER SOLTECA'"
        subtitle="(PASO ANCHO)"
        sections={sections}
        onToggle={handleToggle}
      />
      <Map layersVisibility={layersVisibility} />
    </div>
  );
};

export default App;
