import type { Metadata } from "next";
import { Geist, Geist_Mono, Do_Hyeon } from "next/font/google";
import "./globals.css";

// 제목에 쓰는 둥글둥글한 글꼴
const jua = Do_Hyeon({
  variable: "--font-jua",
  weight: "400",
  preload: false, // 한글 글자 조각은 필요할 때 내려받는다
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "정책·언론 모니터링 & 이슈 브리핑 챗봇",
  description: "수집된 포털 기사만 근거로 답하는 정책·언론 모니터링 챗봇",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${jua.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
