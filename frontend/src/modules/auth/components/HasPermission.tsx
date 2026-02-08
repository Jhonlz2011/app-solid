import { ParentComponent, Show } from 'solid-js';
import { useAuth } from '../store/auth.store';

interface HasPermissionProps {
    permission: string;
}

export const HasPermission: ParentComponent<HasPermissionProps> = (props) => {
    const auth = useAuth();

    return (
        <Show when={auth.hasPermission(props.permission)}>
            {props.children}
        </Show>
    );
};
