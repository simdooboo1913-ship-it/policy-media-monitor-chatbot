import LoginForm from "./login-form";

// Design Ref: §3.1 — 접속 화면(`/login`).
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-bold">정책·언론 모니터링 챗봇</h1>
        <LoginForm />
      </div>
    </main>
  );
}
