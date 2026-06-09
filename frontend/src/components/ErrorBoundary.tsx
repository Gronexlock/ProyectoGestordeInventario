import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "300px",
            padding: "40px",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <span style={{ fontSize: "3rem" }} aria-hidden="true">⚠️</span>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#b91c1c" }}>
            Ocurrió un error inesperado
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#666", maxWidth: "400px" }}>
            {this.state.error?.message ?? "Error desconocido. Intenta recargar la página."}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "10px 24px",
              background: "var(--color-teal, #0891b2)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.9rem",
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
