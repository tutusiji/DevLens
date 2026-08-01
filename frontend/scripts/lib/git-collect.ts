/**
 * Git 仓库元数据采集（零依赖，child_process 调 git）
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Contributor {
  name: string;
  email: string;
  commits: number;
}
export interface ModuleOwner {
  name: string;
  commits: number;
}
export interface ModuleMeta {
  name: string;
  path: string;
  fileCount: number;
  commits: number;
  owners: ModuleOwner[];
  topOwner: string;
  topOwnerOwnership: number; // 0-100
  complexity: number; // 0-100
  codeFileCount: number;
}
export interface RecentCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
}
export interface GitMeta {
  branch: string;
  commitSha: string;
  commitShort: string;
  commitMessage: string;
  totalCommits: number;
  contributors: Contributor[];
  files: string[];
  fileCount: number;
  codeFiles: string[];
  languages: { lang: string; count: number }[];
  modules: ModuleMeta[];
  recentCommits: RecentCommit[];
}

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'java', 'kt', 'scala', 'py', 'go', 'rs', 'rb', 'php',
  'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'swift', 'dart',
  'vue', 'svelte',
]);

function git(repoPath: string, args: string): string {
  return execSync(`git -C ${JSON.stringify(repoPath)} ${args}`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
}
function safeGit(repoPath: string, args: string): string {
  try {
    return git(repoPath, args);
  } catch {
    return '';
  }
}

/** 合并同一人的多个邮箱/昵称（按名字归一） */
function mergeContributors(
  raw: { name: string; email: string; commits: number }[],
): Contributor[] {
  const map = new Map<string, Contributor>();
  for (const c of raw) {
    const norm = c.name.replace(/["“”'\s]/g, '').toLowerCase();
    if (!norm) continue;
    const existing = map.get(norm);
    if (existing) {
      existing.commits += c.commits;
      if (c.email && !existing.email.includes(c.email)) {
        existing.email = existing.email
          ? existing.email + ' / ' + c.email
          : c.email;
      }
    } else {
      map.set(norm, {
        name: c.name.replace(/["“”']/g, '').trim(),
        email: c.email,
        commits: c.commits,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.commits - a.commits);
}

function computeComplexity(codeFileCount: number): number {
  return Math.min(100, Math.round((codeFileCount / 150) * 100));
}

export function collectGitMeta(repoPath: string): GitMeta {
  const branch = safeGit(repoPath, 'branch --show-current').trim() || 'main';
  const headRaw = safeGit(repoPath, "log -1 --pretty=format:'%H|%h|%s'")
    .split('|');
  const commitSha = headRaw[0] || '';
  const commitShort = headRaw[1] || '';
  const commitMessage = headRaw.slice(2).join('|') || '';
  const totalCommits =
    parseInt(safeGit(repoPath, 'rev-list --count HEAD').trim(), 10) || 0;

  // 贡献者
  const shortlog = safeGit(repoPath, 'shortlog -sn --all')
    .trim()
    .split('\n')
    .filter(Boolean);
  const rawContributors: { name: string; email: string; commits: number }[] =
    [];
  for (const line of shortlog) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (m)
      rawContributors.push({
        name: m[2],
        email: '',
        commits: parseInt(m[1], 10),
      });
  }
  const logEmails = safeGit(repoPath, "log --all --pretty=format:'%an|%ae'")
    .split('\n');
  const emailMap = new Map<string, string>();
  for (const line of logEmails) {
    const [name, email] = line.split('|');
    if (name && email && !emailMap.has(name.trim()))
      emailMap.set(name.trim(), email.trim());
  }
  rawContributors.forEach((c) => {
    c.email = emailMap.get(c.name) || c.email;
  });
  const contributors = mergeContributors(rawContributors);

  // 文件
  const files = safeGit(repoPath, 'ls-files').split('\n').filter(Boolean);
  const codeFiles = files.filter((f) => {
    const ext = f.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
    return ext && CODE_EXT.has(ext);
  });

  // 语言
  const langMap = new Map<string, number>();
  for (const f of files) {
    const ext = f.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
    if (ext) langMap.set(ext, (langMap.get(ext) || 0) + 1);
  }
  const languages = [...langMap.entries()]
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count);

  // 模块（顶层目录）
  const topDirSet = new Set(
    files
      .filter((f) => f.includes('/'))
      .map((f) => f.split('/')[0])
      .filter((d) => d && !d.startsWith('.')),
  );
  const modules: ModuleMeta[] = [];
  for (const dir of topDirSet) {
    const dirFiles = files.filter((f) => f.startsWith(dir + '/'));
    const codeCount = dirFiles.filter((f) => {
      const ext = f.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
      return ext && CODE_EXT.has(ext);
    }).length;
    if (codeCount === 0 && dirFiles.length < 5) continue;
    const modCommits =
      safeGit(repoPath, `log --oneline -- ./${dir}`)
        .split('\n')
        .filter(Boolean).length || 0;
    const ownerRaw = safeGit(repoPath, `log --pretty=format:'%an' -- ./${dir}`)
      .split('\n')
      .filter(Boolean);
    const ownerMap = new Map<string, number>();
    const ownerOrigMap = new Map<string, string>();
    for (const name of ownerRaw) {
      const norm = name.replace(/["“”'\s]/g, '').toLowerCase();
      ownerMap.set(norm, (ownerMap.get(norm) || 0) + 1);
      if (!ownerOrigMap.has(norm))
        ownerOrigMap.set(norm, name.replace(/["“”']/g, '').trim());
    }
    const owners = [...ownerMap.entries()]
      .map(([k, v]) => ({ name: ownerOrigMap.get(k) || k, commits: v }))
      .sort((a, b) => b.commits - a.commits);
    const totalOwnerCommits =
      owners.reduce((s, o) => s + o.commits, 0) || 1;
    const topOwner = owners[0];
    modules.push({
      name: dir,
      path: dir,
      fileCount: dirFiles.length,
      commits: modCommits,
      owners: owners.slice(0, 5),
      topOwner: topOwner?.name || '',
      topOwnerOwnership: topOwner
        ? Math.round((topOwner.commits / totalOwnerCommits) * 100)
        : 0,
      complexity: computeComplexity(codeCount),
      codeFileCount: codeCount,
    });
  }
  modules.sort((a, b) => b.commits - a.commits);

  // recent commits
  const recentRaw = safeGit(
    repoPath,
    "log -10 --pretty=format:'%h|%an|%aI|%s'",
  )
    .split('\n')
    .filter(Boolean);
  const recentCommits: RecentCommit[] = recentRaw.map((line) => {
    const [sha, author, date, ...msg] = line.split('|');
    return {
      sha,
      author: author?.replace(/["“”']/g, '').trim() || '',
      date: date || '',
      message: msg.join('|'),
    };
  });

  return {
    branch,
    commitSha,
    commitShort,
    commitMessage,
    totalCommits,
    contributors,
    files,
    fileCount: files.length,
    codeFiles,
    languages,
    modules,
    recentCommits,
  };
}

/** 抽样核心文件代码（按模块取 top N，控制总 token） */
export function sampleCoreFiles(
  repoPath: string,
  meta: GitMeta,
  maxFiles = 12,
  maxFileBytes = 6000,
): { path: string; content: string }[] {
  const samples: { path: string; content: string }[] = [];
  const topModules = meta.modules
    .filter((m) => m.codeFileCount > 0)
    .slice(0, 5);
  const seen = new Set<string>();
  outer: for (const mod of topModules) {
    const modCodeFiles = meta.codeFiles
      .filter((f) => f.startsWith(mod.name + '/'))
      .sort((a, b) => {
        const score = (f: string) =>
          /core|main|src|service|util|api|config/i.test(f) ? -1 : 0;
        return score(a) - score(b) || a.length - b.length;
      });
    for (const f of modCodeFiles.slice(0, 3)) {
      if (seen.has(f)) continue;
      seen.add(f);
      try {
        const full = join(repoPath, f);
        const stat = statSync(full);
        if (stat.size > 100_000) continue;
        let content = readFileSync(full, 'utf8');
        if (content.length > maxFileBytes)
          content =
            content.slice(0, maxFileBytes) + '\n/* ... truncated */';
        samples.push({ path: f, content });
        if (samples.length >= maxFiles) break outer;
      } catch {
        // 跳过读不了的文件
      }
    }
  }
  return samples;
}
