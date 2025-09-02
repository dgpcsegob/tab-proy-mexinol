import React, { useState } from 'react';
import InfoBox, { InfoBoxSection } from './components/InfoBox/InfoBox';
import Map from './components/Map/Map';
import './App.css';

const App: React.FC = () => {
  const [layersVisibility, setLayersVisibility] = useState<Record<string, boolean>>({
    trazoa: true,
    vianterior: true,
    comind: true,
    nucleosa: true,
    buffer10: false,
    buffer20: false,
    afectaciones: false,
    LocalidadesSedeINPI: false,
   
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
        { id: 'trazoa', label: 'Trazo actual', color: '#e04a4aff', shape: 'square', switch: true, checked: layersVisibility['trazoa'] },
        { id: 'vianterior', label: 'Cartas de vía', color: '#3d3d3dff', shape: 'square', switch: true, checked: layersVisibility['vianterior'] },
        { id: 'comind', label: 'Comunidades (area de influencia)', color: '#1e5b4f', shape: 'circle', switch: true, checked: layersVisibility['comind'] },
        { id: 'nucleosa', label: 'Núcleos Agrarios (área de influencia)', color: '#f5f117ff', shape: 'square', switch: true, checked: layersVisibility['nucleosa'] },
        { id: 'buffer10', label: 'Buffer 10m', color: '#ff7f00', shape: 'square', switch: true, checked: layersVisibility['buffer10'] },
        { id: 'buffer20', label: 'Buffer 20m', color: '#377eb8', shape: 'square', switch: true, checked: layersVisibility['bufer20'] },
        { id: 'afectaciones', label: 'Afectaciones', color: '#ff0000', shape: 'circle', switch: true, checked: layersVisibility['afectaciones'] },
        ]
    },
    {
      title: 'Comunidades Indígenas y Afromexicanas',
      items: [
        { id: 'LocalidadesSedeINPI', label: 'Pueblos Indígenas', color: '#666666', shape: 'circle', switch: true, checked: layersVisibility['LocalidadesSedeINPI'] },
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
