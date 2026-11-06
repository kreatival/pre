import { Role } from "@prisma/client";

export const Permission = {
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_PLATFORM: "VIEW_PLATFORM",
  VIEW_CLIENTS: "VIEW_CLIENTS",
  MANAGE_CLIENTS: "MANAGE_CLIENTS",
  CREATE_QUOTATIONS: "CREATE_QUOTATIONS",
  EDIT_QUOTATIONS: "EDIT_QUOTATIONS",
  DELETE_QUOTATIONS: "DELETE_QUOTATIONS",
  VIEW_MEASUREMENTS: "VIEW_MEASUREMENTS",
  MANAGE_MEASUREMENTS: "MANAGE_MEASUREMENTS",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_TENANTS: "MANAGE_TENANTS",
  MANAGE_SUBSCRIPTIONS: "MANAGE_SUBSCRIPTIONS",
  MANAGE_NOTIFICATIONS: "MANAGE_NOTIFICATIONS",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export type RoleDefinition = {
  role: Role;
  label: string;
  description: string;
  permissions: readonly Permission[];
};

export const normalizeRole = (role: Role | string | null | undefined): Role => {
  if (!role) return Role.USER;
  if (role === "ADMIN") return Role.SUPERADMIN;
  if (role === "SUPERADMIN" || role === "WORKSHOP_ADMIN" || role === "OPERATOR" || role === "USER") {
    return role as Role;
  }
  return Role.USER;
};

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  [Role.SUPERADMIN]: {
    role: Role.SUPERADMIN,
    label: "Super admin",
    description: "Owns tenant, billing, user, and platform-level administration. Cannot manage workshop operations.",
    permissions: [
      Permission.VIEW_DASHBOARD,
      Permission.VIEW_PLATFORM,
      Permission.MANAGE_USERS,
      Permission.MANAGE_TENANTS,
      Permission.MANAGE_SUBSCRIPTIONS,
      Permission.MANAGE_NOTIFICATIONS,
    ],
  },
  [Role.WORKSHOP_ADMIN]: {
    role: Role.WORKSHOP_ADMIN,
    label: "Workshop admin",
    description: "Manages clients, quotations, and measurements but cannot manage users.",
    permissions: [
      Permission.VIEW_DASHBOARD,
      Permission.VIEW_CLIENTS,
      Permission.MANAGE_CLIENTS,
      Permission.CREATE_QUOTATIONS,
      Permission.EDIT_QUOTATIONS,
      Permission.DELETE_QUOTATIONS,
      Permission.VIEW_MEASUREMENTS,
      Permission.MANAGE_MEASUREMENTS,
    ],
  },
  [Role.OPERATOR]: {
    role: Role.OPERATOR,
    label: "Operator",
    description: "Creates and updates quotations and measurements for the workshop floor.",
    permissions: [
      Permission.VIEW_DASHBOARD,
      Permission.VIEW_CLIENTS,
      Permission.CREATE_QUOTATIONS,
      Permission.EDIT_QUOTATIONS,
      Permission.VIEW_MEASUREMENTS,
      Permission.MANAGE_MEASUREMENTS,
    ],
  },
  [Role.USER]: {
    role: Role.USER,
    label: "User",
    description: "Basic access to the platform.",
    permissions: [Permission.VIEW_DASHBOARD],
  },
  [Role.ADMIN]: {
    role: Role.ADMIN,
    label: "Super admin",
    description: "Legacy alias preserved for backward compatibility.",
    permissions: [
      Permission.VIEW_DASHBOARD,
      Permission.VIEW_PLATFORM,
      Permission.MANAGE_USERS,
      Permission.MANAGE_TENANTS,
      Permission.MANAGE_SUBSCRIPTIONS,
      Permission.MANAGE_NOTIFICATIONS,
    ],
  },
};

export const ROLE_OPTIONS = (Object.keys(ROLE_DEFINITIONS) as Role[])
  .filter((role) => role !== Role.ADMIN)
  .map((role) => ROLE_DEFINITIONS[role]);

export const hasPermission = (role: Role | string | null | undefined, permission: Permission) => {
  const normalized = normalizeRole(role);
  return ROLE_DEFINITIONS[normalized]?.permissions.includes(permission) ?? false;
};

export const hasAnyRole = (role: Role | string | null | undefined, roles: Role[]) => {
  const current = normalizeRole(role);
  return roles.some((candidate) => normalizeRole(candidate) === current);
};
