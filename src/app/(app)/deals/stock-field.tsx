"use client";

import { useId, useMemo, useState } from "react";
import { searchVehicleOptions, type VehicleOption } from "@/lib/inventory/vehicle-options";

/**
 * Stock # with inventory suggestions. Whatever is in the box is what's saved — picking a suggestion
 * only fills in the stock number; save_deal decides the vehicle link on the server.
 */
export function StockField({ defaultValue, vehicles }: { defaultValue?: string; vehicles: VehicleOption[] }) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => searchVehicleOptions(vehicles, value), [vehicles, value]);
  // Hide the list once the box holds exactly the one car it would suggest
  const exact = matches.length === 1 && matches[0].stockNumber.toUpperCase() === value.trim().toUpperCase();
  const showList = open && matches.length > 0 && !exact;

  const pick = (o: VehicleOption) => {
    setValue(o.stockNumber);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor="stock_number" className="field-label">Stock #</label>
      <input
        id="stock_number"
        name="stock_number"
        required
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="characters"
        enterKeyHint="next"
        placeholder="Type stock #, make or model"
        className="input uppercase placeholder:normal-case"
      />
      {showList && (
        <ul id={listId} role="listbox" aria-label="Cars in inventory" className="card absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto p-1 shadow-xl">
          {matches.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the box (mouse down would blur it and close the list); pick on click,
              // which a finger-scroll of the list never fires
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 ${i === active ? "bg-primary-soft" : "hover:bg-surface-card-hover"}`}
            >
              {o.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- VinCue CDN photo, same as the inventory list
                <img src={o.image} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-surface-subtle text-xs text-on-surface-subtle">No photo</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{o.title}</span>
                <span className="block text-xs text-on-surface-muted">
                  #{o.stockNumber}
                  {o.gone && <span className="ml-2 text-on-surface-subtle">· Left inventory</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
