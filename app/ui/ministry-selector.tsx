"use client";

// Design Ref: §3.2 — 부처 선택 버튼 4개, 하나만 선택할 수 있다. (부처마다 이모지와 색)
import { MINISTRIES, MINISTRY_SHORT, type Ministry } from "@/lib/ministries";

type Props = {
  selected: Ministry | null;
  onSelect: (ministry: Ministry) => void;
};

// 선택하면 켜지는 색 (Tailwind 는 글자 그대로 적힌 클래스만 만들어 주므로 통째로 적는다)
const LOOK: Record<Ministry, { emoji: string; on: string; off: string }> = {
  과학기술정보통신부: { emoji: "🔬", on: "from-violet-500 to-fuchsia-500", off: "hover:border-violet-300" },
  국토교통부: { emoji: "🚄", on: "from-emerald-500 to-teal-400", off: "hover:border-emerald-300" },
  조달청: { emoji: "🛒", on: "from-amber-500 to-orange-500", off: "hover:border-amber-300" },
  우주항공청: { emoji: "🚀", on: "from-sky-500 to-indigo-500", off: "hover:border-sky-300" },
};

export default function MinistrySelector({ selected, onSelect }: Props) {
  return (
    <div role="radiogroup" aria-label="부처 선택" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {MINISTRIES.map((ministry) => {
        const isSelected = ministry === selected;
        const look = LOOK[ministry];
        return (
          <button
            key={ministry}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(ministry)}
            className={
              "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-base font-bold text-white transition-all duration-150 hover:-translate-y-0.5 active:scale-95 " +
              (isSelected
                ? `border-white/70 bg-gradient-to-br ${look.on} shadow-lg shadow-fuchsia-500/30`
                : `border-white/20 bg-white/10 ${look.off}`)
            }
          >
            <span aria-hidden="true" className="text-xl">
              {look.emoji}
            </span>
            {MINISTRY_SHORT[ministry]}
          </button>
        );
      })}
    </div>
  );
}
