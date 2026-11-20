"use client";

// Design Ref: §3.2 — 수집 안내 배너. 수집 실패가 있을 때만 보인다.
import { useEffect, useState } from "react";
import type { CollectionNotice } from "@/lib/collect/notice";

export default function CollectionNoticeBanner() {
  const [notice, setNotice] = useState<CollectionNotice | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/collection-notice")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { notice: CollectionNotice | null } | null) => {
        if (!cancelled && body) setNotice(body.notice);
      })
      .catch(() => {}); // 안내를 못 읽어도 화면은 그대로 쓴다
    return () => {
      cancelled = true;
    };
  }, []);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-medium">⚠ {notice.heading}</p>
      <ul className="mt-1 list-disc pl-5">
        {notice.items.map((item) => (
          <li key={item.target}>
            {item.target}: {item.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
