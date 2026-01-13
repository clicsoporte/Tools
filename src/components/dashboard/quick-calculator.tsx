/**
 * @fileoverview A quick-access calculator component to be used in a popover.
 */
"use client";

import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Backspace } from "lucide-react";
import { PopoverContent } from "@/components/ui/popover"; // Corrected this line

type State = {
  currentOperand: string;
  previousOperand: string | null;
  operation: string | null;
  overwrite: boolean; // True if the next number should overwrite the current operand
};

type Action =
  | { type: "add-digit"; payload: { digit: string } }
  | { type: "choose-operation"; payload: { operation: string } }
  | { type: "clear" }
  | { type: "delete-digit" }
  | { type: "evaluate" };

const INTEGER_FORMATTER = new Intl.NumberFormat("es-CR", {
  maximumFractionDigits: 0,
});

function formatOperand(operand: string | null) {
  if (operand == null || operand === "") return "0";
  const [integer, decimal] = operand.split(".");
  if (decimal == null) {
    if (integer === "") return "0";
    return INTEGER_FORMATTER.format(parseInt(integer));
  }
  return `${INTEGER_FORMATTER.format(parseInt(integer))}.${decimal}`;
}

function evaluate({
  currentOperand,
  previousOperand,
  operation,
}: State): string {
  const prev = parseFloat(previousOperand || "0");
  const current = parseFloat(currentOperand);
  if (isNaN(prev) || isNaN(current)) return "";
  let computation: number;
  switch (operation) {
    case "+":
      computation = prev + current;
      break;
    case "-":
      computation = prev - current;
      break;
    case "*":
      computation = prev * current;
      break;
    case "/":
      computation = prev / current;
      break;
    default:
      return "";
  }
  return computation.toString();
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add-digit":
      if (state.overwrite) {
        return { ...state, currentOperand: action.payload.digit, overwrite: false };
      }
      if (action.payload.digit === "0" && state.currentOperand === "0")
        return state;
      if (action.payload.digit === "." && state.currentOperand.includes("."))
        return state;
      return {
        ...state,
        currentOperand: `${state.currentOperand || ""}${action.payload.digit}`,
      };

    case "delete-digit":
        if (state.overwrite) {
            return { ...state, currentOperand: "", overwrite: false };
        }
        if (state.currentOperand === "") return state;
        return {
            ...state,
            currentOperand: state.currentOperand.slice(0, -1),
        };

    case "choose-operation":
      if (state.currentOperand === "" && state.previousOperand == null)
        return state;
      if (state.previousOperand == null) {
        return {
          ...state,
          operation: action.payload.operation,
          previousOperand: state.currentOperand,
          currentOperand: "",
        };
      }
      if (state.currentOperand === "") {
        return { ...state, operation: action.payload.operation };
      }
      return {
        ...state,
        previousOperand: evaluate(state),
        operation: action.payload.operation,
        currentOperand: "",
      };

    case "clear":
      return {
        currentOperand: "",
        previousOperand: null,
        operation: null,
        overwrite: false,
      };

    case "evaluate":
      if (
        state.operation == null ||
        state.currentOperand === "" ||
        state.previousOperand == null
      ) {
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
    {
      currentOperand: "",
      previousOperand: null,
      operation: null,
      overwrite: false,
    }
  );

  const buttonClass = "h-16 text-xl";

  return (
    <PopoverContent className="w-80 p-0" side="bottom" align="end">
        <div className="grid grid-cols-4 gap-1 p-2">
            <div className="col-span-4 bg-muted h-20 rounded-md flex flex-col justify-around items-end p-4 overflow-hidden">
                <div className="text-muted-foreground text-sm h-6 self-end w-full truncate text-right">
                {previousOperand} {operation}
                </div>
                <div className="text-foreground text-3xl font-bold">
                {formatOperand(currentOperand)}
                </div>
            </div>

            <Button variant="destructive" className={buttonClass} onClick={() => dispatch({ type: "clear" })} >AC</Button>
            <Button variant="destructive" className={buttonClass} onClick={() => dispatch({ type: "delete-digit" })}><Backspace /></Button>
            <Button variant="secondary" className={buttonClass} onClick={() => dispatch({ type: "choose-operation", payload: { operation: "/" } })}>/</Button>
            <Button variant="secondary" className={buttonClass} onClick={() => dispatch({ type: "choose-operation", payload: { operation: "*" } })}>×</Button>

            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "7" } })}>7</Button>
            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "8" } })}>8</Button>
            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "9" } })}>9</Button>
            <Button variant="secondary" className={buttonClass} onClick={() => dispatch({ type: "choose-operation", payload: { operation: "-" } })}>-</Button>
            
            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "4" } })}>4</Button>
            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "5" } })}>5</Button>
            <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "6" } })}>6</Button>
            <Button variant="secondary" className={buttonClass} onClick={() => dispatch({ type: "choose-operation", payload: { operation: "+" } })}>+</Button>
            
            <div className="col-span-3 grid grid-cols-3 gap-1">
                <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "1" } })}>1</Button>
                <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "2" } })}>2</Button>
                <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "3" } })}>3</Button>
                <Button variant="outline" className={`${buttonClass} col-span-2`} onClick={() => dispatch({ type: "add-digit", payload: { digit: "0" } })}>0</Button>
                <Button variant="outline" className={buttonClass} onClick={() => dispatch({ type: "add-digit", payload: { digit: "." } })}>.</Button>
            </div>
            <Button variant="secondary" className="row-span-2 h-full text-2xl" onClick={() => dispatch({ type: "evaluate" })}>=</Button>
        </div>
    </PopoverContent>
  );
}
