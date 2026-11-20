// 분류한 행을 엑셀 양식(templates/media-policy-form.xlsx)에 채워 .xlsx 로 만든다. 부처마다 시트 하나.
import path from "node:path";
import ExcelJS from "exceljs";
import { MINISTRIES, type Ministry } from "../ministries";
import { MAX_CELL_LENGTH, MAX_EXPORT_ROWS, type SheetRow } from "./types";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "media-policy-form.xlsx");
// 양식의 줄 번호: 4번째 줄부터 자료, 26번째 줄은 표의 마지막 줄(아래 테두리)
const FIRST_ROW = 4;
const MIDDLE_ROW = 5;
const LAST_ROW = 26;
const COLUMNS = 9;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const isHttp = (url: string) => /^https?:\/\//i.test(url);

/** 화면에서 받은 값을 검사한다. 모양이 틀리면 null. (길이·개수 상한, 부처 목록, http/https 링크만) */
export function validateRows(input: unknown): SheetRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_EXPORT_ROWS) return null;
  const rows: SheetRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const text = (key: string) => (typeof r[key] === "string" ? (r[key] as string).slice(0, MAX_CELL_LENGTH) : null);
    const [date, publisher, content, priorityPolicy, agenda, directive, note, url] = ["date", "publisher", "content", "priorityPolicy", "agenda", "directive", "note", "url"].map(text);
    const ministry = MINISTRIES.find((m) => m === r.ministry);
    const tone = r.tone === "긍정" || r.tone === "부정" || r.tone === "" ? r.tone : null;
    if ([date, publisher, content, priorityPolicy, agenda, directive, note, url].includes(null) || !ministry || tone === null) return null;
    rows.push({
      date: date!, publisher: publisher!, ministry, content: content!, priorityPolicy: priorityPolicy!,
      agenda: agenda!, directive: directive!, tone, note: note!, url: isHttp(url!) ? url! : "",
    });
  }
  return rows;
}

/** 양식의 첫 시트를 다른 시트로 복사한다. (칸 모양·너비·고정 틀·인쇄 설정) */
function copySheet(from: ExcelJS.Worksheet, to: ExcelJS.Worksheet) {
  from.columns.forEach((col, i) => {
    to.getColumn(i + 1).width = col.width;
  });
  for (let r = 1; r <= LAST_ROW; r++) {
    const src = from.getRow(r);
    const dst = to.getRow(r);
    if (src.height) dst.height = src.height;
    for (let c = 1; c <= COLUMNS; c++) {
      const cell = dst.getCell(c);
      cell.value = src.getCell(c).value;
      cell.style = clone(src.getCell(c).style);
    }
  }
  to.mergeCells("A1:D1");
  to.views = clone(from.views);
  to.pageSetup = clone(from.pageSetup);
}

function fillSheet(ws: ExcelJS.Worksheet, ministry: Ministry, rows: SheetRow[]) {
  const styleOf = (r: number) => Array.from({ length: COLUMNS }, (_, c) => clone(ws.getRow(r).getCell(c + 1).style));
  const first = styleOf(FIRST_ROW);
  const middle = styleOf(MIDDLE_ROW);
  const last = styleOf(LAST_ROW);

  ws.name = ministry;
  ws.getCell("A1").value = `${ministry} 언론 & 정책 동향`;
  // 양식에 들어 있던 예시 글자와 빈 표 칸을 모두 비운다.
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    for (let c = 1; c <= COLUMNS; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.value = null;
      cell.style = {};
    }
  }

  rows.forEach((row, i) => {
    const styles = rows.length === 1 || i === 0 ? first : i === rows.length - 1 ? last : middle;
    const values: (string | ExcelJS.CellHyperlinkValue)[] = [
      row.date,
      row.publisher,
      row.ministry,
      row.url ? { text: row.content, hyperlink: row.url } : row.content,
      row.priorityPolicy,
      row.agenda,
      row.directive,
      row.tone,
      row.note,
    ];
    // 양식의 열 순서(일자, 매체명, 부처, 주요내용, 역점정책과제, 국정과제, 대통령 지시사항, 긍정/부정, 비고)대로 넣는다.
    values.forEach((value, c) => {
      const cell = ws.getRow(FIRST_ROW + i).getCell(c + 1);
      cell.value = value;
      cell.style = clone(styles[c]);
      cell.alignment = { ...cell.alignment, wrapText: true, vertical: "middle" };
    });
  });
  ws.autoFilter = `A3:I${FIRST_ROW + rows.length - 1}`;
}

/** 행들을 부처별 시트로 나누어 엑셀 파일(바이트)을 만든다. */
export async function buildWorkbook(rows: SheetRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const template = wb.worksheets[0];
  const ministries = MINISTRIES.filter((m) => rows.some((r) => r.ministry === m));

  // 첫 부처 외에는 양식 모양을 복사해 새 시트를 만든다. (복사본은 양식이 비워지기 전에 만든다)
  const sheets = ministries.map((m, i) => {
    if (i === 0) return template;
    const ws = wb.addWorksheet(`${m}`);
    copySheet(template, ws);
    return ws;
  });
  ministries.forEach((m, i) => fillSheet(sheets[i], m, rows.filter((r) => r.ministry === m)));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
