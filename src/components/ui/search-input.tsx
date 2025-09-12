/**
 * @fileoverview A standardized, reusable search input component with debouncing and popover suggestions.
 * This component displays a text input. As the user types, it shows a popover with a list of
 * matching options that can be selected.
 */
"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface SearchInputProps {
  options: { label: string; value: string; className?: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  value: string; // The current text input value
  onValueChange: (search: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({ 
    options,
    onSelect, 
    placeholder,
    value,
    onValueChange,
    onKeyDown,
    className
  }, ref) => {
    
    const [isOpen, setIsOpen] = React.useState(false);
    const showPopover = isOpen && options.length > 0;
    
    const handleSelect = (optionValue: string) => {
        setIsOpen(false); // Close popover first
        onSelect(optionValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    return (
        <Popover open={showPopover} onOpenChange={setIsOpen}>
            <div className={cn("relative w-full", className)}>
                 <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <PopoverTrigger asChild>
                    <Input
                        ref={ref}
                        type="text"
                        placeholder={placeholder}
                        value={value}
                        onChange={handleChange}
                        onFocus={() => {
                            if (value && options.length > 0) setIsOpen(true);
                        }}
                        onKeyDown={onKeyDown}
                        className="pl-8"
                        autoComplete="off"
                    />
                </PopoverTrigger>
            </div>
            <PopoverContent 
                className="w-[var(--radix-popover-trigger-width)] p-0" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
            >
                <Command shouldFilter={false}>
                     <CommandInput 
                        placeholder={placeholder || "Buscar..."}
                        value={value}
                        onValueChange={onValueChange}
                    />
                    <CommandList>
                         {options.length > 0 ? (
                             <CommandGroup>
                                {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => handleSelect(option.value)}
                                    className={cn("cursor-pointer", option.className)}
                                >
                                    {option.label}
                                </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : (
                             <CommandEmpty>
                                {value.length > 1 ? "No se encontraron resultados." : "Sigue escribiendo para buscar..."}
                            </CommandEmpty>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
});

SearchInput.displayName = "SearchInput";

export { SearchInput };
