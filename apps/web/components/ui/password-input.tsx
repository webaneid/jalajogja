"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff }          from "lucide-react";
import { Input }                 from "@/components/ui/input";
import { Label }                 from "@/components/ui/label";
import { cn }                    from "@/lib/utils";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:       string;
  id?:          string;
  wrapperClass?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, id, wrapperClass, className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? "password";

    return (
      <div className={cn("space-y-1.5", wrapperClass)}>
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={cn("pr-10", className)}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    );
  }
);
