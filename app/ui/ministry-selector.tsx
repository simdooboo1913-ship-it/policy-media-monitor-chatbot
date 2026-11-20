"use client";

// Design Ref: §3.2 — 부처 선택 버튼 4개, 하나만 선택할 수 있다.
import { MINISTRIES, type Ministry } from "@/lib/ministries";

type Props = {
  selected: Ministry | null;
  onSelect: (ministry: Ministry) => void;
};

export default function MinistrySelector({ selected, onSelect }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="부처 선택"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {MINISTRIES.map((ministry) => {
        const isSelected = ministry === selected;
        return (
          <button
            key={ministry}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(ministry)}
            className={
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
              (isSelected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800")
            }
          >
            {ministry}
          </button>
        );
      })}
    </div>
  );
}
