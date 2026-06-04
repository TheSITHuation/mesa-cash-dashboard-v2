// src/hooks/useBodyClasses.ts
import { useEffect } from "react";

export function useBodyClasses(classes: string[]) {
  useEffect(() => {
    const unique = Array.from(new Set(classes.filter(Boolean)));
    unique.forEach(c => document.body.classList.add(c));

    return () => {
      unique.forEach(c => document.body.classList.remove(c));
    };
    // depende del contenido, no de la referencia del array
  }, [classes.join(" ")]);
}
