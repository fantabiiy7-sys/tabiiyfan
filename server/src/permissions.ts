// Rollar va ruxsatlar matritsasi — backend har bir so'rovda shu yerdan tekshiradi.
export const ROLES = [
  { key: 'super_admin', level: 100, name: 'Super administrator' },
  { key: 'republic_editor', level: 80, name: 'Respublika metodisti / kontent muharriri' },
  { key: 'regional_moderator', level: 60, name: 'Hududiy moderator' },
  { key: 'district_moderator', level: 50, name: 'Tuman/shahar moderatori' },
  { key: 'school_admin', level: 40, name: 'Maktab administratori' },
  { key: 'teacher', level: 20, name: "O'qituvchi" },
  { key: 'student', level: 10, name: "O'quvchi" },
  { key: 'guest', level: 0, name: 'Mehmon' },
] as const;
export type RoleKey = (typeof ROLES)[number]['key'];

export const PERMISSIONS = [
  'content.read_published', 'content.read_all', 'content.create', 'content.edit', 'content.submit',
  'content.review', 'content.approve', 'content.publish', 'content.archive', 'content.delete',
  'studio.use', 'studio.publish', 'media.upload', 'media.manage',
  'users.read', 'users.manage', 'roles.manage',
  'taxonomy.manage', 'nav.manage', 'i18n.manage', 'settings.manage', 'home.manage',
  'announcements.manage', 'audit.read', 'backup.export', 'admin.access',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const P = PERMISSIONS;
const publicRead: Permission[] = ['content.read_published'];
const editor: Permission[] = [
  ...publicRead, 'admin.access', 'content.read_all', 'content.create', 'content.edit', 'content.submit',
  'content.review', 'studio.use', 'media.upload',
];
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  super_admin: [...P],
  republic_editor: [...editor, 'content.approve', 'content.publish', 'content.archive', 'studio.publish', 'media.manage',
    'taxonomy.manage', 'announcements.manage', 'home.manage'],
  regional_moderator: [...editor, 'content.approve', 'users.read'],
  district_moderator: [...editor, 'users.read'],
  school_admin: [...publicRead, 'users.read'],
  teacher: [...publicRead],
  student: [...publicRead],
  guest: [...publicRead],
};

export function can(role: RoleKey | undefined, perm: Permission): boolean {
  if (!role) return ROLE_PERMISSIONS.guest.includes(perm);
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

// Holat o'tishlari: qaysi holatdan qaysisiga va qaysi ruxsat bilan
export type Status = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
export const TRANSITIONS: { from: Status; to: Status; perm: Permission }[] = [
  { from: 'draft', to: 'in_review', perm: 'content.submit' },
  { from: 'in_review', to: 'draft', perm: 'content.review' },
  { from: 'in_review', to: 'approved', perm: 'content.approve' },
  { from: 'approved', to: 'published', perm: 'content.publish' },
  { from: 'published', to: 'archived', perm: 'content.archive' },
  { from: 'draft', to: 'archived', perm: 'content.archive' },
  { from: 'archived', to: 'draft', perm: 'content.edit' },
  { from: 'published', to: 'draft', perm: 'content.publish' },
];
export function transitionPerm(from: Status, to: Status): Permission | null {
  return TRANSITIONS.find(t => t.from === from && t.to === to)?.perm ?? null;
}
