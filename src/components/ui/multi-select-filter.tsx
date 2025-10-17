/**
 * @fileoverview A reusable multi-select filter component with a popover and checkboxes.
 */
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Badge } from "./badge";
import { ScrollArea } from "./scroll-area";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectedChange: (selected: string[]) => void;
  title: string;
  className?: string;
}

export function MultiSelectFilter({
  options,
  selectedValues,
  onSelectedChange,
  title,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectedChange(newSelected);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full md:w-[240px] justify-between", className)}
        >
          <div className="flex items-center gap-1">
            <PlusCircle className="mr-2 h-4 w-4" />
            {title}
            {selectedValues.length > 0 && (
              <>
                <div className="mx-2 h-4 w-px bg-muted-foreground" />
                {selectedValues.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                        {selectedValues.length} seleccionados
                    </Badge>
                ) : (
                    options
                        .filter(option => selectedValues.includes(option.value))
                        .map(option => (
                            <Badge key={option.value} variant="secondary" className="rounded-sm px-1 font-normal">
                                {option.label}
                            </Badge>
                        ))
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={`Buscar ${title.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <ScrollArea className="max-h-60">
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {option.icon && <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
