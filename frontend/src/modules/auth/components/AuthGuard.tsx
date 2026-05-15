import { ParentComponent, Show } from 'solid-js';
import type { PermissionSlug } from '@app/schema/enums';
import { useAuth } from '../store/auth.store';

interface AuthGuardProps {
    permission?: PermissionSlug;
    role?: string;
}

export const AuthGuard: ParentComponent<AuthGuardProps> = (props) => {
    const auth = useAuth();
    const allowed = () => {
        if (props.role) return auth.hasRole(props.role);
        if (props.permission) return auth.hasPermission(props.permission);
        return false;
    };
    return <Show when={allowed()}>{props.children}</Show>;
};
