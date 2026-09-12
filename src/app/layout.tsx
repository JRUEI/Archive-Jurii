import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Header from "@/components/Header";
import { FocusModeProvider } from "@/components/FocusModeProvider";
import { HomeLayoutProvider } from "@/components/HomeLayoutProvider";
import { getMembersData } from "@/lib/members";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  weight: ["400", "700", "900"],
  subsets: ["latin"],
});

const notoSans = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "逢田 珠里依（≒JOY）｜SHOWROOM(ショールーム)",
  description: "逢田珠里依（≒JOY） 非公式逐字稿與內容紀錄",
  // 不要被搜尋引擎收錄。GitHub Pages 子路徑站的 robots.txt 會落在
  // jruei.github.io/robots.txt（不屬於這個 repo），所以只能用 meta 標。
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 右上角的 SNS 連結跟成員頁同一份資料
  const hostSns = getMembersData().members.find((member) => member.isHost)?.sns;

  return (
    <html lang="zh-TW" translate="no" suppressHydrationWarning>
      <head>
        {/* 靜態匯出沒有 response header，用 meta 發 CSP。
            frame-ancestors 跟 X-Frame-Options 沒辦法靠 meta 生效，GitHub Pages 也不讓自訂 header。 */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="object-src 'none'; base-uri 'self'; form-action 'self'"
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
              var appendDiv = function(msg) {
                var div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.top = '0';
                div.style.left = '0';
                div.style.width = '100%';
                div.style.backgroundColor = 'rgba(200, 0, 0, 0.9)';
                div.style.color = 'white';
                div.style.zIndex = '999999';
                div.style.padding = '20px';
                div.style.fontSize = '12px';
                div.style.whiteSpace = 'pre-wrap';
                div.style.overflow = 'auto';
                div.style.maxHeight = '50vh';
                div.innerText = 'ERROR: ' + msg;

                var doAppend = function() {
                  if (document.body) {
                    document.body.appendChild(div);
                  } else {
                    document.documentElement.appendChild(div);
                  }
                };

                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', doAppend);
                } else {
                  doAppend();
                }
              };

              window.onerror = function(message, source, lineno, colno, error) {
                appendDiv('Global Error: ' + message + '\\n' + source + ':' + lineno + ':' + colno + '\\n' + (error && error.stack ? error.stack : ''));
                return false;
              };

              window.addEventListener('unhandledrejection', function(event) {
                appendDiv('Unhandled Promise Rejection: ' + (event.reason && event.reason.stack ? event.reason.stack : event.reason));
              });

              var originalConsoleError = console.error;
              console.error = function() {
                var args = Array.prototype.slice.call(arguments);
                var msg = args.map(function(a) { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }).join(' ');
                if (msg.indexOf('Hydration') !== -1 || msg.indexOf('Minified React error') !== -1) {
                  appendDiv(msg);
                }
                originalConsoleError.apply(console, args);
              };
            `,
            }}
          />
        )}
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} ${notoSans.variable} font-sans antialiased bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <HomeLayoutProvider>
            <FocusModeProvider>
              <Header hostSns={hostSns} />
              <main className="min-h-screen">
                {children}
              </main>
            </FocusModeProvider>
          </HomeLayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
