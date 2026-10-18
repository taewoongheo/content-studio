import { loadVariableFont as inter } from "@remotion/google-fonts/Inter";
import { loadVariableFont as oswald } from "@remotion/google-fonts/Oswald";
export function ensureVideoFont(family: string, italic: boolean) {
  if (family === "Inter") inter(italic ? "italic" : "normal", { subsets: ["latin"] });
  else if (family === "Oswald") oswald("normal", { subsets: ["latin"] });
}
