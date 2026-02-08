import { ParentComponent, Show } from 'solid-js';
import { useAuth } from '../store/auth.store';

interface HasRoleProps {
    role: string;
}

export const HasRole: ParentComponent<HasRoleProps> = (props) => {
    const auth = useAuth();

    return (
        <Show when={auth.hasRole(props.role)}>
            {props.children}
        </Show>
    );
};
