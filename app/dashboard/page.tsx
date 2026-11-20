import Dashboard from "../ui/dashboard";

// 대시보드(`/dashboard`): 기사 수집 → 체크 → 엑셀로 보내기(분류) → 검토 → PDF로 저장
export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Dashboard />
    </main>
  );
}
