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
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "./scroll-area";
import { Button } from "./button";

export interface SearchInputProps {
  options: { label: string; value: string; className?: string }[];
  onSelect: (option: { value: string; label: string; }) => void;
  placeholder?: string;
  value: string;
  onValueChange: (search: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  triggerAction?: 'input' | 'icon';
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({ 
    options,
    onSelect, 
    placeholder,
    value,
    onValueChange,
    onKeyDown,
    className,
    open,
    onOpenChange,
    disabled = false,
    triggerAction = 'input',
  }, ref) => {
    
    const showPopover = open && options.length > 0;
    
    const handleSelect = (option: { value: string; label: string; }) => {
        onOpenChange(false);
        onSelect(option);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange(e.target.value);
        if (!open && triggerAction === 'input') {
            onOpenChange(true);
        }
    };

    const searchIcon = (
      <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
    );
    
    const triggerInput = (
      <Input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        className="pl-9"
        autoComplete="off"
        disabled={disabled}
      />
    );

    return (
        <Popover open={showPopover} onOpenChange={onOpenChange}>
            <div className={cn("relative w-full", className)}>
                {triggerAction === 'icon' ? (
                    <>
                        {/* When mode is 'icon', the button is the trigger */}
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                                disabled={disabled}
                                aria-label="Mostrar opciones"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        {/* The input is just an input, it doesn't trigger the popover */}
                        {triggerInput}
                    </>
                ) : (
                    <>
                        {/* When mode is 'input', the input is the trigger */}
                        {searchIcon}
                        <PopoverTrigger asChild>
                            {triggerInput}
                        </PopoverTrigger>
                    </>
                )}
            </div>
            <PopoverContent 
                className="w-[var(--radix-popover-trigger-width)] p-0" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <Command shouldFilter={false}>
                    <ScrollArea className="h-auto max-h-72">
                        <CommandList>
                            {options.length > 0 ? (
                                options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => handleSelect(option)}
                                    className={cn("cursor-pointer", option.className)}
                                >
                                    {option.label}
                                </CommandItem>
                                ))
                            ) : (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    No hay resultados.
                                </div>
                            )}
                        </CommandList>
                    </ScrollArea>
                </Command>
            </PopoverContent>
        </Popover>
    );
});

SearchInput.displayName = "SearchInput";

export { SearchInput };
