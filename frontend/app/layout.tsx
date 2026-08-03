import type { Metadata } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { TeamSpaceProvider } from '@/components/team-space-provider';
import './globals.css';
import './overview-styles.css';

// Fira 字体注入（skill 推荐的 dashboard 调性）
const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DevLens · 研发棱镜',
  description: '基于 AI 的研发认知系统 - 项目 / 团队 / 人员三位一体评估',
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.ico',
  },
};

// 防止主题闪烁：在 HTML 解析阶段同步读取 localStorage，
// 若用户选过 dark 则立即给 <html> 加 .dark 类，避免刷新时闪一下白屏
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('devlens-theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${firaSans.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <TeamSpaceProvider>
          <AppShell>{children}</AppShell>
        </TeamSpaceProvider>
      </body>
    </html>
  );
}
