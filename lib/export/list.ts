// 대시보드에 보여줄 기사 목록: 전날 0시(한국 시간) 이후 기사를 부처별로 묶는다. 같은 내용으로 묶인 기사는 대표 한 건만 나온다.
import { startOfYesterdayKst } from "../collect/window";
import { listArticles } from "../db/articles";
import { MINISTRIES, type Ministry } from "../ministries";
import { editionOf } from "../organize/edition";

export type DashboardArticle = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  edition: string | null;
  duplicateCount: number;
};
export type DashboardList = Record<Ministry, DashboardArticle[]>;

export async function listDashboardArticles(now: Date): Promise<DashboardList> {
  const since = startOfYesterdayKst(now).toISOString();
  const entries = await Promise.all(
    MINISTRIES.map(async (ministry) => {
      const articles = await listArticles({ ministry, since, limit: 300 });
      return [
        ministry,
        articles.map((a) => ({
          id: a.id,
          title: a.title,
          url: a.url,
          publisher: a.publisher,
          publishedAt: a.publishedAt,
          edition: a.edition ?? editionOf(a.publishedAt).edition,
          duplicateCount: a.duplicateCount,
        })),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as DashboardList;
}
