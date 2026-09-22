'use client';

import * as React from 'react';
import {
  Ban, CheckCircle2, Copy, Crown, KeyRound, Lock, MoreHorizontal, Pencil, ShieldCheck, ShieldHalf, Trash2, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatPhone, initials, timeAgo } from '@/lib/utils';
import {
  Avatar, AvatarFallback, Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  ErrorState, Input, Label, PageHeader, PasswordInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatusBadge, Switch, TableSkeleton, Textarea,
} from '@/components/ui';

type StaffRole = 'admin' | 'superadmin';

interface TeamMember {
  id: number;
  uuid: string;
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: 'active' | 'suspended' | 'pending' | 'banned';
  lastLoginAt?: string | null;
  loginCount?: number;
  suspendedReason?: string | null;
  createdAt: string;
}

interface TeamResponse {
  members: TeamMember[];
  canManage: boolean;
  /** Only a super administrator may change or appoint another one. */
  canManageSuperadmins?: boolean;
  currentUserId: number;
}

const STATUS = {
  active: { label: 'Active', color: 'green' },
  suspended: { label: 'Suspended', color: 'red' },
  pending: { label: 'Pending', color: 'amber' },
  banned: { label: 'Banned', color: 'slate' },
};

const ROLE_LABEL: Record<StaffRole, string> = { superadmin: 'Super administrator', admin: 'Administrator' };

const emptyNew = { fullName: '', email: '', phone: '', role: 'admin' as StaffRole, generate: true, password: '' };

export default function AdminTeamPage() {
  const [team, setTeam] = React.useState<TeamResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [adding, setAdding] = React.useState(false);
  const [newMember, setNewMember] = React.useState(emptyNew);
  const [editing, setEditing] = React.useState<TeamMember | null>(null);
  const [editForm, setEditForm] = React.useState({ fullName: '', email: '', phone: '' });
  const [suspending, setSuspending] = React.useState<TeamMember | null>(null);
  const [reason, setReason] = React.useState('');
  const [removing, setRemoving] = React.useState<TeamMember | null>(null);
  const [roleChange, setRoleChange] = React.useState<{ member: TeamMember; role: StaffRole } | null>(null);
  const [resetting, setResetting] = React.useState<TeamMember | null>(null);
  const [credentials, setCredentials] = React.useState<{ name: string; email: string; password: string } | null>(null);
  const [myPassword, setMyPassword] = React.useState({ current: '', next: '', confirm: '' });

  const load = React.useCallback(() => {
    api
      .get<TeamResponse>('/admin/team')
      .then((res) => { setTeam(res.data); setError(null); })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  React.useEffect(() => load(), [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const addMember = () =>
    run('add', async () => {
      if (newMember.fullName.trim().length < 3) throw new Error('Enter a full name');
      if (!newMember.generate && newMember.password.length < 8) throw new Error('The password must be at least 8 characters');
      const res = await api.post<{ member: TeamMember; temporaryPassword?: string }>('/admin/team', {
        fullName: newMember.fullName.trim(),
        email: newMember.email.trim(),
        phone: newMember.phone.trim(),
        role: newMember.role,
        password: newMember.generate ? undefined : newMember.password,
      });
      toast.success(res.message);
      if (res.data.temporaryPassword) {
        setCredentials({ name: res.data.member.fullName, email: res.data.member.email, password: res.data.temporaryPassword });
      }
      setAdding(false);
      setNewMember(emptyNew);
    });

  const saveEdit = () =>
    run('edit', async () => {
      if (!editing) return;
      const res = await api.patch(`/admin/team/${editing.id}`, editForm);
      toast.success(res.message);
      setEditing(null);
    });

  const applyRole = () =>
    run('role', async () => {
      if (!roleChange) return;
      const res = await api.patch(`/admin/team/${roleChange.member.id}`, { role: roleChange.role });
      toast.success(res.message);
      setRoleChange(null);
    });

  const suspend = () =>
    run('suspend', async () => {
      if (!suspending) return;
      const res = await api.patch(`/admin/team/${suspending.id}`, { status: 'suspended', suspendedReason: reason.trim() || undefined });
      toast.success(res.message, { description: 'They are signed out of the console immediately.' });
      setSuspending(null);
      setReason('');
    });

  const reactivate = (member: TeamMember) =>
    run(`reactivate-${member.id}`, async () => {
      const res = await api.patch(`/admin/team/${member.id}`, { status: 'active' });
      toast.success(res.message);
    });

  const resetPassword = () =>
    run('reset', async () => {
      if (!resetting) return;
      const res = await api.post<{ temporaryPassword?: string }>(`/admin/team/${resetting.id}/reset-password`);
      toast.success(res.message);
      if (res.data.temporaryPassword) {
        setCredentials({ name: resetting.fullName, email: resetting.email, password: res.data.temporaryPassword });
      }
      setResetting(null);
    });

  const remove = () =>
    run('remove', async () => {
      if (!removing) return;
      const res = await api.delete(`/admin/team/${removing.id}`);
      toast.success(res.message);
      setRemoving(null);
    });

  const changeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myPassword.next.length < 8) return toast.error('Use at least 8 characters');
    if (myPassword.next !== myPassword.confirm) return toast.error('The new passwords do not match');
    setBusy('mine');
    try {
      await api.patch('/auth/password', { currentPassword: myPassword.current, newPassword: myPassword.next });
      toast.success('Your password has been changed');
      setMyPassword({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`AgriMart admin console\nEmail: ${credentials.email}\nPassword: ${credentials.password}`);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — select the password and copy it manually');
    }
  };

  if (error && !team) return <ErrorState message={error} onRetry={load} />;

  const members = team?.members ?? [];
  const canManage = !!team?.canManage;
  const canManageSuperadmins = !!team?.canManageSuperadmins;
  const superCount = members.filter((m) => m.role === 'superadmin').length;
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const suspendedCount = members.filter((m) => m.status !== 'active').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin team"
        description="Everyone with access to this console. Every change here is recorded in the audit log."
        action={canManage ? <Button variant="gradient" onClick={() => setAdding(true)}><UserPlus /> Add administrator</Button> : undefined}
      />

      {team && !canManage && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          You can view the team, but not change it.
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b px-5 py-4 text-sm">
            <Badge variant="gold"><Crown /> {superCount} super administrator{superCount === 1 ? '' : 's'}</Badge>
            <Badge variant="info"><ShieldHalf /> {adminCount} administrator{adminCount === 1 ? '' : 's'}</Badge>
            {suspendedCount > 0 && <Badge variant="destructive"><Ban /> {suspendedCount} suspended</Badge>}
          </div>

          {!team ? (
            <TableSkeleton rows={4} cols={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Added</th><th className="w-10" /></tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isSelf = m.id === team.currentUserId;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={m.role === 'superadmin' ? 'bg-gradient-to-br from-gold-400 to-gold-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}>
                                {initials(m.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-medium">
                                {m.fullName} {isSelf && <Badge variant="outline" size="sm">You</Badge>}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{m.email} · {formatPhone(m.phone)}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {m.role === 'superadmin'
                            ? <Badge variant="gold" size="sm"><Crown /> Super admin</Badge>
                            : <Badge variant="info" size="sm"><ShieldHalf /> Admin</Badge>}
                        </td>
                        <td>
                          <StatusBadge status={m.status} map={STATUS} />
                          {m.status === 'suspended' && m.suspendedReason && (
                            <p className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground" title={m.suspendedReason}>{m.suspendedReason}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-sm text-muted-foreground">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'Never'}</td>
                        <td className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(m.createdAt)}</td>
                        <td>
                          {canManage && !isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${m.fullName}`}><MoreHorizontal /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuItem
                                  disabled={m.role === 'superadmin' && !canManageSuperadmins}
                                  onClick={() => { setEditing(m); setEditForm({ fullName: m.fullName, email: m.email, phone: m.phone }); }}
                                >
                                  <Pencil /> Edit details
                                </DropdownMenuItem>
                                {m.role === 'admin' ? (
                                  canManageSuperadmins ? (
                                    <DropdownMenuItem onClick={() => setRoleChange({ member: m, role: 'superadmin' })}><Crown /> Make super administrator</DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
                                      <span className="flex items-center gap-2.5"><Crown className="h-4 w-4" /> Make super administrator</span>
                                      <span className="pl-6 text-[11px] text-muted-foreground">Super administrators only</span>
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  <DropdownMenuItem disabled={!canManageSuperadmins} onClick={() => canManageSuperadmins && setRoleChange({ member: m, role: 'admin' })}><ShieldHalf /> Change to administrator</DropdownMenuItem>
                                )}
                                <DropdownMenuItem disabled={m.role === 'superadmin' && !canManageSuperadmins} onClick={() => setResetting(m)}><KeyRound /> Reset password</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {m.status === 'active' ? (
                                  <DropdownMenuItem disabled={m.role === 'superadmin' && !canManageSuperadmins} onClick={() => setSuspending(m)}><Ban /> Suspend access</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled={m.role === 'superadmin' && !canManageSuperadmins} onClick={() => reactivate(m)}><CheckCircle2 /> Reactivate</DropdownMenuItem>
                                )}
                                {m.role === 'superadmin' ? (
                                  <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
                                    <span className="flex items-center gap-2.5"><Trash2 className="h-4 w-4" /> Remove</span>
                                    <span className="pl-6 text-[11px] text-muted-foreground">
                                      {canManageSuperadmins ? 'Change to administrator first' : 'Protected — only a super administrator'}
                                    </span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem destructive onClick={() => setRemoving(m)}><Trash2 /> Remove from team</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-primary" /> Change my password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Given a temporary password? Replace it here after your first sign-in.</p>
            <form onSubmit={changeMyPassword} className="mt-4 space-y-3">
              <div className="space-y-1.5"><Label>Current password</Label><PasswordInput value={myPassword.current} onChange={(e) => setMyPassword((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" /></div>
              <div className="space-y-1.5"><Label>New password</Label><PasswordInput value={myPassword.next} onChange={(e) => setMyPassword((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" placeholder="At least 8 characters" /></div>
              <div className="space-y-1.5"><Label>Confirm new password</Label><PasswordInput value={myPassword.confirm} onChange={(e) => setMyPassword((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" /></div>
              <Button type="submit" variant="outline" className="w-full" loading={busy === 'mine'}>Update password</Button>
            </form>
          </Card>

          <Card className="space-y-4 p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> What each role can do</h2>
            <div>
              <p className="flex items-center gap-2 font-medium"><Crown className="h-4 w-4 text-gold-600" /> Super administrator</p>
              <p className="mt-1 text-muted-foreground">Everything an administrator can do, plus the accounts that are protected from everyone else: only a super administrator can appoint another one, or edit, suspend, demote or remove a super administrator.</p>
            </div>
            <div>
              <p className="flex items-center gap-2 font-medium"><ShieldHalf className="h-4 w-4 text-blue-600" /> Administrator</p>
              <p className="mt-1 text-muted-foreground">Runs the platform: users, listings, orders, prices, SMS, USSD, support and farm guides, platform settings, and the team itself — adding, editing, suspending, resetting and removing other administrators. Cannot touch a super administrator account or appoint one.</p>
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Nobody can change their own role or suspend or remove themselves, and the last active super administrator is always protected.
            </p>
          </Card>
        </div>
      </div>

      {/* Add */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an administrator</DialogTitle>
            <DialogDescription>They sign in at /admin/login with this email address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label required>Full name</Label><Input value={newMember.fullName} onChange={(e) => setNewMember((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>Email</Label><Input type="email" value={newMember.email} onChange={(e) => setNewMember((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label required>Phone</Label><Input value={newMember.phone} onChange={(e) => setNewMember((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" placeholder="0244123456" /></div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newMember.role} onValueChange={(v) => setNewMember((f) => ({ ...f, role: v as StaffRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="superadmin" disabled={!canManageSuperadmins}>
                    Super administrator{canManageSuperadmins ? '' : ' — super administrators only'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>
                <span className="block font-medium">Generate a secure password</span>
                <span className="block text-xs text-muted-foreground">Shown to you once so you can pass it on privately.</span>
              </span>
              <Switch checked={newMember.generate} onCheckedChange={(v) => setNewMember((f) => ({ ...f, generate: v }))} />
            </label>
            {!newMember.generate && (
              <div className="space-y-2"><Label required>Password</Label><PasswordInput value={newMember.password} onChange={(e) => setNewMember((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" placeholder="At least 8 characters" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy === 'add'} onClick={addMember}><UserPlus /> Add to team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.fullName}</DialogTitle>
            <DialogDescription>Changing the email changes the address they sign in with.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label required>Full name</Label><Input value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label required>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy === 'edit'} onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role change */}
      <Dialog open={!!roleChange} onOpenChange={(o) => !o && setRoleChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleChange?.role === 'superadmin' ? 'Make' : 'Change'} {roleChange?.member.fullName} {roleChange?.role === 'superadmin' ? 'a super administrator?' : 'to administrator?'}</DialogTitle>
            <DialogDescription>
              {roleChange?.role === 'superadmin'
                ? 'They will be able to manage the whole admin team, including you, and change platform settings.'
                : 'They will keep day-to-day access but lose the ability to manage administrators and settings.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChange(null)}>Cancel</Button>
            <Button variant={roleChange?.role === 'superadmin' ? 'gold' : 'gradient'} loading={busy === 'role'} onClick={applyRole}>
              {roleChange ? `Change to ${ROLE_LABEL[roleChange.role].toLowerCase()}` : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspending?.fullName}?</DialogTitle>
            <DialogDescription>They are locked out of the console on their next request. You can reactivate them at any time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label>Reason (kept in the audit log)</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspending(null)}>Cancel</Button>
            <Button variant="destructive" loading={busy === 'suspend'} onClick={suspend}><Ban /> Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the password for {resetting?.fullName}?</DialogTitle>
            <DialogDescription>Their current password stops working. A new secure password is generated and shown to you once.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy === 'reset'} onClick={resetPassword}><KeyRound /> Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove */}
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.fullName} from the team?</DialogTitle>
            <DialogDescription>
              {removing?.email} loses console access immediately. Their past actions stay in the audit log. You can add them back later with the same email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Keep</Button>
            <Button variant="destructive" loading={busy === 'remove'} onClick={remove}><Trash2 /> Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time credentials */}
      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign-in details for {credentials?.name}</DialogTitle>
            <DialogDescription>This password is shown only once. Share it privately — they should change it under Admin team after signing in.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-3 rounded-xl bg-muted/60 p-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Sign in at</dt><dd className="font-medium">/admin/login</dd></div>
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="font-mono">{credentials?.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Temporary password</dt><dd className="select-all break-all font-mono text-lg font-bold">{credentials?.password}</dd></div>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={copyCredentials}><Copy /> Copy</Button>
            <Button variant="gradient" onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
