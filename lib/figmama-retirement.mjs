import {blockedWebPath} from './access-paths.mjs';
export const FIGMAMA_URL='https://youmeca.web.app/bmonly';
// Authentication and approval are enforced by middleware for all preserved service routes.
// Neither archive=1 nor a special HTTP method can reopen the closed BM-only web entry.
export function retirementAction(pathname) {
  return blockedWebPath(pathname)?{kind:'closed',status:403}:{kind:'preserve'};
}
