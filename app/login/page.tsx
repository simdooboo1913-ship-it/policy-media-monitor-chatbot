import LoginForm from "./login-form";

// Design Ref: §3.1 — 접속 화면(`/login`).
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="glass w-full max-w-sm space-y-4 p-7">
        <h1 className="font-display text-2xl">
          <span aria-hidden="true">🔐</span> <span className="rainbow-text">정책·언론 모니터링</span>
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
