import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const SupplierIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
      <path d="M20 6.9a2 2 0 0 0-1.4.6L14.8 11a2 2 0 0 0-.3-2.4 2 2 0 0 0-1.5-.7h-3q-1 0-1.4.7L3 13.9l-1-1v.1l1 1 4 4 1 1-1-1 1.6-1.4q.5-.5 1.4-.5h4q1.7 0 2.8-1.3l4.6-4.4q.7-.7.7-1.5t-.6-1.4A2 2 0 0 0 20 7m0 0h.2q.8.1 1.2.7.6.6.6 1.3t-.6 1.5l-4.6 4.4Q15.7 16 14 15.9h-4q-1 0-1.4.7L7 17.9 3 14l5.6-5.4q.5-.5 1.4-.5h3q1 0 1.5.6t.4 1.3-.3 1.2l-.2.2q-.5.5-1.4.5h-2v.1h2a2 2 0 0 0 1.6-.7l4-3.8A2 2 0 0 1 20 7" />
    </BaseIcon>
);