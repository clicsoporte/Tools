
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

interface SearchInputProps {
    options: { label: string; value: string, className?: string }[];
    onSelect: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    value: string;
    onValueChange: (search: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const SearchInput = React.forwardRef<HTMLButtonElement, SearchInputProps>(({ 
    options,
    onSelect, 
    placeholder, 
    searchPlaceholder,
    value,
    onValueChange,
    onKeyDown
  }, ref) => {
    
    const [isOpen, setIsOpen] = React.useState(false);

    const handleSelect = (currentValue: string) => {
        onSelect(currentValue);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={ref}
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    className="w-full justify-between font-normal"
                >
                    <span className="truncate">
                        {value ? options.find(o => o.value === value)?.label || value : placeholder || "Selecciona una opción..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto p-0" align="start">
                <Command>
                    <CommandInput 
                        placeholder={searchPlaceholder || "Buscar..."}
                        onValueChange={onValueChange}
                        onKeyDown={onKeyDown}
                    />
                    <CommandList>
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={option.label}
                                onSelect={() => handleSelect(option.value)}
                                className={cn("cursor-pointer", option.className)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {option.label}
                            </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
});

SearchInput.displayName = "SearchInput";

export { SearchInput };
