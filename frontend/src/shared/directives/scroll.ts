import { onCleanup } from "solid-js";
import SimpleBar from "simplebar";
// Importamos solo el CSS base, personalizaremos el resto con Tailwind
import "simplebar/dist/simplebar.css";

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            scrollBar: boolean;
        }
    }
}

export function scrollBar(el: HTMLElement) {
    // Inicializamos SimpleBar
    const instance = new SimpleBar(el, {
        autoHide: true,
        forceVisible: false,
        classNames: {
            contentEl: 'simplebar-content',
            contentWrapper: 'simplebar-content-wrapper',
            scrollbar: 'simplebar-scrollbar',
            track: 'simplebar-track'
        }
    });

    const scrollEl = instance.getScrollElement();

    // FIX DE ACCESIBILIDAD:
    // SimpleBar crea un wrapper que a veces roba el foco. Lo desactivamos.
    const contentWrapper = el.querySelector('.simplebar-content-wrapper');
    if (contentWrapper) {
        contentWrapper.setAttribute('tabindex', '-1');
        contentWrapper.setAttribute('role', 'presentation');
    }

    // OBSERVER REACTIVO:
    // Esto es VITAL para tu Sidebar colapsable.
    // Observamos el elemento interno para recalcular si el contenido cambia de tamaño.
    const resizeObserver = new ResizeObserver(() => instance.recalculate());

    if (scrollEl) resizeObserver.observe(scrollEl);
    resizeObserver.observe(el); // También observamos el contenedor padre

    onCleanup(() => {
        resizeObserver.disconnect();
        instance.unMount();
    });
}