import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onWheel, ...props }, ref) => (
    <input
      type={type}
      // number入力: スクロール（マウスホイール/トラックパッド）で数値が勝手に増減するのを防ぐためフォーカスを外す
      onWheel={
        type === "number"
          ? (e) => {
              (e.currentTarget as HTMLInputElement).blur();
              onWheel?.(e);
            }
          : onWheel
      }
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        // number入力: 上下のスピンボタン（矢印）を非表示にする
        type === "number" &&
          "[appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
