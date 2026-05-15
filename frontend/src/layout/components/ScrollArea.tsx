import { Component, JSX } from 'solid-js';
import { scrollBar } from '@shared/directives/scroll';

// Evita que el compilador elimine la directiva
false && scrollBar;

export interface ScrollAreaProps {
  children: JSX.Element;
  class?: string;
  /** 
   * Si se provee, el scroll volverá arriba (scrollTop = 0) automáticamente 
   * cuando el valor de esta prop cambie.
   */
  resetKey?: unknown;
}

export const ScrollArea: Component<ScrollAreaProps> = (props) => {

  return (
    <div 
      use:scrollBar={props.resetKey} 
      class={`flex-1 h-full min-h-0 relative w-full ${props.class || ''}`}
    >
      {/* 
        CRITICAL FIX FOR SOLIDJS + SIMPLEBAR:
        SimpleBar mutates the DOM by adding wrapper elements. 
        If it wraps the inner elements directly, SolidJS loses reference to them
        when reconciling lists/components, causing a blank screen crash.
        By wrapping the children in this steady <div>, SimpleBar wraps this div
        instead of the individual Solid nodes, preserving the reactivity tree.
      */}
      <div class="min-h-full">
        {props.children}
      </div>
    </div>
  );
};

