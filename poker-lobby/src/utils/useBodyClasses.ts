import { useEffect } from "react";

/** Añade/remueve clases al <body> */
export function useBodyClasses(classes: string[]) {
  useEffect(() => {
    const body = document.body;
    classes.forEach(c => body.classList.add(c));
    return () => { classes.forEach(c => body.classList.remove(c)); };
  }, [classes.join("|")]);
}
