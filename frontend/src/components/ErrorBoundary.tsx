import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CareerSignal UI error", { name: error.name, message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <section>
          <p>CareerSignal</p>
          <h1>This view could not be displayed.</h1>
          <span>Your saved information has not been changed. Reload the application to recover.</span>
          <button type="button" onClick={() => window.location.reload()}>Reload application</button>
        </section>
      </main>
    );
  }
}
