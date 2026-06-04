import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

/* mini helper para componer clases sin deps externas */
function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export function FluidPanel(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cx("fluid-glass", className)} {...rest} />;
}
export function FluidCard(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cx("fluid-glass", className)} {...rest} />;
}
export function FluidPill(props: HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return <span className={cx("fluid-pill", className)} {...rest} />;
}
export function FluidButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" }
) {
  const { className, variant = "default", ...rest } = props;
  return (
    <button
      className={cx("fluid-btn", variant === "primary" && "fluid-btn--primary", className)}
      {...rest}
    />
  );
}
