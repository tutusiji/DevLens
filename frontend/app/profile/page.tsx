/**
 * 个人中心：综合能力评估 + 职级 + 参与项目 + 所在团队
 * 操作类（改头像/改昵称/改密码）均为弹窗，页面本身聚焦展示。
 */
'use client';

import * as React from 'react';
import {
  fetchMyProfile, updateProfileAPI, uploadAvatarAPI, changePasswordAPI,
  resolveAvatarUrl, makeDicebearAvatarUrl,
  type MyProfileResponse,
} from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import {
  User, Mail, KeyRound, Upload, Shuffle, Check,
  Code2, Award, Users, FolderGit2, BarChart3, ArrowUpRight,
  Briefcase, Calendar, Zap,
} from 'lucide-react';
import { CapabilityRadar } from '@/components/charts';
import Link from 'next/link';

const INPUT_CLS =
  'h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70';

/** 通知应用外壳（侧边栏）刷新当前用户，使头像/昵称即时同步。 */
function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devlens:auth-changed'));
  }
}

const DIMENSION_LABELS: Record<string, string> = {
  code_quality: '代码质量',
  architecture: '架构能力',
  stability: '稳定性',
  efficiency: '效率产出',
  collaboration: '协作沟通',
  security_aware: '安全意识',
  test_coverage: '测试覆盖',
};

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<MyProfileResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  // 弹窗状态
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  // 头像弹窗
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 昵称编辑弹窗
  const [nickname, setNickname] = React.useState('');
  const [nicknameSaving, setNicknameSaving] = React.useState(false);
  const [nicknameSaved, setNicknameSaved] = React.useState(false);

  // 改密码弹窗
  const [oldPwd, setOldPwd] = React.useState('');
  const [newPwd, setNewPwd] = React.useState('');
  const [confirmPwd, setConfirmPwd] = React.useState('');
  const [pwdMsg, setPwdMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = React.useState(false);

  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  function loadProfile() {
    setLoading(true);
    fetchMyProfile()
      .then((data) => {
        setProfile(data);
        setNickname(data.user.name);
      })
      .catch(() => { /* app-shell 登录守卫会处理 401 */ })
      .finally(() => setLoading(false));
  }

  React.useEffect(() => { loadProfile(); }, []);

  const dev = profile?.developer || null;
  const eval_ = profile?.latestEvaluation || null;
  const user = profile?.user;

  // —— 头像：DiceBear 随机切换 ——
  async function handleShuffleAvatar() {
    if (!user?.username || avatarBusy) return;
    setAvatarBusy(true);
    setMsg(null);
    try {
      const next = makeDicebearAvatarUrl(user.username);
      const u = await updateProfileAPI({ avatarUrl: next });
      if (profile) setProfile({ ...profile, user: u });
      notifyAuthChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '切换头像失败' });
    } finally {
      setAvatarBusy(false);
    }
  }

  // —— 头像：上传文件 ——
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    setMsg(null);
    try {
      const u = await uploadAvatarAPI(file);
      if (profile) setProfile({ ...profile, user: u });
      notifyAuthChanged();
      setAvatarOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : '上传头像失败' });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // —— 昵称保存 ——
  async function handleSaveNickname() {
    setNicknameSaving(true);
    setMsg(null);
    try {
      const u = await updateProfileAPI({ name: nickname.trim() });
      if (profile) setProfile({ ...profile, user: u });
      setNicknameSaved(true);
      notifyAuthChanged();
      setTimeout(() => { setNicknameSaved(false); setProfileOpen(false); }, 1200);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setNicknameSaving(false);
    }
  }

  // —— 修改密码 ——
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd.length < 8 || !/[A-Za-z]/.test(newPwd) || !/[0-9]/.test(newPwd) || !/[^A-Za-z0-9\s]/.test(newPwd)) {
      setPwdMsg({ ok: false, text: '新密码至少 8 位，且需同时包含字母、数字和符号' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: '两次输入的新密码不一致' });
      return;
    }
    setPwdSaving(true);
    try {
      await changePasswordAPI(oldPwd, newPwd);
      setPwdMsg({ ok: true, text: '密码已更新' });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setPasswordOpen(false), 1500);
    } catch (err) {
      setPwdMsg({ ok: false, text: err instanceof Error ? err.message : '修改密码失败' });
    } finally {
      setPwdSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 skeleton rounded-2xl" />
        <div className="h-56 skeleton rounded-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 skeleton rounded-3xl" />
          <div className="h-64 skeleton rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部：个人信息卡 */}
      <Card className="overflow-hidden">
        <div className="relative h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/15" />
        <CardContent className="relative -mt-12 pb-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            {/* 头像 */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveAvatarUrl(user)}
                alt="头像"
                className="h-24 w-24 rounded-2xl border-4 border-card object-cover bg-muted/20 shadow-lg"
              />
            </div>

            {/* 基本信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{user?.name || '未命名'}</h1>
                {dev?.level && (
                  <Badge variant="secondary" className="font-mono">{dev.level}</Badge>
                )}
                {dev?.roleLabel && (
                  <Badge variant="outline">{dev.roleLabel}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  @{user?.username || '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user?.email}
                </span>
                {dev?.overall != null && (
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    综合评分 <span className="font-mono font-semibold text-foreground">{dev.overall}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAvatarOpen(true)}>
                <Upload className="h-4 w-4" /> 更换头像
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setNickname(user?.name || ''); setProfileOpen(true); }}>
                <User className="h-4 w-4" /> 编辑资料
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setPwdMsg(null); setPasswordOpen(true); }}>
                <KeyRound className="h-4 w-4" /> 修改密码
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 能力评估概览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" /> 能力评估
              </CardTitle>
              <CardDescription>基于真实代码贡献的实测能力画像</CardDescription>
            </div>
            {eval_ && (
              <Link href={`/developers/${dev?.id}`} className="text-xs text-primary hover:underline">
                查看详情 <ArrowUpRight className="inline h-3 w-3" />
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {eval_ && dev ? (
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
              {/* 左侧：职级概览 */}
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-5">
                  <div className="text-xs text-muted-foreground">当前达标职级</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-primary">
                      {eval_.achievedLevel || '—'}
                    </span>
                    {eval_.bestLevel && eval_.bestLevel !== eval_.achievedLevel && (
                      <span className="text-xs text-muted-foreground">
                        参考 {eval_.bestLevel}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    角色：{eval_.roleLabel}
                  </div>
                </div>

                {eval_.summary && (
                  <div className="rounded-2xl bg-muted/10 p-4">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">评估摘要</div>
                    <p className="text-sm leading-relaxed">{eval_.summary}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-muted/10 p-3">
                    <div className="font-mono text-xl font-semibold">{dev.commits}</div>
                    <div className="text-[10px] text-muted-foreground">提交数</div>
                  </div>
                  <div className="rounded-xl bg-muted/10 p-3">
                    <div className="font-mono text-xl font-semibold">{dev.reviews}</div>
                    <div className="text-[10px] text-muted-foreground">评审数</div>
                  </div>
                  <div className="rounded-xl bg-muted/10 p-3">
                    <div className="font-mono text-xl font-semibold">{dev.langs?.length || 0}</div>
                    <div className="text-[10px] text-muted-foreground">语言</div>
                  </div>
                </div>

                {eval_.gaps?.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">主要差距</div>
                    <div className="space-y-2">
                      {eval_.gaps.slice(0, 3).map((g) => (
                        <div key={g.dimension} className="flex items-center gap-3">
                          <div className="w-20 text-xs text-muted-foreground">
                            {DIMENSION_LABELS[g.dimension] || g.dimension}
                          </div>
                          <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${Math.min(100, (g.current / Math.max(g.target, 1)) * 100)}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-xs font-mono">
                            {g.current}/{g.target}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：雷达图 */}
              <div className="flex items-center justify-center">
                <div className="w-full max-w-sm">
                  <CapabilityRadar
                    series={[{
                      name: '能力评分',
                      data: eval_.scores || {},
                      color: 'hsl(var(--primary))',
                    }]}
                    height={280}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title="暂无能力评估"
              description="接入仓库并完成开发者评估后，将展示你的能力画像与职级评定"
            />
          )}
        </CardContent>
      </Card>

      {/* 参与项目 & 所在团队 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 参与项目 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-primary" /> 参与项目
            </CardTitle>
            <CardDescription>
              {profile?.projects?.length || 0} 个项目
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile?.projects?.length ? (
              <div className="space-y-2">
                {profile.projects.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/15"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Code2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.language || '—'} · {p.commits} 次提交
                      </div>
                    </div>
                    {p.score != null && (
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">{p.score}</div>
                        <div className="text-[10px] text-muted-foreground">健康度</div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderGit2}
                title="暂无参与项目"
                description="接入仓库并完成分析后，将展示你参与的项目"
              />
            )}
          </CardContent>
        </Card>

        {/* 所在团队 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> 所在团队
            </CardTitle>
            <CardDescription>
              {profile?.teams?.length || 0} 个团队
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile?.teams?.length ? (
              <div className="space-y-2">
                {profile.teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/15"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
                      <Briefcase className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.members} 名成员
                      </div>
                    </div>
                    {t.avgScore != null && (
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">{t.avgScore}</div>
                        <div className="text-[10px] text-muted-foreground">均分</div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="暂无团队归属"
                description="在团队管理中添加团队并关联成员后展示"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 全局消息提示（弹窗内也复用） */}
      {msg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border px-5 py-3 text-sm shadow-xl backdrop-blur ${msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          {msg.text}
        </div>
      )}

      {/* ========= 更换头像弹窗 ========= */}
      <Modal isOpen={avatarOpen} onClose={() => setAvatarOpen(false)} size="sm">
        <ModalHeader>
          <h3 className="text-lg font-semibold">更换头像</h3>
          <p className="mt-1 text-sm text-muted-foreground">上传图片或随机切换 DiceBear 头像</p>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveAvatarUrl(user)}
                alt="当前头像"
                className={`h-28 w-28 rounded-2xl border-2 border-border/60 object-cover bg-muted/20 ${avatarBusy ? 'opacity-60' : ''}`}
              />
              <button
                type="button"
                onClick={handleShuffleAvatar}
                disabled={avatarBusy || !user?.username}
                title="随机切换头像"
                className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-primary shadow-md transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>

            <div className="w-full space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
              >
                <Upload className="h-4 w-4" />
                上传本地图片
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleUpload}
                className="hidden"
              />
              <p className="text-center text-[11px] text-muted-foreground/70">
                PNG / JPG / WebP / GIF，≤ 2MB
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAvatarOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      {/* ========= 编辑资料弹窗 ========= */}
      <Modal isOpen={profileOpen} onClose={() => setProfileOpen(false)} size="sm">
        <ModalHeader>
          <h3 className="text-lg font-semibold">编辑资料</h3>
          <p className="mt-1 text-sm text-muted-foreground">修改你的展示昵称</p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="p-name" className="text-sm font-medium text-muted-foreground">昵称</label>
              <input
                id="p-name"
                type="text"
                maxLength={32}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={INPUT_CLS}
              />
              <p className="text-[11px] text-muted-foreground/70">最多 32 个字符</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">用户名</label>
              <input type="text" value={user?.username || ''} readOnly className={`${INPUT_CLS} opacity-70`} />
              <p className="text-[11px] text-muted-foreground/70">注册后不可修改</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">邮箱</label>
              <input type="text" value={user?.email || ''} readOnly className={`${INPUT_CLS} opacity-70`} />
              <p className="text-[11px] text-muted-foreground/70">用于登录</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setProfileOpen(false)}>取消</Button>
          <Button
            onClick={handleSaveNickname}
            disabled={nicknameSaving || nickname.trim() === user?.name}
          >
            {nicknameSaved ? <><Check className="h-4 w-4" /> 已保存</> : '保存'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ========= 修改密码弹窗 ========= */}
      <Modal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} size="sm">
        <ModalHeader>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> 修改密码
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            新密码至少 8 位，需同时包含字母、数字和符号
          </p>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="p-old" className="text-sm font-medium text-muted-foreground">当前密码</label>
              <PasswordInput id="p-old" value={oldPwd} onChange={setOldPwd} autoComplete="current-password" required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="p-new" className="text-sm font-medium text-muted-foreground">新密码</label>
              <PasswordInput id="p-new" value={newPwd} onChange={setNewPwd} autoComplete="new-password" placeholder="字母+数字+符号，至少 8 位" required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="p-confirm" className="text-sm font-medium text-muted-foreground">确认新密码</label>
              <PasswordInput id="p-confirm" value={confirmPwd} onChange={setConfirmPwd} autoComplete="new-password" required />
            </div>
            {pwdMsg && (
              <div className={`rounded-xl border px-4 py-2.5 text-sm ${pwdMsg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                {pwdMsg.text}
              </div>
            )}
            <Button type="submit" className="w-full"
              disabled={pwdSaving || !oldPwd || !newPwd || !confirmPwd}>
              {pwdSaving ? '更新中…' : '确认修改'}
            </Button>
          </form>
        </ModalBody>
      </Modal>
    </div>
  );
}
