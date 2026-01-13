/**
 * @fileoverview A quick-access calculator component to be used in a popover.
 */
"use client";

import { useState, useReducer } from "react";
import { Button } from "@/components/ui/button";

type State = {
  currentOperand: string;
  previousOperand: string | null;
  operation: string | null;
  overwrite: boolean; // True if the next number should overwrite the current operand
};

type Action =
  | { type: 'add-digit'; payload: string }
  | { type: 'choose-operation'; payload: string }
  | { type: 'clear' }
  | { type: 'delete-digit' }
  | { type: 'evaluate' };

const INTEGER_FORMATTER = new Intl.NumberFormat("es-CR", {
  maximumFractionDigits: 0,
});

function formatOperand(operand: string | null) {
  if (operand == null || operand === "") return "0"; // <-- CORRECCIÓN: Devolver "0" si está vacío.
  const [integer, decimal] = operand.split(".");
  if (decimal == null) {
    if(integer === "") return "0"; // Evita NaN si solo hay un punto.
    return INTEGER_FORMATTER.format(parseInt(integer));
  }
  return `${INTEGER_FORMATTER.format(parseInt(integer))}.${decimal}`;
}

function evaluate({ currentOperand, previousOperand, operation }: State): string {
    const prev = parseFloat(previousOperand || '0');
    const current = parseFloat(currentOperand);
    if (isNaN(prev) || isNaN(current)) return "";
    let computation: number;
    switch (operation) {
        case "+": computation = prev + current; break;
        case "-": computation = prev - current; break;
        case "*": computation = prev * current; break;
        case "/": computation = prev / current; break;
        default: return "";
    }
    return computation.toString();
}

function reducer(state: State, { type, payload }: Action): State {
    switch (type) {
        case 'add-digit':
            if (state.overwrite) {
                return { ...state, currentOperand: payload, overwrite: false };
            }
            if (payload === "0" && state.currentOperand === "0") return state;
            if (payload === "." && state.currentOperand.includes(".")) return state;
            return { ...state, currentOperand: `${state.currentOperand || ""}${payload}` };
        
        case 'choose-operation':
            if (state.currentOperand === "" && state.previousOperand == null) return state;
            if (state.previousOperand == null) {
                return {
                    ...state,
                    operation: payload,
                    previousOperand: state.currentOperand,
                    currentOperand: "",
                };
            }
            if (state.currentOperand === "") {
                return { ...state, operation: payload };
            }
            return {
                ...state,
                previousOperand: evaluate(state),
                operation: payload,
                currentOperand: "",
            };

        case 'clear':
            return { currentOperand: "", previousOperand: null, operation: null, overwrite: false };
            
        case 'evaluate':
            if (state.operation == null || state.currentOperand === "" || state.previousOperand == null) {
                return state;
            }
            return {
                ...state,
                overwrite: true,
                previousOperand: null,
                operation: null,
                currentOperand: evaluate(state),
            };

        default:
            return state;
    }
}

export function QuickCalculator() {
    const [{ currentOperand, previousOperand, operation }, dispatch] = useReducer(
        reducer,
        { currentOperand: "", previousOperand: null, operation: null, overwrite: false }
    );

    return (
        <div className="grid grid-cols-4 gap-1 p-2 bg-popover rounded-lg shadow-lg">
            <div className="col-span-4 bg-muted h-20 rounded-md flex flex-col justify-around items-end p-4 overflow-hidden">
                <div className="text-muted-foreground text-sm">
                    {previousOperand} {operation}
                </div>
                <div className="text-foreground text-3xl font-bold">
                    {formatOperand(currentOperand)}
                </div>
            </div>
            
            <Button variant="destructive" className="col-span-2 h-16 text-xl" onClick={() => dispatch({ type: 'clear' })}>AC</Button>
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'choose-operation', payload: '*' })} >×</Button>
            <Button variant="secondary" className="h-16 text-xl" onClick={() => dispatch({ type: 'choose-operation', payload: '/' })} >/</Button>
            
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '7' })}>7</Button>
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '8' })}>8</Button>
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '9' })}>9</Button>
            <Button variant="secondary" className="h-16 text-xl" onClick={() => dispatch({ type: 'choose-operation', payload: '-' })}>-</Button>
            
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '4' })}>4</Button>
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '5' })}>5</Button>
            <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '6' })}>6</Button>
            <Button variant="secondary" className="h-16 text-xl" onClick={() => dispatch({ type: 'choose-operation', payload: '+' })}>+</Button>

            <div className="col-span-3 grid grid-cols-3 gap-1">
                <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '1' })}>1</Button>
                <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '2' })}>2</Button>
                <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '3' })}>3</Button>
                <Button variant="outline" className="h-16 text-xl col-span-2" onClick={() => dispatch({ type: 'add-digit', payload: '0' })}>0</Button>
                <Button variant="outline" className="h-16 text-xl" onClick={() => dispatch({ type: 'add-digit', payload: '.' })}>.</Button>
            </div>
            <Button variant="secondary" className="row-span-2 h-full text-2xl" onClick={() => dispatch({ type: 'evaluate' })}>=</Button>
        </div>
    );
}