// ─── Audit Display Utilities ─────────────────────────────────────────────────
// Shared constants and helpers for rendering audit log entries.
// Extracted for cross-module reuse (Users, Suppliers, Products, etc.)

export const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
    INSERT: { label: 'Creado', color: 'bg-emerald-500/15 text-emerald-600' },
    UPDATE: { label: 'Editado', color: 'bg-blue-500/15 text-blue-600' },
    DELETE: { label: 'Eliminado', color: 'bg-red-500/15 text-red-600' },
    LOGIN: { label: 'Inicio de sesión', color: 'bg-violet-500/15 text-violet-600' },
    EXPORT: { label: 'Exportado', color: 'bg-amber-500/15 text-amber-600' },
};

export const TABLE_NAME_LABELS: Record<string, string> = {
    entities: 'Entidad',
    auth_users: 'Usuario',
    auth_roles: 'Rol',
    auth_user_roles: 'Roles de usuario',
    auth_role_permissions: 'Permisos de rol',
    products: 'Producto',
    invoices: 'Factura',
    work_orders: 'Orden de trabajo',
};

export const FIELD_LABELS: Record<string, string> = {
    username: 'Usuario', email: 'Correo', is_active: 'Estado',
    password_hash: 'Contraseña', entity_id: 'Entidad',
    roleIds: 'Roles', permissionIds: 'Permisos', name: 'Nombre',
    description: 'Descripción', isActive: 'Estado',
};

export const REDACTED_FIELDS = new Set(['password_hash']);

/** Format a diff value for display */
export const formatDiffValue = (key: string, value: unknown): string => {
    if (REDACTED_FIELDS.has(key)) return '●●●●●●';
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(vacío)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/** Compute changed fields between old and new data */
export const computeDiff = (oldData?: Record<string, unknown> | null, newData?: Record<string, unknown> | null) => {
    const changes: { key: string; label: string; oldVal: string; newVal: string }[] = [];
    const allKeys = new Set([
        ...Object.keys(oldData ?? {}),
        ...Object.keys(newData ?? {}),
    ]);

    for (const key of allKeys) {
        const oldVal = oldData?.[key];
        const newVal = newData?.[key];
        // Skip if values are the same (deep compare for arrays)
        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
        changes.push({
            key,
            label: FIELD_LABELS[key] ?? key,
            oldVal: formatDiffValue(key, oldVal),
            newVal: formatDiffValue(key, newVal),
        });
    }
    return changes;
};
