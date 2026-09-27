export let hostedMode = false;
export function setHostedMode(value: boolean) {
  hostedMode = value;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers:
      options.body instanceof FormData
        ? { "X-SpendShield": "1", ...options.headers }
        : {
            "Content-Type": "application/json",
            "X-SpendShield": "1",
            ...options.headers,
          },
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)])
      : AbortSignal.timeout(120000),
  });
  if (response.status === 401)
    window.dispatchEvent(new Event("spendshield:signed-out"));
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The backend could not be reached. Check that SpendShield is running.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Please check your input and try again.",
    );
  return result;
}
export function post<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export const money = (value: number, cents = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents || !Number.isInteger(value) ? 2 : 0,
    minimumFractionDigits: cents || !Number.isInteger(value) ? 2 : 0,
  }).format(value);
