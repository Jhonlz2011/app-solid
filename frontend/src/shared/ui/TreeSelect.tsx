import {
  Show,
  For,
  createMemo,
  createSignal,
  createEffect,
  createUniqueId,
  JSX,
  useContext,
  onCleanup,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { XIcon, ChevronRightIcon } from "./icons";
import type { FieldLike } from "./form/form.types";
import {
  hasFieldError,
  getFieldError,
  FormSubmissionContext,
} from "./form/form.types";
import { cn } from "@shared/lib/utils";

export interface TreeSelectProps<T> {
  value: number | null | undefined;
  onChange: (id: number | null, item: T | null) => void;
  options: T[];
  optionValue: (item: T) => number;
  optionLabel: (item: T) => string;
  optionParentId: (item: T) => number | null;
  optionIsActive?: (item: T) => boolean;

  label?: string;
  placeholder?: string;
  disabled?: boolean;
  field?: FieldLike<any>;
  editingId?: number;
  inputPrefix?: JSX.Element;
  itemRenderer?: (
    item: T,
    meta: {
      depth: number;
      hasChildren: boolean;
      expanded: boolean;
      query: string;
      highlighted: boolean;
      selected: boolean;
    },
  ) => JSX.Element;
}

export function TreeSelect<T>(props: TreeSelectProps<T>) {
  const id = createUniqueId();
  const isFormSubmitted = useContext(FormSubmissionContext);

  const [inputValue, setInputValue] = createSignal("");
  const [isSearching, setIsSearching] = createSignal(false);
  const [scrollContainer, setScrollContainer] =
    createSignal<HTMLDivElement | null>(null);

  const [expandedIds, setExpandedIds] = createSignal<Set<number>>(new Set());
  const [isSelectedState, setIsSelectedState] = createSignal(!!props.value);
  const [isFocused, setIsFocused] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const [coords, setCoords] = createSignal({ top: 0, left: 0, width: 0 });
  const [lastKeyboardNavTime, setLastKeyboardNavTime] = createSignal(0);

  let triggerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let _lastSelectionTime = 0;

  // Monitor input resizing for the dropdown portal width & positioning coordinates
  const updateCoords = () => {
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4, // elegant 4px gap
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  createEffect(() => {
    if (isOpen()) {
      updateCoords();

      // Observe resizes of trigger container dynamically
      if (triggerRef) {
        const resizeObserver = new ResizeObserver(updateCoords);
        resizeObserver.observe(triggerRef);
        onCleanup(() => resizeObserver.disconnect());
      }

      // Window-level events to keep layout perfectly aligned
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
      onCleanup(() => {
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
      });
    }
  });

  // Handle click outside to close dropdown
  createEffect(() => {
    if (isOpen()) {
      const handleDocClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (triggerRef && triggerRef.contains(target)) return;
        if (dropdownRef && dropdownRef.contains(target)) return;
        setIsOpen(false);
      };
      document.addEventListener("click", handleDocClick, true);
      onCleanup(() => {
        document.removeEventListener("click", handleDocClick, true);
      });
    }
  });

  // Form validation state
  const validationState = createMemo(() => {
    if (props.field && hasFieldError(props.field, isFormSubmitted()))
      return "invalid";
    return "valid";
  });

  const errorMessage = createMemo(() => {
    if (props.field) return getFieldError(props.field);
    return "";
  });

  // Map list of options for lookup
  const optionsMap = createMemo(() => {
    const map = new Map<number, T>();
    for (const item of props.options || []) {
      map.set(props.optionValue(item), item);
    }
    return map;
  });

  // Build the hierarchical tree structure exclusively for active options
  const treeStructure = createMemo(() => {
    const list = (props.options || []).filter((item) => {
      const isActive = props.optionIsActive ? props.optionIsActive(item) : true;
      const isNotSelf =
        !props.editingId || props.optionValue(item) !== props.editingId;
      return isActive && isNotSelf;
    });

    const filteredMap = new Map<number, T>();
    for (const item of list) {
      filteredMap.set(props.optionValue(item), item);
    }

    const childrenMap = new Map<number | null, T[]>();
    const roots: T[] = [];

    for (const item of list) {
      const pid = props.optionParentId(item);
      const hasParentInFiltered = pid !== null && filteredMap.has(pid);
      if (!hasParentInFiltered) {
        roots.push(item);
      } else {
        if (!childrenMap.has(pid)) {
          childrenMap.set(pid, []);
        }
        childrenMap.get(pid)!.push(item);
      }
    }

    // Sort alphabetically
    roots.sort((a, b) =>
      props.optionLabel(a).localeCompare(props.optionLabel(b)),
    );
    for (const children of Array.from(childrenMap.values())) {
      children.sort((a, b) =>
        props.optionLabel(a).localeCompare(props.optionLabel(b)),
      );
    }

    return { roots, childrenMap };
  });

  // Determine relative depths + ancestor "isLastChild" chain for proper L-connector rendering.
  // ancestorIsLast[i] tells whether to suppress the continuing vertical line at guide column i:
  //   - For i < depth-1: true = ancestor at that level IS last child → no continuing line
  //   - For i = depth-1: true = THIS node IS last child → draw L-connector (half vertical)
  interface NodeMeta {
    depth: number;
    ancestorIsLast: boolean[]; // length === depth, one entry per guide column
  }

  const nodeMetaMap = createMemo(() => {
    const map = new Map<number, NodeMeta>();
    const structure = treeStructure();
    if (!structure) return map;
    const { roots, childrenMap } = structure;

    const traverse = (
      parentId: number | null,
      depth: number,
      parentChain: boolean[],
    ) => {
      const children =
        parentId === null ? roots : (childrenMap.get(parentId) ?? []);
      for (let idx = 0; idx < children.length; idx++) {
        const child = children[idx];
        const childId = props.optionValue(child);
        const isLast = idx === children.length - 1;
        const fullChain = [...parentChain, isLast];
        // Store only entries relevant for guide columns (skip root-level entry)
        // Result: root nodes (depth 0) get [], depth 1 gets 1 entry, etc.
        map.set(childId, { depth, ancestorIsLast: fullChain.slice(1) });
        traverse(childId, depth + 1, fullChain);
      }
    };

    traverse(null, 0, []);
    return map;
  });

  // Helpers to check tree nodes status
  const hasChildren = (nodeId: number) => {
    const kids = treeStructure().childrenMap.get(nodeId);
    return kids !== undefined && kids.length > 0;
  };

  const isExpanded = (nodeId: number) => {
    return expandedIds().has(nodeId);
  };

  const toggleExpand = (nodeId: number) => {
    const next = new Set(expandedIds());
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedIds(next);
    inputRef?.focus();
  };

  // Auto-expand parents of the selected node on load, keeping everything else collapsed
  createEffect(() => {
    const list = props.options || [];
    if (list.length > 0 && untrack(expandedIds).size === 0) {
      const v = props.value;
      const parentIds = new Set<number>();
      if (v) {
        const makeAncestorsVisible = (nodeId: number) => {
          const item = optionsMap().get(nodeId);
          if (item) {
            const pid = props.optionParentId(item);
            if (pid !== null && pid !== undefined) {
              parentIds.add(pid);
              makeAncestorsVisible(pid);
            }
          }
        };
        makeAncestorsVisible(v);
      }
      setExpandedIds(parentIds);
    }
  });

  // Build breadcrumb path for display
  const getBreadcrumb = (nodeId: number): string => {
    const parts: string[] = [];
    let current = optionsMap().get(nodeId);
    if (current) {
      const pid = props.optionParentId(current);
      if (pid) {
        current = optionsMap().get(pid);
      } else {
        return "";
      }
    } else {
      return "";
    }
    while (current) {
      parts.unshift(props.optionLabel(current));
      const pid = props.optionParentId(current);
      current = pid ? optionsMap().get(pid) : undefined;
    }
    return parts.join(" › ");
  };

  // Construct text representation of selection
  const getDisplayText = (nodeId: number | undefined | null): string => {
    if (!nodeId) return "";
    const item = optionsMap().get(nodeId);
    if (!item) return "";
    const breadcrumb = getBreadcrumb(nodeId);
    const label = props.optionLabel(item);
    return breadcrumb ? `${label} (${breadcrumb})` : label;
  };

  // Identify nodes that directly match the query (including custom fields)
  const matchingNodeIds = createMemo(() => {
    const s = inputValue().toLowerCase().trim();
    if (!s || !isSearching()) return new Set<number>();

    const set = new Set<number>();
    for (const item of props.options || []) {
      const id = props.optionValue(item);
      const label = props.optionLabel(item).toLowerCase();

      let matchesCustom = label.includes(s);
      if (!matchesCustom && item && typeof item === "object") {
        for (const key in item) {
          if (
            key === "path" ||
            key === "id" ||
            key.toLowerCase().endsWith("id") ||
            key.toLowerCase().endsWith("path") ||
            key === "depth" ||
            key === "is_active" ||
            key === "type" ||
            key === "product_count" ||
            key === "created_at" ||
            key === "updated_at" ||
            key === "deleted_at"
          ) {
            continue;
          }
          const val = (item as any)[key];
          if (typeof val === "string" && val.toLowerCase().includes(s)) {
            matchesCustom = true;
            break;
          }
        }
      }

      if (matchesCustom) {
        set.add(id);
      }
    }
    return set;
  });

  // Identify ancestors of matching nodes to auto-expand during search
  const ancestorsOfMatches = createMemo(() => {
    if (!isSearching() || !inputValue().trim()) return new Set<number>();
    const matches = matchingNodeIds();
    const ancestors = new Set<number>();

    const collectAncestors = (nodeId: number) => {
      if (ancestors.has(nodeId)) return;
      ancestors.add(nodeId);
      const item = optionsMap().get(nodeId);
      if (item) {
        const pid = props.optionParentId(item);
        if (pid !== null && pid !== undefined) {
          collectAncestors(pid);
        }
      }
    };

    for (const matchId of Array.from(matches)) {
      const item = optionsMap().get(matchId);
      if (item) {
        const pid = props.optionParentId(item);
        if (pid !== null && pid !== undefined) {
          collectAncestors(pid);
        }
      }
    }

    return ancestors;
  });

  // Keep matching nodes and all of their ancestors visible
  const visibleNodeIdsInSearch = createMemo(() => {
    if (!isSearching() || !inputValue().trim()) return null;
    const matches = matchingNodeIds();
    const ancestors = ancestorsOfMatches();

    const visible = new Set<number>();
    for (const matchId of Array.from(matches)) {
      visible.add(matchId);
    }
    for (const ancId of Array.from(ancestors)) {
      visible.add(ancId);
    }

    return visible;
  });

  // Traverses tree to collect visible tree items based on collapsible expanded state and hierarchical filter
  const visibleTreeOptions = createMemo(() => {
    const structure = treeStructure();
    const result: T[] = [];
    if (!structure) return result;
    const { roots, childrenMap } = structure;
    const searchVisible = visibleNodeIdsInSearch();
    const ancestors = ancestorsOfMatches();
    const isSearchActive = searchVisible !== null;

    const traverse = (parentId: number | null) => {
      const children =
        parentId === null ? roots : (childrenMap.get(parentId) ?? []);
      for (const child of children) {
        const childId = props.optionValue(child);

        // Visibility: during search, only show nodes in searchVisible set (matches + ancestors)
        // Without search, all nodes at traversed levels are visible
        const isNodeVisible =
          !isSearchActive || searchVisible.has(childId);

        if (isNodeVisible) {
          result.push(child);
        }

        // Expansion: during search, expand only ancestors of matches
        // Without search, expand only manually expanded nodes
        const shouldExpand = isSearchActive
          ? ancestors.has(childId)
          : isExpanded(childId);

        if (shouldExpand && hasChildren(childId)) {
          traverse(childId);
        }
      }
    };

    traverse(null);
    return result;
  });

  // Filtered by search input — Unified tree traverser
  const filteredOptions = createMemo(() => {
    return visibleTreeOptions() || [];
  });

  // Synchronize local input state with current external props.value
  createEffect(() => {
    const v = props.value;
    if (v && (props.options || []).length > 0) {
      const text = getDisplayText(v);
      if (text) {
        setInputValue(text);
        setIsSearching(false);
      }
    } else if (!v) {
      setInputValue("");
      setIsSearching(false);
    }
  });

  createEffect(() => {
    if (!isFocused()) {
      setIsSelectedState(!!props.value);
    }
  });

  // -------------------------------------------------------------
  // Virtualization setup
  // -------------------------------------------------------------
  const rowVirtualizer = createVirtualizer({
    get count() {
      return (filteredOptions() || []).length;
    },
    getScrollElement: () => scrollContainer()!,
    estimateSize: (index) => {
      const opt = filteredOptions()[index];
      if (!opt) return 40;
      const optId = props.optionValue(opt);
      const hasBreadcrumb = getBreadcrumb(optId) !== "";
      const hasWarehouse = (opt as any).warehouse_name !== undefined;
      return hasBreadcrumb || hasWarehouse ? 50 : 40;
    },
    overscan: 8,
  });

  // Auto-highlight active option or top option upon opening dropdown
  createEffect(() => {
    if (isOpen()) {
      untrack(() => {
        const v = props.value;
        const list = filteredOptions();
        if (v && list.length > 0) {
          const idx = list.findIndex((opt) => props.optionValue(opt) === v);
          if (idx !== -1) {
            setHighlightedIndex(idx);
            setLastKeyboardNavTime(Date.now()); // Lock hover to prevent scroll-under pointer hijack!
            // Center selected element on dropdown mount
            setTimeout(() => {
              rowVirtualizer.scrollToIndex(idx, { align: "center" });
            }, 50);
            return;
          }
        }
        setHighlightedIndex(0);
      });
    }
  });

  // Auto-highlight the first direct matching search result when search matches update
  createEffect(() => {
    if (isSearching()) {
      const query = inputValue().trim();
      if (query) {
        const list = filteredOptions();
        const matches = matchingNodeIds();
        const idx = list.findIndex((opt) =>
          matches.has(props.optionValue(opt)),
        );
        if (idx !== -1) {
          setHighlightedIndex(idx);
          setLastKeyboardNavTime(Date.now()); // Lock hover to prevent scroll-under pointer hijack!
          untrack(() => {
            rowVirtualizer.scrollToIndex(idx, { align: "auto" });
          });
        } else {
          setHighlightedIndex(0);
        }
      } else {
        setHighlightedIndex(0);
      }
    }
  });

  // -------------------------------------------------------------
  // Core Handlers
  // -------------------------------------------------------------
  const handleSelect = (opt: T) => {
    _lastSelectionTime = Date.now();
    setIsSelectedState(true);
    const selectedId = props.optionValue(opt);
    props.onChange(selectedId, opt);
    setInputValue(getDisplayText(selectedId));
    setIsSearching(false);
    setIsOpen(false);
    inputRef?.focus();
  };

  const handleClear = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelectedState(false);
    setIsOpen(false);
    setInputValue("");
    setIsSearching(false);
    props.onChange(null, null);
    inputRef?.focus();
  };

  const handleTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.disabled) return;

    if (isOpen()) {
      setIsOpen(false);
    } else {
      updateCoords();
      inputRef?.focus();
      setIsOpen(true);
    }
  };

  const handleControlClick = (e: MouseEvent) => {
    if (props.disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest(".clear-btn") || target.closest(".trigger-btn")) return;

    updateCoords();
    inputRef?.focus();
    setIsOpen(true);
  };

  const handleInputChange = (e: Event) => {
    const inputVal = (e.currentTarget as HTMLInputElement).value;
    if (Date.now() - _lastSelectionTime < 150) return;

    if (getDisplayText(props.value) !== inputVal) {
      setIsSelectedState(false);
    }
    // Lock hover immediately to prevent mousemove events from capturing focus during search layout updates
    setLastKeyboardNavTime(Date.now());
    setInputValue(inputVal);
    setIsSearching(true);
    updateCoords();
    setIsOpen(true);
  };

  const handleInputFocus = (e: FocusEvent) => {
    setIsFocused(true);
    updateCoords();
    setIsOpen(true);
    (e.currentTarget as HTMLInputElement).select();
    setIsSelectedState(false);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
      setIsSelectedState(!!props.value);
      if (!isSelectedState()) {
        setInputValue(props.value ? getDisplayText(props.value) : "");
        setIsSearching(false);
      }
    }, 150);
  };

  // Keyboard Navigation engine
  const handleKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;

    if (!isOpen()) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        updateCoords();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    const list = filteredOptions();
    const count = list.length;

    if (count === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setInputValue(props.value ? getDisplayText(props.value) : "");
        setIsSearching(false);
        inputRef?.focus();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setLastKeyboardNavTime(Date.now());
        setHighlightedIndex((prev) => (prev + 1) % count);
        rowVirtualizer.scrollToIndex(highlightedIndex(), { align: "auto" });
        break;
      case "ArrowUp":
        e.preventDefault();
        setLastKeyboardNavTime(Date.now());
        setHighlightedIndex((prev) => (prev - 1 + count) % count);
        rowVirtualizer.scrollToIndex(highlightedIndex(), { align: "auto" });
        break;
      case "ArrowRight": {
        e.preventDefault();
        setLastKeyboardNavTime(Date.now());
        const opt = list[highlightedIndex()];
        if (opt) {
          const optId = props.optionValue(opt);
          const hasKids = hasChildren(optId);
          const expanded = isExpanded(optId);
          if (hasKids) {
            if (!expanded) {
              toggleExpand(optId);
            } else {
              if (highlightedIndex() + 1 < count) {
                setHighlightedIndex(highlightedIndex() + 1);
                rowVirtualizer.scrollToIndex(highlightedIndex(), {
                  align: "auto",
                });
              }
            }
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        setLastKeyboardNavTime(Date.now());
        const opt = list[highlightedIndex()];
        if (opt) {
          const optId = props.optionValue(opt);
          const hasKids = hasChildren(optId);
          const expanded = isExpanded(optId);
          if (hasKids && expanded) {
            toggleExpand(optId);
          } else {
            const pid = props.optionParentId(opt);
            if (pid !== null && pid !== undefined) {
              const parentIdx = list.findIndex(
                (item) => props.optionValue(item) === pid,
              );
              if (parentIdx !== -1) {
                setHighlightedIndex(parentIdx);
                rowVirtualizer.scrollToIndex(highlightedIndex(), {
                  align: "auto",
                });
              }
            }
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        const opt = list[highlightedIndex()];
        if (opt) {
          handleSelect(opt);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setInputValue(props.value ? getDisplayText(props.value) : "");
        setIsSearching(false);
        inputRef?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  // Helper to render label highlighting search query in real time
  const renderOptionLabel = (
    label: string,
    isHighlighted: boolean,
    isSelected: boolean,
  ) => {
    const query = isSearching() ? inputValue().trim() : "";
    const textColorClass = isHighlighted
      ? "text-primary"
      : isSelected
        ? "text-primary font-semibold"
        : "text-text";

    if (!query)
      return (
        <span
          class={cn(
            "text-sm font-semibold truncate transition-colors duration-150",
            textColorClass,
          )}
        >
          {label}
        </span>
      );

    const index = label.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1)
      return (
        <span
          class={cn(
            "text-sm font-semibold truncate transition-colors duration-150",
            textColorClass,
          )}
        >
          {label}
        </span>
      );

    const before = label.substring(0, index);
    const match = label.substring(index, index + query.length);
    const after = label.substring(index + query.length);

    return (
      <span
        class={cn(
          "text-sm font-semibold truncate transition-colors duration-150",
          textColorClass,
        )}
      >
        {before}
        <mark class="bg-primary/20 text-primary font-bold rounded-sm px-0.5">
          {match}
        </mark>
        {after}
      </span>
    );
  };

  return (
    <div
      class="relative flex flex-col gap-1 w-full"
      data-valid={validationState() !== "invalid"}
      data-invalid={validationState() === "invalid"}
    >
      <Show when={props.label !== undefined}>
        <label for={id} class="text-sm font-medium text-muted ml-1">
          {props.label}
        </label>
      </Show>

      {/* Custom Control Input Trigger */}
      <div
        ref={triggerRef}
        onClick={handleControlClick}
        class={cn(
          "group flex w-full items-center justify-between cursor-text px-3 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong",
          isFocused() && "border-primary/65 ring-2 ring-primary/25 bg-card",
          props.disabled && "cursor-not-allowed opacity-50 pointer-events-none",
          validationState() === "invalid" &&
            "border-red-500/50 ring-2 ring-red-500/25",
        )}
      >
        <Show when={props.inputPrefix}>
          <div class="mr-2 shrink-0">{props.inputPrefix}</div>
        </Show>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue()}
          onInput={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          autocomplete="off"
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          disabled={props.disabled}
          class={cn(
            "focus-visible:none focus-visible:shadow-none flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0 select-text",
            isSelectedState() && "cursor-default",
          )}
        />

        <div class="ml-2 flex shrink-0 items-center justify-center gap-1.5 text-muted group-hover:text-text-secondary transition-colors h-full">
          {/* Clear selection action */}
          <Show when={props.value}>
            <button
              type="button"
              onClick={handleClear}
              class="clear-btn cursor-pointer hover:text-danger rounded-md p-0.5 transition-colors flex items-center justify-center border-0 bg-transparent outline-none focus:text-danger focus:ring-0"
              title="Limpiar"
            >
              <XIcon class="size-3.5" strokeWidth={3} />
            </button>
          </Show>

          {/* Dropdown open trigger */}
          <button
            type="button"
            onClick={handleTriggerClick}
            class="trigger-btn cursor-pointer hover:text-primary transition-colors flex items-center justify-center p-0.5 rounded-md border-0 bg-transparent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class={cn(
                "size-4 text-muted/60 transition-transform duration-200",
                isOpen() && "rotate-180 text-primary",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Portalized dropdown window */}
      <Show when={isOpen() && (props.options || []).length > 0}>
        <Portal>
          <div
            ref={dropdownRef}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              // If clicking dropdown background or scrollbars, prevent input focus loss
              if (target.tagName !== "INPUT" && !target.closest("button")) {
                e.preventDefault();
                inputRef?.focus();
              }
            }}
            class="absolute z-100 min-w-32 overflow-hidden bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xl p-1 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
            style={{
              top: `${coords().top}px`,
              left: `${coords().left}px`,
              width: `${coords().width}px`,
              "max-width": `${coords().width}px`,
            }}
          >
            {/* Virtual scroll viewport */}
            <div
              ref={setScrollContainer}
              class="max-h-64 overflow-y-auto outline-none p-1 bg-card text-text custom-scrollbar"
              style={{ position: "relative" }}
            >
              <Show
                when={filteredOptions().length > 0}
                fallback={
                  <div class="py-6 px-4 text-center text-sm text-muted">
                    No se encontraron resultados
                  </div>
                }
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <For each={rowVirtualizer.getVirtualItems()}>
                    {(virtualRow) => {
                      const opt = () => filteredOptions()[virtualRow.index];

                      const optId = () => {
                        const o = opt();
                        return o ? props.optionValue(o) : -1;
                      };
                      const nodeMeta = () => {
                        const id = optId();
                        return id !== -1
                          ? nodeMetaMap().get(id)
                          : undefined;
                      };
                      const depth = () => nodeMeta()?.depth ?? 0;
                      const ancestorIsLast = () => nodeMeta()?.ancestorIsLast ?? [];
                      const hasKids = () => {
                        const id = optId();
                        return id !== -1 ? hasChildren(id) : false;
                      };
                      const expanded = () => {
                        const id = optId();
                        if (id === -1) return false;
                        const searchVisible = visibleNodeIdsInSearch();
                        if (
                          searchVisible &&
                          ancestorsOfMatches().has(id) &&
                          hasKids()
                        ) {
                          return true;
                        }
                        return isExpanded(id);
                      };
                      const isHighlighted = () =>
                        highlightedIndex() === virtualRow.index;
                      const isSelected = () => {
                        const id = optId();
                        return id !== -1 ? props.value === id : false;
                      };
                      const label = () => {
                        const o = opt();
                        return o ? props.optionLabel(o) : "";
                      };

                      return (
                        <div
                          data-index={virtualRow.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          onClick={() => {
                            const o = opt();
                            if (o) handleSelect(o);
                          }}
                          onMouseMove={() => {
                            if (Date.now() - lastKeyboardNavTime() < 150)
                              return;
                            if (highlightedIndex() !== virtualRow.index) {
                              setHighlightedIndex(virtualRow.index);
                            }
                          }}
                          class={cn(
                            "relative flex w-full min-w-0 overflow-hidden cursor-pointer select-none items-center justify-between rounded-lg px-1 text-sm outline-none text-text-secondary border-none",
                            isSelected()
                              ? isHighlighted()
                                ? "bg-primary/20 dark:bg-primary/30 border-primary/45 shadow-sm text-primary font-semibold"
                                : "bg-primary-soft/40 dark:bg-primary-soft/20 border-primary/30 text-primary font-semibold"
                              : isHighlighted()
                                ? "bg-primary/15 dark:bg-primary/25 border-primary/20 shadow-sm text-primary font-semibold"
                                : "hover:bg-card-alt/50",
                          )}
                        >
                          <div class="flex items-center w-full min-w-0 pr-2 select-none relative self-stretch">
                            {/* Visual Tree Guidelines — shadcn-style L/T connectors */}
                            <Show when={depth() > 0}>
                              <div class="absolute top-0 bottom-0 left-1 flex pointer-events-none z-0">
                                <For each={ancestorIsLast()}>
                                  {(isLastAtLevel, i) => {
                                    const isConnectorColumn = () => i() === depth() - 1;
                                    return (
                                      <div
                                        class="h-full shrink-0 relative"
                                        style={{ width: "16px" }}
                                      >
                                        <Show
                                          when={isConnectorColumn()}
                                          fallback={
                                            /* Pass-through columns: continuing vertical line
                                               only if ancestor at this level has more siblings */
                                            <Show when={!isLastAtLevel}>
                                              <div class="w-px h-full bg-primary-strong absolute left-1/2 -translate-x-1/2" />
                                            </Show>
                                          }
                                        >
                                          {/* Connector column (last): L-shape if last child, T-shape if not */}
                                          <div
                                            class={cn(
                                              "w-px bg-primary-strong absolute left-1/2 -translate-x-1/2 top-0",
                                              isLastAtLevel ? "h-1/2" : "h-full",
                                            )}
                                          />
                                          <div class="h-px w-1/2 bg-primary-strong absolute left-1/2 top-[calc(50%-1px)] " />
                                        </Show>
                                      </div>
                                    );
                                  }}
                                </For>
                              </div>
                            </Show>

                            {/* Main Content Row indented dynamically */}
                            <div
                              class="flex items-center w-full min-w-0 flex-1 z-10"
                              style={{ "padding-left": `${depth() * 16}px` }}
                            >
                              {/* Expand / Collapse Spacer / Chevron */}
                              <div class="size-6 shrink-0 flex items-center justify-center">
                                <Show when={hasKids()}>
                                  <button
                                    type="button"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault(); // Prevents input focus loss
                                      const id = optId();
                                      if (id !== -1) toggleExpand(id);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault(); // Prevents click event bubbling to parent row
                                    }}
                                    class="size-5 shrink-0 flex items-center justify-center rounded-md hover:bg-primary/20 text-muted/60 hover:text-primary transition-all duration-150 cursor-pointer z-20"
                                  >
                                    <ChevronRightIcon
                                        stroke-width={3}
                                      class={cn(
                                        "size-3 transition-transform duration-200",
                                        expanded()
                                          ? "rotate-90 text-primary"
                                          : isHighlighted() || isSelected()
                                            ? "text-primary/60"
                                            : "text-muted/50",
                                      )}
                                    />
                                  </button>
                                </Show>
                              </div>

                              {/* Custom or standard item rendering */}
                              <Show when={opt()}>
                                {(nonNullOpt) => {
                                  const currentOptId = () =>
                                    props.optionValue(nonNullOpt());
                                  const currentLabel = () =>
                                    props.optionLabel(nonNullOpt());

                                  return (
                                    <Show
                                      when={props.itemRenderer}
                                      fallback={
                                        <div class="flex flex-col min-w-0 flex-1">
                                          {renderOptionLabel(
                                            currentLabel(),
                                            isHighlighted(),
                                            isSelected(),
                                          )}
                                          <Show
                                            when={getBreadcrumb(currentOptId())}
                                          >
                                            <span
                                              class={cn(
                                                "text-[11px] truncate mt-0.5 transition-colors duration-150",
                                                isHighlighted()
                                                  ? "text-primary/70"
                                                  : isSelected()
                                                    ? "text-primary/70"
                                                    : "text-muted/70",
                                              )}
                                            >
                                              {getBreadcrumb(currentOptId())}
                                            </span>
                                          </Show>
                                        </div>
                                      }
                                    >
                                      {props.itemRenderer!(nonNullOpt(), {
                                        depth: depth(),
                                        hasChildren: hasKids(),
                                        expanded: expanded(),
                                        query: isSearching()
                                          ? inputValue()
                                          : "",
                                        highlighted: isHighlighted(),
                                        selected: isSelected(),
                                      })}
                                    </Show>
                                  );
                                }}
                              </Show>

                              {/* Checkmark Indicator on the right */}
                              <Show when={isSelected()}>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="size-4 text-primary shrink-0 ml-2 animate-in zoom-in-50 duration-200"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  stroke-width="3.5"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </Show>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>

      {/* Error validation block */}
      <Show when={validationState() === "invalid" && errorMessage()}>
        <small
          class="absolute -bottom-3.5 left-1 text-xs leading-none text-danger font-medium animate-in fade-in slide-in-from-top-1"
          role="alert"
        >
          {errorMessage()}
        </small>
      </Show>
    </div>
  );
}

export default TreeSelect;
