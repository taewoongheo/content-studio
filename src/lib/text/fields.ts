// Identifiers, addresses and structural enums are data rather than prose.
export const isDataField = (key: string) =>
  /(^|_)(id|ids|url|uri|path|at)$|^(kind|role|state|status|type|format|aspect_ratio|fontFamily|color)$/.test(key);
