import { Component, createSignal, onCleanup } from 'solid-js';
import { SearchIcon } from '@shared/ui/icons';

interface SearchInputProps {
    value: string;
    onSearch: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    class?: string;
}

export const SearchInput: Component<SearchInputProps> = (props) => {
    const [localValue, setLocalValue] = createSignal(props.value);
    let timeout: number;

    const handleInput = (value: string) => {
        setLocalValue(value);
        clearTimeout(timeout);
        timeout = window.setTimeout(() => {
            props.onSearch(value);
        }, props.debounceMs ?? 300);
    };

    onCleanup(() => clearTimeout(timeout));

    return (
        <div class={`group relative ${props.class ?? ''}`}>
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon class="size-5 text-muted group-hover:text-text/80 group-focus-within:text-text/80"/>
            </div>
            <input
                type="text"
                placeholder={props.placeholder ?? 'Buscar...'}
                value={localValue()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                class="bg-card border border-border text-text rounded-xl px-4 py-1.5 pl-10 w-full placeholder:text-muted outline-none hover: focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            />
        </div>
    );
};

export default SearchInput;