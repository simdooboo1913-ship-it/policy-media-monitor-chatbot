// Design Ref: §4.3 — 기사 표. 기사 전문은 저장하지 않고 제목·링크·요약문만 둔다.
import type { Ministry } from "../ministries";
import { getDb, throwDbError } from "./client";

export type Edition = "조간" | "석간";

export type Article = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string; // ISO 시각 문자열
  summary: string;
  ministry: Ministry | null;
  mentionedMinistries: Ministry[];
  edition: Edition | null;
  duplicateCount: number; // 대표 기사: 같은 내용으로 묶인 기사 수 (자신 포함)
  duplicateOf: string | null; // 중복으로 묶인 기사: 대표 기사의 id, 대표 기사나 단독 기사는 null
};

/** 새로 넣을 기사 (id 는 보관함이 만든다) */
export type NewArticle = Omit<Article, "id">;

type ArticleRow = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  published_at: string;
  summary: string;
  ministry: Ministry | null;
  mentioned_ministries: Ministry[];
  edition: Edition | null;
  duplicate_count: number;
  duplicate_of: string | null;
};

function fromRow(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    publishedAt: row.published_at,
    summary: row.summary,
    ministry: row.ministry,
    mentionedMinistries: row.mentioned_ministries,
    edition: row.edition,
    duplicateCount: row.duplicate_count,
    duplicateOf: row.duplicate_of,
  };
}

function toRow(article: NewArticle) {
  return {
    title: article.title,
    url: article.url,
    publisher: article.publisher,
    published_at: article.publishedAt,
    summary: article.summary,
    ministry: article.ministry,
    mentioned_ministries: article.mentionedMinistries,
    edition: article.edition,
    duplicate_count: article.duplicateCount,
    duplicate_of: article.duplicateOf,
  };
}

/** 기사를 저장한다. 같은 주소(url)의 기사는 덮어쓴다. */
export async function saveArticles(articles: NewArticle[]): Promise<void> {
  if (articles.length === 0) return;
  const { error } = await getDb().from("articles").upsert(articles.map(toRow), { onConflict: "url" });
  if (error) throwDbError("기사 저장", error.message);
}

/**
 * 보관함에 없는 기사만 새로 넣는다. 이미 있는 주소는 건드리지 않는다.
 * (이미 정리된 부처·조간석간·중복 값이 다시 수집하면서 지워지지 않게 하기 위함) 새로 넣은 개수를 돌려준다.
 */
export async function insertNewArticles(articles: NewArticle[]): Promise<number> {
  if (articles.length === 0) return 0;
  const { data, error } = await getDb()
    .from("articles")
    .upsert(articles.map(toRow), { onConflict: "url", ignoreDuplicates: true })
    .select("id");
  if (error) throwDbError("새 기사 저장", error.message);
  return data?.length ?? 0;
}

/** 정리한 결과(부처·조간석간·중복 표시)를 id 기준으로 보관함에 반영한다. */
export async function updateArticles(articles: Article[], chunkSize = 200): Promise<void> {
  for (let i = 0; i < articles.length; i += chunkSize) {
    const rows = articles.slice(i, i + chunkSize).map((a) => ({ id: a.id, ...toRow(a) }));
    const { error } = await getDb().from("articles").upsert(rows, { onConflict: "id" });
    if (error) throwDbError("기사 정리 결과 저장", error.message);
  }
}

/** 조건에 맞는 기사를 최신순으로 가져온다. 기본적으로 중복으로 묶인 기사는 뺀다. */
export async function listArticles(options: {
  ministry?: Ministry;
  since?: string; // 이 시각 이후에 발행된 기사만 (ISO 시각 문자열)
  until?: string; // 이 시각 이전에 발행된 기사만
  limit?: number;
  includeDuplicates?: boolean; // true 면 중복으로 묶인 기사도 함께 가져온다
}): Promise<Article[]> {
  let query = getDb()
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (!options.includeDuplicates) query = query.is("duplicate_of", null);
  if (options.ministry) query = query.eq("ministry", options.ministry);
  if (options.since) query = query.gte("published_at", options.since);
  if (options.until) query = query.lte("published_at", options.until);

  const { data, error } = await query;
  if (error) throwDbError("기사 조회", error.message);
  return ((data ?? []) as ArticleRow[]).map(fromRow);
}

/** 보관함의 기사를 모두 가져온다. (한 번에 가져올 수 있는 개수 제한이 있어 나누어 읽는다) 발행 시각이 이른 순이다. */
export async function listAllArticles(pageSize = 1000): Promise<Article[]> {
  const all: Article[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getDb()
      .from("articles")
      .select("*")
      .order("published_at", { ascending: true })
      .order("id", { ascending: true }) // 발행 시각이 같을 때도 순서가 흔들리지 않게 한다
      .range(from, from + pageSize - 1);
    if (error) throwDbError("기사 전체 조회", error.message);
    const rows = (data ?? []) as ArticleRow[];
    all.push(...rows.map(fromRow));
    if (rows.length < pageSize) break;
  }
  return all;
}

/** 보관 기간(일)이 지난 기사를 지운다. 지운 개수를 돌려준다. (기본 보관 기간은 7일, DESIGN 4.3) */
export async function deleteExpiredArticles(keepDays = 7): Promise<number> {
  const limit = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getDb()
    .from("articles")
    .delete()
    .lt("published_at", limit)
    .select("id");
  if (error) throwDbError("오래된 기사 삭제", error.message);
  return data?.length ?? 0;
}

/** 선택한 기사들을 id 로 가져온다. (엑셀로 보낼 기사 확인용) */
export async function listArticlesByIds(ids: string[]): Promise<Article[]> {
  if (ids.length === 0) return [];
  const { data, error } = await getDb().from("articles").select("*").in("id", ids);
  if (error) throwDbError("선택한 기사 조회", error.message);
  return ((data ?? []) as ArticleRow[]).map(fromRow);
}
