-- 중복 기사 표시 칸 추가 (개발 순서 7번: 기사 정리)
-- 같은 내용을 다룬 기사들은 가장 먼저 발행된 대표 기사 하나로 묶는다.
-- 대표 기사는 이 칸이 비어 있고(duplicate_count 에 묶인 수를 기록),
-- 나머지 기사는 이 칸에 대표 기사의 번호를 넣어 답변·요약에서 빼는 데 쓴다.
-- 사용 방법: Supabase 대시보드의 "SQL Editor"에 이 내용을 붙여 넣고 실행한다.

alter table public.articles
  add column if not exists duplicate_of uuid
  references public.articles (id) on delete set null;

create index if not exists articles_duplicate_of_idx
  on public.articles (duplicate_of);
