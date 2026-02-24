import { ParentComponent, Show } from 'solid-js';
import { useAuth } from '../store/auth.store';

interface AuthGuardProps {
    permission?: string;
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
