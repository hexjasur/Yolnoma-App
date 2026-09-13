import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, User as UserIcon, RefreshCw, AlertCircle, Check, Loader2,
  Pencil, Trash2, Ban, ShieldCheck
} from 'lucide-react';
import { Button, IconButton, Modal, ConfirmModal, Pagination, SearchInput, SelectMenu } from '@/shared/ui';
import { toast } from '@/shared/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { getErrorMessage } from '@/shared/lib/errors';
import { userApi } from '../api/userApi';
import type { UserItem, UserRole, UserUpdatePayload } from '../types/user';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(15);

  // ── React Query for Users (Smooth caching, zero flashing)
  const {
    data: users = [],
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.list(),
    staleTime: 60 * 1000, // 1 minute fresh cache
  });

  // ── Editing state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editIsSpam, setEditIsSpam] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Block / Spam Confirmation Modal
  const [userToBlock, setUserToBlock] = useState<UserItem | null>(null);

  // ── Delete Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

  // ── Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdatePayload }) =>
      userApi.update(id, payload),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<UserItem[]>(['users'], (old = []) =>
        old.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
      toast.success(`User "${updatedUser.displayName || updatedUser.email || updatedUser.id}" updated.`);
      closeEditModal();
      setUserToBlock(null);
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'Failed to update user.');
      setEditError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => userApi.delete(userId),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<UserItem[]>(['users'], (old = []) =>
        old.filter((u) => u.id !== deletedId)
      );
      toast.success('User deleted successfully.');
      setUserToDelete(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to delete user.'));
    },
  });

  // ── Modal Handlers
  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setEditDisplayName(u.displayName || u.name || '');
    setEditEmail(u.email || '');
    setEditRole(u.role || 'user');
    setEditIsPrivate(Boolean(u.isPrivate));
    setEditIsSpam(Boolean(u.isSpam || u.isBlocked));
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditError(null);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    setEditError(null);

    const payload: UserUpdatePayload = {};
    const trimmedName = editDisplayName.trim();
    if (trimmedName !== (editingUser.displayName || editingUser.name || '')) {
      payload.displayName = trimmedName || null;
    }
    if (editEmail.trim() && editEmail.trim() !== (editingUser.email || '')) {
      payload.email = editEmail.trim();
    }
    if (editIsPrivate !== Boolean(editingUser.isPrivate)) {
      payload.isPrivate = editIsPrivate;
    }
    if (editIsSpam !== Boolean(editingUser.isSpam || editingUser.isBlocked)) {
      payload.isSpam = editIsSpam;
      payload.isBlocked = editIsSpam;
    }
    if (currentUser?.role === 'owner' && editRole !== editingUser.role) {
      payload.role = editRole;
    }

    if (Object.keys(payload).length === 0) {
      closeEditModal();
      return;
    }

    updateMutation.mutate({ id: editingUser.id, payload });
  };

  const handleToggleSpamBlock = () => {
    if (!userToBlock) return;
    const nextSpamState = !Boolean(userToBlock.isSpam || userToBlock.isBlocked);
    updateMutation.mutate({
      id: userToBlock.id,
      payload: { isSpam: nextSpamState, isBlocked: nextSpamState },
    });
  };

  const handleExecuteDelete = () => {
    if (!userToDelete) return;
    deleteMutation.mutate(userToDelete.id);
  };

  // ── Role & Status Badges
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/30">
            <Shield size={11} />
            Owner
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield size={11} />
            Admin
          </span>
        );
      case 'tester':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Shield size={11} />
            Tester
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
            <UserIcon size={11} />
            User
          </span>
        );
    }
  };

  const getStatusBadge = (u: UserItem) => {
    const isSpam = Boolean(u.isSpam || u.isBlocked);
    if (isSpam) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <Ban size={11} />
          Blocked / Spam
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
        <ShieldCheck size={11} />
        Active
      </span>
    );
  };

  // ── Filtered Users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const name = (u.displayName || u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const id = u.id.toLowerCase();
      const isBlocked = Boolean(u.isSpam || u.isBlocked);
      const matchesSearch = !q || name.includes(q) || email.includes(q) || role.includes(q) || id.includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'blocked' ? isBlocked : !isBlocked);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, pageLimit]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageLimit));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

  const isOwner = currentUser?.role === 'owner';

  return (
    <div className="h-full overflow-y-auto px-6 py-6" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-6 border-b border-white/[0.06]">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] mb-2 font-semibold">
              ADMINISTRATION
            </p>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-white m-0 leading-none">
              Users Management
            </h1>
            <p className="mt-2 text-white/40 text-xs">
              {isLoading ? 'Loading users...' : `Total ${users.length} registered account${users.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SearchInput
              size="md"
              placeholder="Search user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              className="w-56 md:w-64"
            />

            <SelectMenu
              value={roleFilter}
              onChange={(value) => setRoleFilter(value as UserRole | 'all')}
              ariaLabel="Filter users by role"
              options={[
                { value: 'all', label: 'All roles' },
                { value: 'owner', label: 'Owner' },
                { value: 'admin', label: 'Admin' },
                { value: 'tester', label: 'Tester' },
                { value: 'user', label: 'User' },
              ]}
            />

            <SelectMenu
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'blocked')}
              ariaLabel="Filter users by status"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'blocked', label: 'Blocked / Spam' },
              ]}
            />

            <Button
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 text-xs py-2 px-3"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Error Banner */}
        {queryError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={16} />
            {getErrorMessage(queryError, 'Failed to fetch users list.')}
          </div>
        )}

        {/* Users Table */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 w-full bg-white/5 animate-pulse rounded-xl border border-white/5" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 text-white/40 border border-dashed border-white/10 rounded-lg bg-[#14110E]">
            <Users className="mx-auto mb-3 text-white/20" size={36} />
            <p className="text-sm font-medium text-white/80 mb-1">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'No users matching your filters' : 'No users registered yet'}
            </p>
            <p className="text-xs text-white/40">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'Try clearing or changing your filters.' : 'Users will appear here once registered.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#14110E] shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/40 text-[11px] font-semibold uppercase tracking-wider bg-white/[0.02]">
                    <th className="py-3.5 px-5">User</th>
                    <th className="py-3.5 px-5">Email</th>
                    <th className="py-3.5 px-5">Role</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {paginatedUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const avatar = u.avatarUrl || u.avatar;
                    const isSpam = Boolean(u.isSpam || u.isBlocked);
                    const canEdit = isOwner || isSelf || (currentUser?.role === 'admin' && u.role !== 'owner' && u.role !== 'admin');
                    const canBlock = isOwner && !isSelf && u.role !== 'owner';
                    const canDelete = isOwner && !isSelf && u.role !== 'owner';

                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* User Identity */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              {avatar ? (
                                <img src={avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon size={16} className="text-white/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white/90 truncate">
                                  {u.displayName || u.name || 'Anonymous User'}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                    You
                                  </span>
                                )}
                                {u.isPrivate && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Private
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-white/30 truncate max-w-[180px]">
                                {u.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-5 font-mono text-xs text-white/70">
                          {u.email || '—'}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-5">
                          {getRoleBadge(u.role)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5">
                          {getStatusBadge(u)}
                        </td>

                        {/* Actions (3 Icons: Edit, Block/Spam, Delete) */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* 1. Edit Button */}
                            {canEdit && (
                              <IconButton
                                variant="accent"
                                onClick={() => openEditModal(u)}
                                title="Edit User"
                                aria-label="Edit User"
                              >
                                <Pencil size={15} />
                              </IconButton>
                            )}

                            {/* 2. Spam / Block Button */}
                            {canBlock && (
                              <IconButton
                                variant={isSpam ? 'secondary' : 'ghost'}
                                onClick={() => setUserToBlock(u)}
                                title={isSpam ? 'Unblock User' : 'Block / Mark as Spam'}
                                aria-label={isSpam ? 'Unblock User' : 'Block / Mark as Spam'}
                              >
                                <Ban size={15} />
                              </IconButton>
                            )}

                            {/* 3. Delete Button */}
                            {canDelete && (
                              <IconButton
                                variant="danger"
                                onClick={() => setUserToDelete(u)}
                                title="Delete User"
                                aria-label="Delete User"
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && filteredUsers.length > 0 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={filteredUsers.length}
            limit={pageLimit}
            onPageChange={setCurrentPage}
            onLimitChange={setPageLimit}
            limitOptions={[10, 15, 25, 50]}
            loading={isFetching}
            itemLabel="users"
          />
        )}
      </div>

      {/* ── Edit User Modal ────────────────────────────── */}
      {editingUser && (
        <Modal
          open={Boolean(editingUser)}
          onClose={closeEditModal}
          title="Edit User"
          subtitle="ADMIN MANAGEMENT"
          maxWidth="max-w-[480px]"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" onClick={closeEditModal} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveUser}
                disabled={updateMutation.isPending}
                className="gap-2 bg-[#D97757] hover:bg-[#c96a48]"
              >
                {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            {editError && (
                      <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                {editError}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Role (Editable by Owner) */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Role {isOwner ? '' : '(Owner only)'}
              </label>
              <select
                value={editRole}
                disabled={!isOwner || currentUser?.id === editingUser.id}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 rounded-md text-sm bg-white/[0.04] text-white border border-white/10 focus:border-[var(--accent)] outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="owner" className="bg-[#181410] text-white">Owner</option>
                <option value="admin" className="bg-[#181410] text-white">Admin</option>
                <option value="tester" className="bg-[#181410] text-white">Tester</option>
                <option value="user" className="bg-[#181410] text-white">User</option>
              </select>
            </div>

            {/* Private profile toggle */}
            <div className="flex items-center justify-between py-2.5 px-3.5 rounded-md bg-white/[0.02] border border-white/[0.06]">
              <div>
                <p className="text-xs font-medium text-white/80">Private Profile</p>
                <p className="text-[11px] text-white/40">Profile is hidden from public view</p>
              </div>
              <button
                type="button"
                onClick={() => setEditIsPrivate((p) => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                  editIsPrivate ? 'bg-[#D97757]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    editIsPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Spam / Blocked toggle (Owner only) */}
            {isOwner && currentUser?.id !== editingUser.id && (
              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <p className="text-xs font-medium text-white/80">Block / Mark as Spam</p>
                  <p className="text-[11px] text-white/40">Restricts user actions and flags account</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsSpam((p) => !p)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                    editIsSpam ? 'bg-red-500' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      editIsSpam ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Block / Spam Confirmation Modal ────────────────── */}
      <ConfirmModal
        open={Boolean(userToBlock)}
        onClose={() => setUserToBlock(null)}
        onConfirm={handleToggleSpamBlock}
        title={userToBlock?.isSpam || userToBlock?.isBlocked ? 'Unblock User' : 'Block / Mark as Spam'}
        description={
          <>
            Are you sure you want to {userToBlock?.isSpam || userToBlock?.isBlocked ? 'unblock' : 'block and mark as spam'}{' '}
            <strong className="text-white font-semibold">"{userToBlock?.displayName || userToBlock?.email || userToBlock?.id}"</strong>?
          </>
        }
        confirmText={userToBlock?.isSpam || userToBlock?.isBlocked ? 'Unblock User' : 'Block User'}
        cancelText="Cancel"
        variant={userToBlock?.isSpam || userToBlock?.isBlocked ? 'primary' : 'danger'}
        loading={updateMutation.isPending}
      />

      {/* ── Delete Confirmation Modal ──────────────────────── */}
      <ConfirmModal
        open={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleExecuteDelete}
        title="Delete User Account"
        description={
          <>
            Are you sure you want to permanently delete user <strong className="text-white font-semibold">"{userToDelete?.displayName || userToDelete?.email || userToDelete?.id}"</strong>? All associated account data will be removed. This action cannot be undone.
          </>
        }
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
