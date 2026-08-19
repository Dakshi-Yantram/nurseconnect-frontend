// lucide-react ships icon subpaths (e.g. "lucide-react/dist/esm/icons/list-checks")
// without their own .d.ts files — only the top-level "lucide-react" barrel is typed.
// We import ListChecks from its subpath directly in src/lib/rbac.ts to dodge a
// production Rollup/Vite code-splitting bug that tree-shook it out of the
// barrel import (caused a runtime "ReferenceError: ListChecks is not defined").
// This ambient module declaration silences the resulting TS7016 warning.
declare module "lucide-react/dist/esm/icons/list-checks" {
  import type { ComponentType, SVGProps } from "react";
  const ListChecks: ComponentType<SVGProps<SVGSVGElement>>;
  export default ListChecks;
}