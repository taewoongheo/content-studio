import { loadVariableFont as inter } from "@remotion/google-fonts/Inter";
import { loadVariableFont as oswald } from "@remotion/google-fonts/Oswald";
import { loadVariableFont as space } from "@remotion/google-fonts/SpaceGrotesk";
import { loadVariableFont as geist } from "@remotion/google-fonts/Geist";
export function ensureVideoFont(family: string, italic: boolean) {
  if (family === "Inter") inter(italic ? "italic" : "normal", { subsets: ["latin"] });
  else if (family === "Oswald") oswald("normal", { subsets: ["latin"] });
  else if (family === "Space Grotesk") space("normal", { subsets: ["latin"] });
  else geist(italic ? "italic" : "normal", { subsets: ["latin"] });
}
