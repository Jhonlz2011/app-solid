// @shared/directives/clickOutside.ts
import { onCleanup } from "solid-js";

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            clickOutside: (e: MouseEvent) => void;
        }
    }
}

export function clickOutside(el: HTMLElement, accessor: () => (e: MouseEvent) => void) {
    const onClick = (e: MouseEvent) => !el.contains(e.target as Node) && accessor()?.(e);
    document.body.addEventListener("click", onClick);
    onCleanup(() => document.body.removeEventListener("click", onClick));
}