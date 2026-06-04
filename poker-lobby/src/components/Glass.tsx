import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import clsx from "clsx";

export function GlassPanel(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={clsx("fg-panel fg-ring", className)} {...rest} />;
}
export function GlassCard(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={clsx("fg-card fg-ring", className)} {...rest} />;
}
export function GlassPill(props: HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return <span className={clsx("fg-pill px-3 py-1 text-sm font-semibold", className)} {...rest} />;
}
export function GlassButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default"|"primary" }) {
  const { className, variant="default", ...rest } = props;
  return (
    <button
      className={clsx("fg-btn px-4 py-2 font-semibold", variant==="primary" && "glass-btn--primary", className)}
      {...rest}
    />
  );
}
