function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value.split(",", 1)[0]?.trim();
}

function splitHostPort(host) {
  const bracketed = host.match(/^(\[[^\]]+\]):(\d+)$/);

  if (bracketed) {
    return { hostname: bracketed[1], port: bracketed[2] };
  }

  const colonIndex = host.lastIndexOf(":");

  if (colonIndex === -1 || host.indexOf(":") !== colonIndex) {
    return { hostname: host, port: undefined };
  }

  const hostname = host.slice(0, colonIndex);
  const port = host.slice(colonIndex + 1);

  if (!/^\d+$/.test(port)) {
    return { hostname: host, port: undefined };
  }

  return { hostname, port };
}

export function normalizeDefaultPortHost(host, proto) {
  const trimmed = host?.trim();

  if (!trimmed) {
    return trimmed;
  }

  const { hostname, port } = splitHostPort(trimmed);
  const normalizedProto = proto?.trim().toLowerCase();

  if (port === "443" && normalizedProto !== "http") {
    return hostname;
  }

  if (port === "80" && normalizedProto !== "https") {
    return hostname;
  }

  return trimmed;
}

function setHeader(headers, name, value) {
  const current = headers[name];

  if (Array.isArray(current)) {
    headers[name] = [value, ...current.slice(1)];
    return;
  }

  headers[name] = value;
}

export function normalizeForwardedHostHeaders(headers) {
  const proto = firstHeaderValue(headers["x-forwarded-proto"]);
  const changed = [];

  for (const headerName of ["x-forwarded-host", "host"]) {
    const value = firstHeaderValue(headers[headerName]);

    if (!value) {
      continue;
    }

    const normalizedValue = normalizeDefaultPortHost(value, proto);

    if (normalizedValue && normalizedValue !== value) {
      setHeader(headers, headerName, normalizedValue);
      changed.push({ headerName, from: value, to: normalizedValue });
    }
  }

  return changed;
}
