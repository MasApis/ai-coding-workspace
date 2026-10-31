import { useRef, type KeyboardEvent } from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
}

export function tabId(panelId: string, id: string): string {
  return `${panelId}-tab-${id}`;
}

// Attributes for the single panel a tablist controls. Spread them on the panel
// element so aria-controls/aria-labelledby always point at real ids.
export function tabPanelProps(panelId: string, activeId: string) {
  return {
    id: panelId,
    role: "tabpanel" as const,
    "aria-labelledby": tabId(panelId, activeId),
    tabIndex: 0,
  };
}

const DEFAULT_TAB_CLASSES = (active: boolean): string =>
  `rounded-control px-3 py-2 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-ink-soft hover:bg-canvas"}`;

// Roving tabindex plus arrow/Home/End keys, per the WAI-ARIA tabs pattern.
// Styling stays with the caller because the three tab strips in the app look
// different on purpose.
export function TabList<T extends string>({
  label,
  items,
  value,
  onChange,
  panelId,
  className = "flex gap-1",
  tabClassName = DEFAULT_TAB_CLASSES,
}: {
  label: string;
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  panelId: string;
  className?: string;
  tabClassName?: (active: boolean) => string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const last = items.length - 1;
    let target = index;
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    else return;
    event.preventDefault();
    const next = items[target];
    if (!next) return;
    onChange(next.id);
    refs.current[target]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={className}>
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabId(panelId, item.id)}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClassName(active)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
