// Shared set of Printful technique keys accepted by this application.
// Used by both the printfiles and templates API routes to validate the
// ?technique= query parameter.
//
// Do not expand this set beyond techniques actually supported by the store.
export const VALID_TECHNIQUES = new Set([
  "DIGITAL",
  "CUT-SEW",
  "UV",
  "EMBROIDERY",
  "SUBLIMATION",
  "ENGRAVING",
  "DTG",
  "DTFILM",
  "DIRECT-TO-FABRIC",
  "KNITWEAR",
]);
