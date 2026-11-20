// Design Ref: §4.4 — 국정과제 PDF에서 과제 번호·과제명·쪽 번호·내용을 뽑는다.
// 이 파일은 "PDF에서 뽑은 쪽별 글자"를 받아 정리하기만 한다. (파일 읽기·보관함 저장 없음)
// 규칙은 「이재명정부 123대 국정과제」 PDF의 실제 모양에 맞춘 것이다:
//   1) 차례 부분의 "[국정NN] 과제명 주관부처" 줄이 과제 목록의 기준이다.
//   2) 본문의 "NN 과제명" 줄이 각 과제의 시작이고, 다음 과제가 시작되기 전까지가 그 과제의 내용이다.
import type { Policy } from "../db/policies";

export type AgendaPage = { num: number; text: string };

export type ParseResult = {
  policies: Policy[];
  /** 문제가 있으면 한국어 설명이 들어 있다. 비어 있어야 정상이다. */
  problems: string[];
};

type OverviewItem = { number: number; title: string; department: string };
type Line = { page: number; text: string };

/** 과제 수 (PDF 제목이 "123대 국정과제") */
export const EXPECTED_POLICY_COUNT = 123;

// 쪽 위·아래에 반복되는 머리글 ("Ⅲ. 123대 국정과제 \t075", "076 \t이재명정부 123대 국정과제")
const PAGE_HEADER_PATTERNS = [
  /^Ⅲ\.\s*123대 국정과제\s*\t?\s*\d+\s*$/,
  /^\d+\s*\t\s*이재명정부 123대 국정과제\s*$/,
  /^이재명정부 123대 국정과제\s*$/,
];

function isPageHeader(line: string): boolean {
  return PAGE_HEADER_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

/** 차례의 "[국정NN] 과제명 \t주관부처" 줄에서 과제 목록을 만든다. */
function readOverview(pages: AgendaPage[]): { items: OverviewItem[]; lastPage: number } {
  const items: OverviewItem[] = [];
  let lastPage = 0;
  for (const page of pages) {
    const rows = page.text.split("\n").map((row) => row.trim());
    for (let i = 0; i < rows.length; i++) {
      const match = rows[i].match(/^\[국정(\d+)\]\s*(.+)$/);
      if (!match) continue;
      let rest = match[2];
      // 과제명이 길어 다음 줄로 넘어가면 "과제명 앞부분" 다음 줄에 "뒷부분 주관부처"가 온다. 두 줄을 이어 붙인다.
      if (!rest.includes("\t") && i + 1 < rows.length && !rows[i + 1].startsWith("[")) {
        rest = `${rest}${rows[i + 1]}`;
        // 이어 붙인 줄의 마지막 낱말이 주관부처이다. (탭으로 나누기 위해 표시를 넣는다)
        rest = rest.replace(/\s+(\S+)$/, "\t$1");
        i++;
      }
      const parts = rest.split(/\t+/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      items.push({
        number: Number(match[1]),
        title: parts.slice(0, -1).join(" "),
        department: parts[parts.length - 1],
      });
      lastPage = Math.max(lastPage, page.num);
    }
  }
  return { items, lastPage };
}

/** 본문 쪽들의 줄을 하나로 이어 붙인다. 내용이 없는 표지·구분 쪽은 뺀다. */
function collectBodyLines(pages: AgendaPage[], afterPage: number): Line[] {
  const lines: Line[] = [];
  for (const page of pages) {
    if (page.num <= afterPage) continue;
    // 과제 내용에는 "◉" 또는 "•" 글머리표가 있다. 없으면 표지·구분 쪽이다. (예: "전략-1 …")
    if (!/[◉•]/.test(page.text)) continue;
    for (const raw of page.text.split("\n")) {
      const text = raw.replace(/\s+$/, "");
      if (text.trim() === "" || isPageHeader(text)) continue;
      lines.push({ page: page.num, text });
    }
  }
  return lines;
}

/**
 * 줄이 "NN 과제명" 모양의 과제 시작 줄인지 확인한다.
 * 본문의 과제명은 차례와 글자가 조금 다른 경우가 있어(예: 38번), 제목 글자 대신 모양으로 확인한다:
 * 시작 줄의 번호가 맞고, 바로 뒤 4줄 안에 "◉ 과제목표" 줄이 있어야 한다.
 * 맞으면 내용이 시작되는 줄(◉ 줄)의 위치를 돌려준다.
 */
function matchHeading(lines: Line[], index: number, item: OverviewItem): number | null {
  const match = lines[index].text.match(/^(\d{1,3})\s+(\S.*)$/);
  if (!match || Number(match[1]) !== item.number) return null;
  for (let offset = 1; offset <= 4 && index + offset < lines.length; offset++) {
    if (lines[index + offset].text.trimStart().startsWith("◉")) return index + offset;
  }
  return null;
}

export function parseAgenda(pages: AgendaPage[], sourceFile: string): ParseResult {
  const problems: string[] = [];
  const { items, lastPage } = readOverview(pages);

  if (items.length !== EXPECTED_POLICY_COUNT) {
    problems.push(`차례에서 찾은 과제가 ${items.length}개입니다. (기대: ${EXPECTED_POLICY_COUNT}개)`);
  }
  const numbers = items.map((item) => item.number);
  if (new Set(numbers).size !== numbers.length) {
    problems.push("차례에 같은 과제 번호가 두 번 이상 나옵니다.");
  }

  const lines = collectBodyLines(pages, lastPage);

  // 과제를 번호순으로 보면서 본문에서 시작 줄을 찾는다. (앞 과제보다 뒤쪽에서만 찾는다)
  const sorted = [...items].sort((a, b) => a.number - b.number);
  const starts: { item: OverviewItem; index: number; bodyStart: number }[] = [];
  let cursor = 0;
  for (const item of sorted) {
    let found = false;
    for (let i = cursor; i < lines.length; i++) {
      const bodyStart = matchHeading(lines, i, item);
      if (bodyStart !== null) {
        starts.push({ item, index: i, bodyStart });
        cursor = bodyStart;
        found = true;
        break;
      }
    }
    if (!found) problems.push(`본문에서 국정과제 ${item.number}번 "${item.title}"의 시작을 찾지 못했습니다.`);
  }

  const policies: Policy[] = [];
  starts.forEach((start, k) => {
    const bodyEnd = k + 1 < starts.length ? starts[k + 1].index : lines.length;
    // 제목과 주관부처 줄은 빼고 "◉ 과제목표"부터 내용으로 쓴다. (주관부처는 차례의 값을 쓴다)
    const body = lines
      .slice(start.bodyStart, bodyEnd)
      .map((line) => line.text.replace(/\t+/g, " ").trim());
    const content = `주관부처: ${start.item.department}\n${body.join("\n")}`;
    if (!content.includes("◉")) {
      problems.push(`국정과제 ${start.item.number}번의 내용에서 "◉ 과제목표" 등을 찾지 못했습니다.`);
    }
    policies.push({
      number: String(start.item.number),
      name: start.item.title,
      page: lines[start.index].page, // PDF 뷰어에서 보이는 쪽 번호 (차례의 인쇄 쪽 번호와 1쪽 차이날 수 있음)
      content,
      sourceFile,
    });
  });

  return { policies, problems };
}
