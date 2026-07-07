/**
 * Phase 7B microfix — route-safe degradation isolation.
 *
 * Lightweight localized error boundary. Wrap a single queue/list region
 * (reviewer moderation queue, trainer competency queue) so a transient
 * runtime hiccup degrades to an inline fallback instead of collapsing the
 * surrounding portal shell. Intentionally NOT a global wrapper — only used
 * around reviewer/trainer queue regions where runtime isolation matters.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: ReactNode;
}
interface State { error: Error | null }

export class RuntimeBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RuntimeBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-3 text-[12.5px]">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">
              {this.props.label ?? "Runtime region"} didn't load
            </div>
            <div className="text-[11.5px] mt-0.5">
              This region is isolated — the rest of the page is still usable.
            </div>
            <button type="button" onClick={this.reset}
              className="mt-2 inline-flex items-center rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11.5px] hover:bg-amber-100">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
}
