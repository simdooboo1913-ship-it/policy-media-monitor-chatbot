-- 로그인 시도 횟수를 한 번에(원자적으로) 처리하는 함수.
-- 읽고 → 비교하고 → 저장하는 방식은 동시 요청이 몰리면 5회 제한을 우회할 수 있어, 행을 잠그고 한 문장 흐름으로 처리한다.

-- 비밀번호를 확인하기 "전에" 시도 1회를 먼저 센다.
--  · 이미 막혀 있으면 시도를 세지 않고 남은 초를 돌려준다.
--  · 이번이 max_failed 번째 시도면 곧바로 차단 시각을 건다. (이 시도가 맞으면 login_succeeded 가 지운다)
--  · 그래서 어떤 동시 요청이 몰려도 비밀번호 확인까지 가는 시도는 한 번의 차단 구간에 max_failed 번뿐이다.
create or replace function public.begin_login_attempt(max_failed integer, block_minutes integer)
returns table (blocked boolean, retry_after_seconds integer, attempt_no integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_state public.login_attempts%rowtype;
  new_count integer;
begin
  insert into public.login_attempts (key, failed_count, blocked_until)
  values ('access', 0, null)
  on conflict (key) do nothing;

  select * into row_state from public.login_attempts where key = 'access' for update;

  if row_state.blocked_until is not null and row_state.blocked_until > now() then
    return query select true, ceil(extract(epoch from (row_state.blocked_until - now())))::integer, row_state.failed_count;
    return;
  end if;

  -- 막힌 시간이 지났으면 새로 센다.
  if row_state.blocked_until is not null then
    row_state.failed_count := 0;
  end if;

  new_count := row_state.failed_count + 1;
  update public.login_attempts
     set failed_count = new_count,
         blocked_until = case when new_count >= max_failed then now() + make_interval(mins => block_minutes) else null end
   where key = 'access';

  return query select false, 0, new_count;
end;
$$;

-- 로그인 성공 시 실패 횟수와 차단을 지운다.
create or replace function public.login_succeeded()
returns void
language sql
security definer
set search_path = public
as $$
  update public.login_attempts set failed_count = 0, blocked_until = null where key = 'access';
$$;

-- 서버의 서비스 키만 호출할 수 있다. (브라우저용 공개 키로는 호출 불가)
revoke all on function public.begin_login_attempt(integer, integer) from public, anon, authenticated;
revoke all on function public.login_succeeded() from public, anon, authenticated;
grant execute on function public.begin_login_attempt(integer, integer) to service_role;
grant execute on function public.login_succeeded() to service_role;
