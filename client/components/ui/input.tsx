import type { InputHTMLAttributes, ReactNode } from "react";
type InputProps = InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; trailing?: ReactNode };
export function Input({ icon, trailing, className = "", ...props }: InputProps) {
  return <div className="input-wrap">{icon && <span className="input-icon">{icon}</span>}<input {...props} className={`input ${icon ? "input--icon" : ""} ${trailing ? "input--trailing" : ""} ${className}`} />{trailing && <span className="input-trailing">{trailing}</span>}</div>;
}
