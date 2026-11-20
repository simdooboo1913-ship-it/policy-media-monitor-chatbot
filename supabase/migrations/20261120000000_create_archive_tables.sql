-- 데이터 보관함 표 만들기 (DESIGN.md 4.3)
-- 사용 방법: Supabase 대시보드의 "SQL Editor"에 이 내용을 붙여 넣고 실행한다.
-- 질문과 답변은 어디에도 저장하지 않으므로 해당 표는 없다.

-- 1) 기사: 기사 전문은 저장하지 않고 제목·링크·요약문만 둔다.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null unique,                -- 같은 기사를 두 번 넣지 않기 위한 기준
  publisher text not null,                 -- 기사 주소의 도메인으로 표기
  published_at timestamptz not null,       -- 발행 시각
  summary text not null default '',        -- 수집 서비스가 주는 짧은 설명
  ministry text check (ministry in
    ('과학기술정보통신부', '국토교통부', '조달청', '우주항공청')),  -- 가장 주요하게 언급된 부처 (분류 전에는 비어 있음)
  mentioned_ministries text[] not null default '{}',                 -- 함께 언급된 부처
  edition text check (edition in ('조간', '석간')),                  -- 조간/석간 (분류 전에는 비어 있음)
  duplicate_count integer not null default 1 check (duplicate_count >= 1),  -- 같은 내용으로 묶인 기사 수
  fetched_at timestamptz not null default now()
);

create index if not exists articles_ministry_published_idx
  on public.articles (ministry, published_at desc);
create index if not exists articles_published_idx
  on public.articles (published_at desc);

-- 2) 국정과제: PDF에서 뽑은 과제 번호·과제명·쪽 번호·내용
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  number text not null,                    -- 과제 번호 (예: "12")
  name text not null,                      -- 과제명
  page integer check (page is null or page >= 1),   -- 근거 문구의 출처 표기에 쓰는 쪽 번호
  content text not null,
  source_file text not null,               -- PDF 파일 이름
  unique (source_file, number)
);

-- 3) 수집 실패 기록: 답변과 요약에 "수집되지 않은 부분"을 알리기 위해 사용
create table if not exists public.collection_failures (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  target text not null,                    -- 무엇을 수집하다 실패했는지
  reason text not null                     -- 실패 사유 (비밀 값은 넣지 않는다)
);

create index if not exists collection_failures_occurred_idx
  on public.collection_failures (occurred_at desc);

-- 4) 로그인 실패 횟수: 5회 연속 실패하면 10분간 접속을 막기 위해 사용
create table if not exists public.login_attempts (
  key text primary key,                    -- 이용자가 1명이므로 고정 값 하나만 쓴다
  failed_count integer not null default 0 check (failed_count >= 0),
  blocked_until timestamptz
);

-- 보안: 표마다 행 단위 보안을 켜고 허용 규칙을 만들지 않는다.
-- 서버의 서비스 키만 읽고 쓸 수 있고, 브라우저용 공개 키로는 접근할 수 없다.
alter table public.articles enable row level security;
alter table public.policies enable row level security;
alter table public.collection_failures enable row level security;
alter table public.login_attempts enable row level security;
