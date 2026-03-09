import { Component, JSX } from 'solid-js';
import { scrollBar } from '@shared/directives/scroll';
import { useLocation } from '@tanstack/solid-router';

// Evita que el compilador elimine la directiva
false && scrollBar;

export interface ScrollAreaProps {
  children: JSX.Element;
  class?: string;
}

export const ScrollArea: Component<ScrollAreaProps> = (props) => {
  const location = useLocation();

  return (
    <div 
      use:scrollBar={location().pathname} 
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
      <div class="h-max">
        {props.children}
      </div>
    </div>
  );
};

