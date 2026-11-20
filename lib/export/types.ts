// 엑셀 양식(templates/media-policy-form.xlsx)의 한 줄. 화면(브라우저)과 서버가 함께 쓰므로 서버 전용 코드를 가져오지 않는다.
import type { Ministry } from "../ministries";

export type SheetRow = {
  /** 양식의 "일자" (월/일) */
  date: string;
  /** 매체명 */
  publisher: string;
  ministry: Ministry;
  /** 주요내용: 기사 제목·요약문에 있는 내용만으로 쓴 한 문장 */
  content: string;
  /** 역점정책과제: 자료가 없어 비워 두고 사람이 채운다 */
  priorityPolicy: string;
  /** 국정과제: "▸국정{번호}. {과제명}" 또는 "확인 불가" */
  agenda: string;
  /** 관련 대통령 지시사항: 자료가 없어 비워 두고 사람이 채운다 */
  directive: string;
  /** 긍정/부정: AI 제안값(사람이 고친다). 중립이면 빈칸 */
  tone: "긍정" | "부정" | "";
  /** 비고: 제목에서 뽑은 키워드 */
  note: string;
  /** 원문 링크. 엑셀·PDF에서는 주요내용 글자에 걸린다 */
  url: string;
};

/** 엑셀·화면에서 받는 값의 상한 (서버가 한 번 더 검사한다) */
export const MAX_EXPORT_ROWS = 60;
export const MAX_CELL_LENGTH = 600;
