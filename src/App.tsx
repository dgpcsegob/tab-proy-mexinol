import React, { useState } from 'react';
import InfoBox, { InfoBoxSection } from './components/InfoBox/InfoBox';
import Map from './components/Map/Map';
import './App.css';

const App: React.FC = () => {
  const [layersVisibility, setLayersVisibility] = useState<Record<string, boolean>>({
    acueducto: true,
    presa: true,
    LocalidadesSedeINPI: false,
    comind: true,
    locvillasola: false,
    lrvillasola: false,
    perimetrales: false,
   
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
        { id: 'acueducto', label: 'Acueducto y ramales', color: '#00FFF0', shape: 'square', switch: true, checked: layersVisibility['acueducto'] },
        { id: 'presa', label: 'Presa Margarita Maza', color: '#4c9af3ff', shape: 'square', switch: true, checked: layersVisibility['presa'] },
        { id: 'comind', label: 'Comunidades (area de influencia)', color: '#df7649', shape: 'circle', switch: true, checked: layersVisibility['comind'] },
        { id: 'locvillasola', label: 'Localidades Villa Sola', color: '#f3ff4dff', shape: 'square', switch: true, checked: layersVisibility['locvillasola'] },
        { id: 'lrvillasola', label: 'Localidaades rurales', color: '#08c567ff', shape: 'circle', switch: true, checked: layersVisibility['lrvillasola'] },
        { id: 'perimetrales', label: 'Nucleos Agrarios', color: '#21f84fff', shape: 'square', switch: true, checked: layersVisibility['perimetrales'] },
        // { id: 'afectaciones', label: 'Afectaciones', color: '#ff0000', shape: 'circle', switch: true, checked: layersVisibility['afectaciones'] },
        ]
    },
    {
      title: 'Comunidades Indígenas y Afromexicanas',
      items: [
        { id: 'LocalidadesSedeINPI', label: 'Pueblos Indígenas', color: '#ec3db8ff', shape: 'circle', switch: true, checked: layersVisibility['LocalidadesSedeINPI'] },
      ],
    },
   ];

  return (
    <div className="App">
      <InfoBox
        title="PRESA MARGARITA MAZA (PASO ANCHO)"
        sections={sections}
        onToggle={handleToggle}
      />
      <Map layersVisibility={layersVisibility} />
    </div>
  );
};

export default App;
