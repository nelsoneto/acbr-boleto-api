type LogLevel = "info" | "warn" | "error" | "debug";

function serializeError(error: unknown) {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function write(
  level: LogLevel,
  scope: string,
  event: string,
  context: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...context,
  };

  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
}

export function createLogger(scope: string) {
  return {
    debug(event: string, context: Record<string, unknown> = {}) {
      write("debug", scope, event, context);
    },
    info(event: string, context: Record<string, unknown> = {}) {
      write("info", scope, event, context);
    },
    warn(event: string, context: Record<string, unknown> = {}) {
      write("warn", scope, event, context);
    },
    error(
      event: string,
      error?: unknown,
      context: Record<string, unknown> = {},
    ) {
      write("error", scope, event, {
        ...context,
        error: serializeError(error),
      });
    },
  };
}
