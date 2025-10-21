/**
 * @fileoverview A reusable multi-select filter component with a popover and checkboxes.
 * This version uses a simple scrollable list of checkboxes for improved reliability and user experience.
 */
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "./badge";
import { ScrollArea } from "./scroll-area";
import { Input } from "./input";
import { Label } from "./label";
import { Checkbox } from "./checkbox";

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
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredOptions = React.useMemo(() =>
    options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    ), [options, searchTerm]
  );

  const handleToggle = (value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectedChange(newSelected);
  };
  
  const handleToggleAll = () => {
    if (selectedValues.length === options.length) {
      onSelectedChange([]);
    } else {
      onSelectedChange(options.map(o => o.value));
    }
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
          <div className="flex items-center gap-1 truncate">
            <PlusCircle className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{title}</span>
            {selectedValues.length > 0 && (
              <>
                <div className="mx-2 h-4 w-px bg-muted-foreground" />
                <div className="flex flex-nowrap gap-1">
                  {selectedValues.length > 2 ? (
                      <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                          {selectedValues.length} seleccionados
                      </Badge>
                  ) : (
                      options
                          .filter(option => selectedValues.includes(option.value))
                          .map(option => (
                              <Badge key={option.value} variant="secondary" className="rounded-sm px-1 font-normal truncate">
                                  {option.label}
                              </Badge>
                          ))
                  )}
                </div>
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="p-2 space-y-2">
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <div className="flex items-center border-t pt-2">
                <Checkbox
                    id="select-all"
                    checked={selectedValues.length === options.length && options.length > 0}
                    onCheckedChange={handleToggleAll}
                    aria-label="Seleccionar todo"
                />
                <Label htmlFor="select-all" className="ml-2 text-sm font-medium">
                    Seleccionar todo
                </Label>
            </div>
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-2 space-y-1">
            {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 p-1 rounded-md hover:bg-accent">
                        <Checkbox
                            id={`check-${option.value}`}
                            checked={selectedValues.includes(option.value)}
                            onCheckedChange={() => handleToggle(option.value)}
                        />
                         <Label htmlFor={`check-${option.value}`} className="font-normal w-full cursor-pointer">
                            {option.label}
                        </Label>
                    </div>
                ))
            ) : (
                 <div className="py-6 text-center text-sm text-muted-foreground">
                    No se encontraron resultados.
                </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
