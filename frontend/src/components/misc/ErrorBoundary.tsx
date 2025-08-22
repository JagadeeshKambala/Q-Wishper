import React from "react";

type State = { hasError: boolean; message?: string; stack?: string };

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err), stack: String(err?.stack || "") };
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong.</h1>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.message}</pre>
          {this.state.stack && (
            <>
              <h2 style={{ fontSize: 16, marginTop: 12 }}>Stack</h2>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{this.state.stack}</pre>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
