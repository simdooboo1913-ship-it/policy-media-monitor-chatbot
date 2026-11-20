// Design Ref: §3.3 — 요약(Digest)을 메일 본문(HTML·글자)으로 바꾼다. (발송은 13번)
import { noticeToText } from "../collect/notice";
import { NO_NEWS_TEXT, POLICY_UNKNOWN_TEXT, type Digest, type DigestItem } from "./build";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function kstTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 구획 이름: 요약 날짜와 같은 날 신문이면 "당일", 하루 전이면 "전날" (예: "당일 조간 (11월 21일)") */
function sectionLabel(editionDate: string, edition: string, digestDate: string): string {
  const [, m, d] = editionDate.split("-");
  const day = Date.parse(digestDate) - Date.parse(editionDate) >= 86_400_000 ? "전날" : "당일";
  return `${day} ${edition} (${Number(m)}월 ${Number(d)}일)`;
}

/** 항목을 신문 구획(날짜+조간/석간)별로 나눈다. 최신 신문이 먼저이고, 같은 날이면 조간 다음에 석간. 구획 안에서는 순위 순서를 지킨다. */
export function groupByEdition(items: DigestItem[], digestDate: string): { label: string; items: DigestItem[] }[] {
  const groups = new Map<string, { key: string; label: string; items: DigestItem[] }>();
  for (const item of items) {
    const key = `${item.editionDate}-${item.edition === "조간" ? 0 : 1}`;
    const g = groups.get(key) ?? { key, label: sectionLabel(item.editionDate, item.edition, digestDate), items: [] };
    g.items.push(item);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key)).map(({ label, items }) => ({ label, items }));
}

function policyText(item: DigestItem): string {
  const p = item.policy;
  if (p && p.status === "found") return `국정과제 ${p.number}번 ${p.name}`;
  return `국정과제 ${POLICY_UNKNOWN_TEXT}`;
}

export function renderText(digest: Digest): string {
  const lines: string[] = [digest.subject, ""];
  for (const m of digest.ministries) {
    lines.push(`■ ${m.ministry}`);
    if (m.items.length === 0) lines.push(`  ${NO_NEWS_TEXT}`);
    for (const group of groupByEdition(m.items, digest.date)) {
      lines.push(`  [${group.label}]`);
      group.items.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item.text}`);
        lines.push(`     ${policyText(item)}`);
        lines.push(`     출처: ${item.title} · ${item.publisher} · ${kstTime(item.publishedAt)}`);
        lines.push(`     ${item.url}`);
      });
    }
    if (m.relatedCount > 0) {
      lines.push(`  ※ 관련 기사 있음: 다른 부처로 분류된 기사 중 ${m.ministry}을(를) 함께 언급한 기사 ${m.relatedCount}건`);
      for (const r of m.related) lines.push(`     - (${r.ministry}) ${r.title} ${r.url}`);
    }
    lines.push("");
  }
  if (digest.notice) lines.push(`※ ${noticeToText(digest.notice)}`, "");
  lines.push("이 메일은 수집된 기사의 제목·요약문만 근거로 자동 작성되었으며, 평가·전망·진위 판단을 담지 않습니다.");
  return lines.join("\n");
}

export function renderHtml(digest: Digest): string {
  const parts: string[] = [];
  parts.push(`<div style="font-family:'Malgun Gothic',sans-serif;max-width:720px;margin:0 auto;color:#1f2937;font-size:14px;line-height:1.6">`);
  parts.push(`<h2 style="font-size:18px">${esc(digest.subject)}</h2>`);
  for (const m of digest.ministries) {
    parts.push(`<h3 style="font-size:16px;border-bottom:1px solid #d1d5db;padding-bottom:4px;margin-top:24px">■ ${esc(m.ministry)}</h3>`);
    if (m.items.length === 0) parts.push(`<p style="color:#6b7280">${NO_NEWS_TEXT}</p>`);
    else {
      for (const group of groupByEdition(m.items, digest.date)) {
        parts.push(`<h4 style="font-size:14px;margin:14px 0 4px;color:#374151">[${esc(group.label)}]</h4><ol style="padding-left:20px;margin-top:4px">`);
        for (const item of group.items) {
          parts.push(
            `<li style="margin-bottom:10px">${esc(item.text)}<br>` +
              `<span style="font-size:12px;color:#4b5563">${esc(policyText(item))}</span><br>` +
              `<span style="font-size:12px">출처: <a href="${esc(item.url)}">${esc(item.title)}</a> · ${esc(item.publisher)} · ${esc(kstTime(item.publishedAt))}</span></li>`,
          );
        }
        parts.push(`</ol>`);
      }
    }
    if (m.relatedCount > 0) {
      parts.push(`<p style="font-size:12px;color:#4b5563">※ 관련 기사 있음: 다른 부처로 분류된 기사 중 ${esc(m.ministry)}을(를) 함께 언급한 기사 ${m.relatedCount}건<br>`);
      parts.push(m.related.map((r) => `- (${esc(r.ministry)}) <a href="${esc(r.url)}">${esc(r.title)}</a>`).join("<br>"));
      parts.push(`</p>`);
    }
  }
  if (digest.notice) {
    parts.push(`<div style="margin-top:24px;padding:8px 12px;background:#fffbeb;border:1px solid #fcd34d;font-size:13px">⚠ ${esc(digest.notice.heading)}<ul>`);
    for (const i of digest.notice.items) parts.push(`<li>${esc(i.target)}: ${esc(i.reason)}</li>`);
    parts.push(`</ul></div>`);
  }
  parts.push(`<p style="margin-top:24px;font-size:11px;color:#6b7280">이 메일은 수집된 기사의 제목·요약문만 근거로 자동 작성되었으며, 평가·전망·진위 판단을 담지 않습니다.</p></div>`);
  return parts.join("\n");
}
