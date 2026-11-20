import ChatScreen from "./ui/chat-screen";

// Design Ref: §3.2 — 메인 화면(`/`). 상호작용은 ChatScreen(클라이언트 컴포넌트)이 맡는다.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <ChatScreen />
    </main>
  );
}
