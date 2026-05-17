'use client';

import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { ThemeProvider } from 'next-themes';

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <WorkspaceShell />
    </ThemeProvider>
  );
}
