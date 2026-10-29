import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GreenWave Component Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-slate-950/90 text-slate-100">
          <div className="max-w-md w-full rounded-xl border border-rose-500/40 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0 animate-pulse" />
              <h2 className="text-lg font-bold font-display tracking-wide">
                {this.props.title || "Module Recovery Notice"}
              </h2>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-4 leading-relaxed bg-slate-950 p-3 rounded border border-slate-800 break-words">
              {this.state.error?.message || "An unexpected rendering event occurred in this subsystem."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Subsystem
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
