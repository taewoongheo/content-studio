import { browserSearch } from "./browser";
import { parseInstagramSearch } from "../parsers/instagram";
import { searchUrl, type SearchInput } from "../types";
import type { CollectorContext } from "../../collection/types";
export async function searchInstagram(input: SearchInput, context: CollectorContext) {
  return browserSearch({ input, page: await context.getPage(), signal: context.signal, url: searchUrl(input),
    matches: response => { const url = new URL(response.url()); return url.hostname === "www.instagram.com" &&
      (/\/search\/topsearch|\/fbsearch\//.test(url.pathname) || /^\/(?:graphql\/query|api\/graphql)\/?$/.test(url.pathname)); },
    parse: parseInstagramSearch });
}
