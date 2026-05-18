import React, { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./InfoBox.css";

export type LegendCategory = { label: string; color: string; shape?: "circle" | "square" };

export type LegendItem = {
  id: string;
  label: string;
  color?: string;
  shape?: "circle" | "square";
  size?: number;
  switch?: boolean;
  checked?: boolean;
  opacity?: number;
  type?: "group";
  children?: LegendItem[];
  categories?: LegendCategory[];
  defaultOpen?: boolean;
};

export type InfoBoxSection = {
  title: string;
  items: LegendItem[];
};

type InfoBoxProps = {
  title: string;
  subtitle?: string;
  sections: InfoBoxSection[];
  onToggle?: (id: string) => void;
  onOpacityChange?: (id: string, value: number) => void;
  onReorder?: (sectionIdx: number, newIds: string[]) => void;
  onReorderChildren?: (groupId: string, newChildIds: string[]) => void;
  onToggleAll?: (visible: boolean) => void;
  initialOpen?: boolean;
  isDark?: boolean;
  xOffset?: string;
};


/*== Toggle "gooey" (Uiverse) convertido a componente controlado ==*/
const GooToggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  ariaLabel?: string;
  color?: string;
}> = ({ checked, onChange, ariaLabel, color }) => {
  const id = useMemo(() => `goo-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <div
      className="toggle-container"
      aria-label={ariaLabel}
      style={color ? { "--active-color": color } as React.CSSProperties : undefined}
    >
      <input
        id={id}
        type="checkbox"
        className="toggle-input"
        checked={checked}
        onChange={onChange}
        aria-checked={checked}
        role="switch"
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 292 142"
        className="toggle"
        aria-hidden="true"
      >
        <path
          d="M71 142C31.7878 142 0 110.212 0 71C0 31.7878 31.7878 0 71 0C110.212 0 119 30 146 30C173 30 182 0 221 0C260 0 292 31.7878 292 71C292 110.212 260.212 142 221 142C181.788 142 173 112 146 112C119 112 110.212 142 71 142Z"
          className="toggle-background"
        />
        <rect
          rx="6"
          height="64"
          width="12"
          y="39"
          x="64"
          className="toggle-icon on"
        />
        <path
          d="M221 91C232.046 91 241 82.0457 241 71C241 59.9543 232.046 51 221 51C209.954 51 201 59.9543 201 71C201 82.0457 209.954 91 221 91ZM221 103C238.673 103 253 88.6731 253 71C253 53.3269 238.673 39 221 39C203.327 39 189 53.3269 189 71C189 88.6731 203.327 103 221 103Z"
          fillRule="evenodd"
          className="toggle-icon off"
        />
        <g filter="url(#goo)">
          <rect
            fill="#fff"
            rx="29"
            height="58"
            width="116"
            y="42"
            x="13"
            className="toggle-circle-center"
          />
          <rect
            fill="#fff"
            rx="58"
            height="114"
            width="114"
            y="14"
            x="14"
            className="toggle-circle left"
          />
          <rect
            fill="#fff"
            rx="58"
            height="114"
            width="114"
            y="14"
            x="164"
            className="toggle-circle right"
          />
        </g>
        <filter id="goo">
          <feGaussianBlur stdDeviation="10" result="blur" in="SourceGraphic" />
          <feColorMatrix
            result="goo"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            in="blur"
            type="matrix"
          />
        </filter>
      </svg>
    </div>
  );
};

/*== Fila reutilizable estática — solo para categorías internas (no sub-capas) ==*/
const LegendRow: React.FC<{
  item: LegendItem;
  onToggle?: (id: string) => void;
  onOpacityChange?: (id: string, value: number) => void;
}> = ({ item, onToggle, onOpacityChange }) => {
  const [collapsed, setCollapsed] = useState(!item.defaultOpen);

  if (item.type === "group") {
    const anyChecked = item.children?.some(c => c.checked) ?? false;
    const handleGroupToggle = () => {
      const target = !anyChecked;
      item.children?.forEach(child => {
        if (!!child.checked !== target) onToggle?.(child.id);
      });
      setCollapsed(!target);
    };
    return (
      <div>
        <div className="legend-row legend-row-child legend-group-row">
          <span className="drag-handle" style={{ visibility: "hidden" }}>⠿</span>
          <button
            className="group-expand-btn"
            onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? "Expandir subgrupo" : "Colapsar subgrupo"}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"
              className={`group-chevron${collapsed ? "" : " open"}`} aria-hidden="true">
              <polyline points="2,2 8,5 2,8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="legend-label legend-group-label">{item.label}</span>
          <GooToggle checked={anyChecked} onChange={handleGroupToggle}
            ariaLabel={`Activar/Desactivar ${item.label}`} />
        </div>
        <div className={`group-children-wrapper${collapsed ? "" : " open"}`}>
          <div className="group-children" style={{ marginLeft: 12 }}>
            {item.children?.map(child => (
              <LegendRow key={child.id} item={child} onToggle={onToggle} onOpacityChange={onOpacityChange} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="legend-row legend-row-child">
        <span className="drag-handle" style={{ visibility: "hidden" }}>⠿</span>
        {item.shape && item.color && (
          <span className={`shape ${item.shape}`} style={{ backgroundColor: item.color, width: 12, height: 12 }} />
        )}
        <span className="legend-label">{item.label}</span>
        {item.categories && (
          <button
            className="group-expand-btn"
            onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? "Ver categorías" : "Ocultar categorías"}
            style={{ marginRight: 4 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"
              className={`group-chevron${collapsed ? "" : " open"}`} aria-hidden="true">
              <polyline points="2,2 8,5 2,8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {item.switch && (
          <GooToggle
            checked={!!item.checked}
            onChange={() => onToggle?.(item.id)}
            ariaLabel={`Activar/Desactivar ${item.label}`}
            color={item.color}
          />
        )}
      </div>
      {item.categories && !collapsed && (
        <div className="group-children" style={{ marginLeft: 22 }}>
          {item.categories.map((cat, i) => (
            <div key={i} className="legend-row legend-row-child" style={{ cursor: "default" }}>
              <span className="drag-handle" style={{ visibility: "hidden" }}>⠿</span>
              <span className={`shape ${cat.shape ?? "square"}`} style={{ backgroundColor: cat.color, width: 10, height: 10 }} />
              <span className="legend-label" style={{ fontSize: 10, opacity: 0.85 }}>{cat.label}</span>
            </div>
          ))}
        </div>
      )}
      {item.switch && item.checked && (
        <div className="opacity-row">
          <svg className="opacity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill={item.color ?? "#1e5b4f"}/>
            <line x1="12" y1="2"  x2="12" y2="5"  stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="2"  y1="12" x2="5"  y2="12" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="19" y1="12" x2="22" y2="12" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="range" className="opacity-slider" min={0} max={1} step={0.05}
            value={item.opacity ?? 1}
            onChange={(e) => onOpacityChange?.(item.id, parseFloat(e.target.value))}
            aria-label={`Opacidad de ${item.label}`}
            style={item.color ? { background: `linear-gradient(to right, #4a4a55, ${item.color})` } : undefined}
          />
          <svg className="opacity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill={item.color ?? "#1e5b4f"}/>
          </svg>
        </div>
      )}
    </div>
  );
};

/*== Ítem arrastrable — recursivo para cualquier nivel de anidamiento ==*/
const SortableRow: React.FC<{
  item: LegendItem;
  depth?: number;
  onToggle?: (id: string) => void;
  onOpacityChange?: (id: string, value: number) => void;
  onReorderChildren?: (groupId: string, newChildIds: string[]) => void;
}> = ({ item, depth = 0, onToggle, onOpacityChange, onReorderChildren }) => {
  const [collapsed, setCollapsed] = useState(!item.defaultOpen);
  const [childOrder, setChildOrder] = useState<string[]>(() => item.children?.map(c => c.id) ?? []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "rgba(0,124,191,0.06)" : undefined,
    borderRadius: isDragging ? 6 : undefined,
  };

  const isChild = depth > 0;
  const rowClass = `legend-row${isChild ? " legend-row-child" : ""}`;

  if (item.type === "group") {
    const childMap = Object.fromEntries((item.children ?? []).map(c => [c.id, c]));
    const orderedChildren = childOrder.map(id => childMap[id]).filter(Boolean) as LegendItem[];
    const anyChecked = orderedChildren.some(c =>
      c.type === "group" ? (c.children ?? []).some(gc => gc.checked) : c.checked
    );
    const handleGroupToggle = () => {
      const target = !anyChecked;
      const toggleLeaves = (items: LegendItem[]) => items.forEach(i => {
        if (i.type === "group") toggleLeaves(i.children ?? []);
        else if (!!i.checked !== target) onToggle?.(i.id);
      });
      toggleLeaves(orderedChildren);
      setCollapsed(!target);
    };
    const handleChildDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setChildOrder(prev => {
        const oldIdx = prev.indexOf(String(active.id));
        const newIdx = prev.indexOf(String(over.id));
        const newOrder = arrayMove(prev, oldIdx, newIdx);
        onReorderChildren?.(item.id, newOrder);
        return newOrder;
      });
    };
    return (
      <div ref={setNodeRef} style={style}>
        <div className={`${rowClass} legend-group-row`}>
          <span className="drag-handle" {...attributes} {...listeners} title="Arrastrar para reordenar">⠿</span>
          <button className="group-expand-btn" onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? "Expandir grupo" : "Colapsar grupo"}>
            <svg width="10" height="10" viewBox="0 0 10 10"
              className={`group-chevron${collapsed ? "" : " open"}`} aria-hidden="true">
              <polyline points="2,2 8,5 2,8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="legend-label legend-group-label">{item.label}</span>
          <GooToggle checked={anyChecked} onChange={handleGroupToggle}
            ariaLabel={`Activar/Desactivar ${item.label}`} />
        </div>
        <div className={`group-children-wrapper${collapsed ? "" : " open"}`}>
          <div className="group-children" style={isChild ? { marginLeft: 12 } : undefined}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
              <SortableContext items={childOrder} strategy={verticalListSortingStrategy}>
                {orderedChildren.map(child => (
                  <SortableRow key={child.id} item={child} depth={depth + 1}
                    onToggle={onToggle} onOpacityChange={onOpacityChange}
                    onReorderChildren={onReorderChildren} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className={rowClass}>
        <span className="drag-handle" {...attributes} {...listeners} title="Arrastrar para reordenar">⠿</span>
        {item.shape && item.color && (
          <span className={`shape ${item.shape}`} style={{ backgroundColor: item.color, width: 12, height: 12 }} />
        )}
        <span className="legend-label">{item.label}</span>
        {item.categories && (
          <button className="group-expand-btn" onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? "Ver categorías" : "Ocultar categorías"} style={{ marginRight: 4 }}>
            <svg width="10" height="10" viewBox="0 0 10 10"
              className={`group-chevron${collapsed ? "" : " open"}`} aria-hidden="true">
              <polyline points="2,2 8,5 2,8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {item.switch && (
          <GooToggle checked={!!item.checked} onChange={() => onToggle?.(item.id)}
            ariaLabel={`Activar/Desactivar ${item.label}`} color={item.color} />
        )}
      </div>
      {item.categories && !collapsed && (
        <div className="group-children" style={{ marginLeft: 22 }}>
          {item.categories.map((cat, i) => (
            <div key={i} className="legend-row legend-row-child" style={{ cursor: "default" }}>
              <span className="drag-handle" style={{ visibility: "hidden" }}>⠿</span>
              <span className={`shape ${cat.shape ?? "square"}`} style={{ backgroundColor: cat.color, width: 10, height: 10 }} />
              <span className="legend-label" style={{ fontSize: 10, opacity: 0.85 }}>{cat.label}</span>
            </div>
          ))}
        </div>
      )}
      {item.switch && item.checked && (
        <div className="opacity-row">
          <svg className="opacity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill={item.color ?? "#1e5b4f"}/>
            <line x1="12" y1="2"  x2="12" y2="5"  stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="2"  y1="12" x2="5"  y2="12" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
            <line x1="19" y1="12" x2="22" y2="12" stroke={item.color ?? "#1e5b4f"} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input type="range" className="opacity-slider" min={0} max={1} step={0.05}
            value={item.opacity ?? 1}
            onChange={(e) => onOpacityChange?.(item.id, parseFloat(e.target.value))}
            aria-label={`Opacidad de ${item.label}`}
            style={item.color ? { background: `linear-gradient(to right, #4a4a55, ${item.color})` } : undefined}
          />
          <svg className="opacity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill={item.color ?? "#1e5b4f"}/>
          </svg>
        </div>
      )}
    </div>
  );
};

const InfoBox: React.FC<InfoBoxProps> = ({
  title,
  subtitle,
  sections,
  onToggle,
  onOpacityChange,
  onReorder,
  onReorderChildren,
  onToggleAll,
  initialOpen = true,
  isDark = false,
  xOffset,
}) => {
  const [open, setOpen] = useState(initialOpen);

  const allVisible = sections.every((s) =>
    s.items.every((i) => !i.switch || i.checked),
  );

  // Estado de orden por sección (índice → array de ids)
  const [sectionOrders, setSectionOrders] = useState<string[][]>(() =>
    sections.map((s) => s.items.map((i) => i.id)),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (sectionIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrders((prev) => {
      const next = prev.map((arr) => [...arr]);
      const order = next[sectionIdx];
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      next[sectionIdx] = arrayMove(order, oldIndex, newIndex);
      onReorder?.(sectionIdx, next[sectionIdx]);
      return next;
    });
  };

  return (
    <>
      {/*== Pestaña lateral cuando el panel está oculto ==*/}
      {!open && (
        <button
          className={`floating-reveal-btn${isDark ? " dark" : ""}`}
          style={xOffset ? { left: xOffset } : undefined}
          onClick={() => setOpen(true)}
          aria-label="Mostrar panel"
          title="Mostrar panel"
        >
          <span className="reveal-label">Mostrar panel</span>
        </button>
      )}

      <aside
        className={`info-box ${open ? "open" : "closed"}${isDark ? " dark" : ""}`}
        style={xOffset ? { left: xOffset } : undefined}
        aria-hidden={!open}
      >
        <header className="info-header">
          <div className="titles">
            <h2 className="info-title">{title}</h2>
            {subtitle && <p className="info-subtitle">{subtitle}</p>}
          </div>

          {/*== Botón ojo: mostrar / ocultar todas las capas ==*/}
          {onToggleAll && (
            <button
              className="eye-toggle"
              onClick={() => onToggleAll(!allVisible)}
              title={allVisible ? "Ocultar todas las capas" : "Mostrar todas las capas"}
              aria-label={allVisible ? "Ocultar todas las capas" : "Mostrar todas las capas"}
            >
              {allVisible ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          )}

          {/*== Botón para ocultar ==*/}
          <button
            className="side-toggle"
            onClick={() => setOpen(false)}
            aria-label="Ocultar panel"
            title="Ocultar panel"
          >
            <span className="chev left" />
          </button>
        </header>

        <div className="info-content">
          {sections.map((section, sIdx) => {
            const order = sectionOrders[sIdx] ?? section.items.map((i) => i.id);
            const itemMap = Object.fromEntries(section.items.map((i) => [i.id, i]));
            const orderedItems = order.map((id) => itemMap[id]).filter(Boolean);

            return (
              <section className="legend-section" key={sIdx}>
                <div className="legend-title">{section.title}</div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(sIdx)}
                >
                  <SortableContext
                    items={order}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedItems.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        depth={0}
                        onToggle={onToggle}
                        onOpacityChange={onOpacityChange}
                        onReorderChildren={onReorderChildren}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
};

export default InfoBox;
