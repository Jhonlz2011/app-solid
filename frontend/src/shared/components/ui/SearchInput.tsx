import { Component, createSignal, onCleanup } from 'solid-js';

interface SearchInputProps {
    value: string;
    onSearch: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    class?: string;
}

const SearchIcon = () => (
    <svg class="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

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
        <div class={`relative ${props.class ?? ''}`}>
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon />
            </div>
            <input
                type="text"
                placeholder={props.placeholder ?? 'Buscar...'}
                value={localValue()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                class="search-input w-full"
            />
        </div>
    );
};

export default SearchInput;