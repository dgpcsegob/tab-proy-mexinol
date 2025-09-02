import React, { useState } from 'react';
import InfoBox, { InfoBoxSection } from './components/InfoBox/InfoBox';
import Map from './components/Map/Map';
import './App.css';

const App: React.FC = () => {
  const [layersVisibility, setLayersVisibility] = useState<Record<string, boolean>>({
    trazo1: true,
    trazo2: true,
    comind: true,
    nucleosa: true,
    puntos_zona1: false,
    puntos_zona2: false,
    mesas_cercanas_zona1: false,
    mesas_cercanas_zona2: false,
    regiones_zona1: false,
    regiones_zona2: false,
    LocalidadesSedeINPI: false,
    PresidenciasMunicipales: false,
    PuntosWiFiCFE_4G: false,
    PuntosWiFiCFE_FIBRA: false,
    PuntosWiFiCFE_SATELITAL: false,
  });

  const handleToggle = (id: string) => {
    setLayersVisibility(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections: InfoBoxSection[] = [
    {
      title: 'Capas del Proyecto',
      items: [
        { id: 'trazo1', label: 'Trazo 1', color: '#1551c0ff', shape: 'square', switch: true, checked: layersVisibility['trazo1'] },
        { id: 'trazo2', label: 'Trazo 2', color: '#e68021ff', shape: 'square', switch: true, checked: layersVisibility['trazo2'] },
        { id: 'comind', label: 'Comunidades Indígenas', color: '#1e5b4f', shape: 'circle', switch: true, checked: layersVisibility['comind'] },
        { id: 'nucleosa', label: 'Núcleos Agrarios', color: '#f5f117ff', shape: 'square', switch: true, checked: layersVisibility['nucleosa'] },
        ]
    },
    {
      title: 'Asambleas Regionales',
      items: [
        { id: 'puntos_zona1', label: 'Zona 1', color: '#e60026', shape: 'circle', switch: true, checked: layersVisibility['puntos_zona1'] },
        { id: 'puntos_zona2', label: 'Zona 2', color: '#e60026', shape: 'circle', switch: true, checked: layersVisibility['puntos_zona2'] },
        // { id: 'regiones_zona1', label: 'Regiones', color: '#66c2a5', shape: 'square', switch: true, checked: layersVisibility['regiones_zona1'] },
      ],
    },
    {
      title: 'Comunidades Indígenas y Afromexicanas',
      items: [
        { id: 'LocalidadesSedeINPI', label: 'Pueblos Indígenas', color: '#666666', shape: 'circle', switch: true, checked: layersVisibility['LocalidadesSedeINPI'] },
      ],
    },
    {
      title: 'Presidencias Municipales',
      items: [
        { id: 'PresidenciasMunicipales', label: 'Cabeceras Municipales', color: '#000000', shape: 'circle', switch: true, checked: layersVisibility['PresidenciasMunicipales'] },
      ],
    },
    {
      title: 'Despliegue WiFi CFE',
      items: [
        { id: 'PuntosWiFiCFE_4G', label: '4G', color: '#9f2241', shape: 'circle', switch: true, checked: layersVisibility['PuntosWiFiCFE_4G'] },
        { id: 'PuntosWiFiCFE_FIBRA', label: 'Fibra o Cobre', color: '#cda578', shape: 'circle', switch: true, checked: layersVisibility['PuntosWiFiCFE_FIBRA'] },
        { id: 'PuntosWiFiCFE_SATELITAL', label: 'Satelital', color: '#235b4e', shape: 'circle', switch: true, checked: layersVisibility['PuntosWiFiCFE_SATELITAL'] },
      ],
    },
  ];

  return (
    <div className="App">
      <InfoBox
        title="TREN MÉXICO-QUERÉTARO"
        sections={sections}
        onToggle={handleToggle}
      />
      <Map layersVisibility={layersVisibility} />
    </div>
  );
};

export default App;
