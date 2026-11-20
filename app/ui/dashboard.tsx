"use client";

// 대시보드: ① 기사 수집 ② 체크 ③ 엑셀로 보내기(양식 열에 맞춰 분류) ④ 검토·수정 ⑤ 엑셀 내려받기 / PDF로 저장
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DashboardArticle, DashboardList } from "@/lib/export/list";
import type { SheetRow } from "@/lib/export/types";
import { publisherName } from "@/lib/export/publisher";
import { MINISTRIES, MINISTRY_SHORT } from "@/lib/ministries";

const HEADERS = ["일자", "매체명", "부처", "주요내용", "역점정책과제", "국정과제", "관련 대통령 지시사항", "긍정/부정", "비고(키워드 등)"];
const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white";
const buttonClass = "btn-pop px-5 py-2.5 text-sm";

const fmtTime = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export default function Dashboard() {
  const router = useRouter();
  const [articles, setArticles] = useState<DashboardList | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"load" | "collect" | "classify" | "download" | null>("load");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<SheetRow[] | null>(null);

  // 로그인이 만료되면(401) 로그인 화면으로 보낸다.
  async function call(input: string, init?: RequestInit): Promise<Response | null> {
    const res = await fetch(input, init);
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    return res;
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await call("/api/collect");
        if (res?.ok) setArticles((await res.json()).articles);
      } catch {
        setMessage("기사를 불러오지 못했습니다.");
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function collect() {
    setBusy("collect");
    setMessage("기사를 수집하는 중입니다. (10~30초)");
    try {
      const res = await call("/api/collect", { method: "POST" });
      if (!res) return;
      const body = await res.json();
      if (!res.ok) return setMessage(body.error ?? "기사를 수집하지 못했습니다.");
      setArticles(body.articles);
      setChecked(new Set()); // 목록이 바뀌었으므로 체크를 비운다
      setMessage(`수집 완료: 새 기사 ${body.inserted}건${body.failedFeeds > 0 ? ` (가져오지 못한 곳 ${body.failedFeeds}개)` : ""}`);
    } catch {
      setMessage("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function sendToExcel() {
    setBusy("classify");
    setMessage("엑셀 양식에 맞춰 분류하는 중입니다. (10~30초)");
    try {
      const all = articles ? MINISTRIES.flatMap((m) => articles[m]) : [];
      const ids = all.filter((a) => checked.has(a.id)).map((a) => a.id); // 화면 순서대로
      const res = await call("/api/export/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res) return;
      const body = await res.json();
      if (!res.ok) return setMessage(body.error ?? "분류하지 못했습니다.");
      setRows(body.rows);
      setMessage("");
    } catch {
      setMessage("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadXlsx() {
    if (!rows) return;
    setBusy("download");
    try {
      const res = await call("/api/export/xlsx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      if (!res) return;
      if (!res.ok) return setMessage((await res.json()).error ?? "엑셀 파일을 만들지 못했습니다.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `언론정책동향_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleMinistry = (list: DashboardArticle[]) =>
    setChecked((prev) => {
      const next = new Set(prev);
      const allOn = list.every((a) => next.has(a.id));
      list.forEach((a) => (allOn ? next.delete(a.id) : next.add(a.id)));
      return next;
    });
  const updateRow = (index: number, patch: Partial<SheetRow>) =>
    setRows((prev) => prev && prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  // 검토 화면 표는 부처 순서(양식의 시트 순서)로 보여 준다.
  const ordered = useMemo(
    () => (rows ? MINISTRIES.flatMap((m) => rows.map((r, i) => ({ r, i })).filter((x) => x.r.ministry === m)) : []),
    [rows],
  );

  // ───── 검토 화면 ─────
  if (rows) {
    return (
      <div className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 px-4 py-6 print:max-w-none print:p-0">
        <header className="space-y-2 print:hidden">
          <h1 className="font-display text-2xl sm:text-3xl">
          <span aria-hidden="true">📝</span> <span className="rainbow-text">엑셀 양식 검토</span>
        </h1>
          <p className="text-sm text-violet-100/80">
            칸을 눌러 고칠 수 있습니다. <b>국정과제</b>는 국정과제 PDF에서 근거가 확인된 것만 넣었고, <b>역점정책과제·대통령 지시사항</b>은 자료가 없어 비워 두었습니다.
            <b> 긍정/부정</b>은 기사 논조에 대한 AI 제안이니 확인해 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRows(null)} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/20">
              ← 기사 다시 고르기
            </button>
            <button onClick={downloadXlsx} disabled={busy !== null} className={`${buttonClass} btn-green`}>
              📗 엑셀 내려받기
            </button>
            <button onClick={() => window.print()} className={buttonClass}>
              📄 PDF로 저장
            </button>
          </div>
          {message && (
            <p role="status" className="text-sm text-rose-300">
              {message}
            </p>
          )}
        </header>

        {/* 화면용: 고칠 수 있는 표 */}
        <div className="overflow-x-auto print:hidden">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="border border-white/20 bg-white/15 px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map(({ r, i }) => (
                <tr key={i} className="align-top">
                  <td className="w-16 border border-white/15 p-1">
                    <input className={inputClass} aria-label="일자" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} />
                  </td>
                  <td className="w-24 border border-white/15 p-1">
                    <input className={inputClass} aria-label="매체명" value={r.publisher} onChange={(e) => updateRow(i, { publisher: e.target.value })} />
                  </td>
                  <td className="w-24 border border-white/15 p-1 text-center">{MINISTRY_SHORT[r.ministry]}</td>
                  <td className="min-w-64 border border-white/15 p-1">
                    <textarea className={inputClass} aria-label="주요내용" rows={3} value={r.content} onChange={(e) => updateRow(i, { content: e.target.value })} />
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">
                        원문 보기
                      </a>
                    )}
                  </td>
                  <td className="w-28 border border-white/15 p-1">
                    <textarea className={inputClass} aria-label="역점정책과제" rows={3} value={r.priorityPolicy} onChange={(e) => updateRow(i, { priorityPolicy: e.target.value })} />
                  </td>
                  <td className="min-w-44 border border-white/15 p-1">
                    <textarea className={inputClass} aria-label="국정과제" rows={3} value={r.agenda} onChange={(e) => updateRow(i, { agenda: e.target.value })} />
                  </td>
                  <td className="w-32 border border-white/15 p-1">
                    <textarea className={inputClass} aria-label="관련 대통령 지시사항" rows={3} value={r.directive} onChange={(e) => updateRow(i, { directive: e.target.value })} />
                  </td>
                  <td className="w-20 border border-white/15 p-1">
                    <select className={inputClass} aria-label="긍정/부정" value={r.tone} onChange={(e) => updateRow(i, { tone: e.target.value as SheetRow["tone"] })}>
                      <option value="">(없음)</option>
                      <option value="긍정">긍정</option>
                      <option value="부정">부정</option>
                    </select>
                  </td>
                  <td className="w-32 border border-white/15 p-1">
                    <textarea className={inputClass} aria-label="비고" rows={3} value={r.note} onChange={(e) => updateRow(i, { note: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 인쇄(PDF)용: 부처마다 양식 모양의 표 */}
        <div className="hidden print:block">
          {MINISTRIES.filter((m) => rows.some((r) => r.ministry === m)).map((m) => (
            <section key={m} className="mb-6 break-after-page last:mb-0 last:break-after-auto">
              <h2 className="mb-2 text-base font-bold">{MINISTRY_SHORT[m]} 언론 &amp; 정책 동향</h2>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    {HEADERS.map((h) => (
                      <th key={h} className="border border-black bg-zinc-200 px-1 py-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((r) => r.ministry === m)
                    .map((r, i) => (
                      <tr key={i} className="break-inside-avoid align-top">
                        <td className="border border-black px-1 py-0.5 text-center">{r.date}</td>
                        <td className="border border-black px-1 py-0.5">{r.publisher}</td>
                        <td className="border border-black px-1 py-0.5">{MINISTRY_SHORT[r.ministry]}</td>
                        <td className="border border-black px-1 py-0.5">
                          {r.url ? (
                            <a href={r.url} className="underline">
                              {r.content}
                            </a>
                          ) : (
                            r.content
                          )}
                        </td>
                        <td className="border border-black px-1 py-0.5">{r.priorityPolicy}</td>
                        <td className="border border-black px-1 py-0.5">{r.agenda}</td>
                        <td className="border border-black px-1 py-0.5">{r.directive}</td>
                        <td className="border border-black px-1 py-0.5 text-center">{r.tone}</td>
                        <td className="border border-black px-1 py-0.5">{r.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ───── 기사 수집·선택 화면 ─────
  const total = articles ? MINISTRIES.reduce((n, m) => n + articles[m].length, 0) : 0;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl">
          <span aria-hidden="true">📊</span> <span className="rainbow-text">대시보드</span>
        </h1>
        <Link href="/" className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
          ← 질의응답 화면
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={collect} disabled={busy !== null} className={buttonClass}>
          {busy === "collect" ? "수집 중… ⏳" : "📥 기사 수집"}
        </button>
        <span role="status" className="text-sm text-violet-100/80">
          {message || (busy === "load" ? "불러오는 중…" : `전날 0시 이후 기사 ${total}건 (같은 내용은 한 건으로 묶음)`)}
        </span>
      </div>

      {articles &&
        MINISTRIES.map((m) => {
          const list = articles[m];
          const allOn = list.length > 0 && list.every((a) => checked.has(a.id));
          return (
            <section key={m} className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">
                  {MINISTRY_SHORT[m]} <span className="text-sm font-normal text-violet-200/70">({list.length}건)</span>
                </h2>
                {list.length > 0 && (
                  <label className="flex items-center gap-1 text-xs text-violet-100/80">
                    <input type="checkbox" checked={allOn} onChange={() => toggleMinistry(list)} /> 전체 선택
                  </label>
                )}
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-violet-200/70">수집된 기사가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 py-2">
                      <input type="checkbox" className="mt-1" aria-label={`${a.title} 선택`} checked={checked.has(a.id)} onChange={() => toggle(a.id)} />
                      <div className="min-w-0 text-sm">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-300 hover:underline">
                          {a.title}
                        </a>
                        <p className="text-xs text-violet-200/70">
                          {publisherName(a.publisher)} · {fmtTime(a.publishedAt)}
                          {a.edition ? ` · ${a.edition}` : ""}
                          {a.duplicateCount > 1 ? ` · 같은 내용 ${a.duplicateCount}건` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      <div className="sticky bottom-0 flex items-center justify-between gap-2 glass p-3">
        <span className="text-sm">{checked.size}건 선택</span>
        <button onClick={sendToExcel} disabled={checked.size === 0 || busy !== null} className={`${buttonClass} btn-green`}>
          {busy === "classify" ? "분류 중… ⏳" : "📤 엑셀로 보내기"}
        </button>
      </div>
    </div>
  );
}
