"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary px-5 py-2.5 print:hidden">
      Print
    </button>
  );
}
