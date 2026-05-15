import { onCleanup, createEffect, on, Accessor } from "solid-js";
import SimpleBar from "simplebar";
import "simplebar/dist/simplebar.css";

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            scrollBar: unknown; // 'unknown' es el tipado correcto para dependencias de reactividad
        }
    }
}

export function scrollBar(el: HTMLElement, accessor: Accessor<unknown>) {
    // 1. OPTIMIZACIÓN MÓVIL:
    // Si es un dispositivo táctil, no inicializamos SimpleBar.
    // El scroll nativo es mucho más eficiente en CPU/Batería en móviles.
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouch) {
        el.style.overflowY = 'auto';
        (el.style as any).webkitOverflowScrolling = 'touch';// Inercia en iOS
        return; // Salimos, no gastamos memoria en SimpleBar
    }

    // Inicialización
    const instance = new SimpleBar(el, {
        autoHide: true,
        clickOnTrack: false, // Mejora UX evitando saltos accidentales
        classNames: {
            contentEl: 'simplebar-content',
            contentWrapper: 'simplebar-content-wrapper',
            scrollbar: 'simplebar-scrollbar',
            track: 'simplebar-track'
        }
    });

    const scrollEl = instance.getScrollElement();

    // 2. FIX ACCESIBILIDAD
    const contentWrapper = el.querySelector('.simplebar-content-wrapper');
    if (contentWrapper) {
        contentWrapper.setAttribute('tabindex', '-1');
        contentWrapper.setAttribute('role', 'region');
        contentWrapper.setAttribute('aria-label', 'Contenido desplazable');
    }

    // 3. SCROLL RESET SUAVE (Micro-task optimization & Opt-in)
    // Utilizamos `on` con `defer: true` para que SOLO se dispare 
    // cuando cambie activamente el valor (por ejemplo al cambiar de página),
    // ignorando la renderización inicial o cuando es indefinido.
    createEffect(on(accessor, (dependency) => {
        if (dependency !== undefined && scrollEl) {
            // Usamos requestAnimationFrame para asegurar que el reset ocurra
            // EN EL SIGUIENTE FRAME de pintado, cuando el contenido nuevo ya existe.
            requestAnimationFrame(() => {
                scrollEl.scrollTop = 0;
            });
        }
    }, { defer: true }));

    onCleanup(() => {
        instance.unMount();
    });
}