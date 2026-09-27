import { useEffect, useState } from "react";
import { api, post, hostedMode } from "./api";
type Settings = {
  extension_id: string;
  purchase_enabled: boolean;
  auto_analyze: boolean;
  shield_enabled: boolean;
  block_limit: boolean;
  block_cooldown: boolean;
  wait_hours: number;
  domains: string[];
  guard_enabled: boolean;
  weekly_limit: string;
};
export function LiveSettings() {
  const [value, setValue] = useState<Settings | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hostedMode)
      void api<Settings>("/live/settings")
        .then(setValue)
        .catch((e) => setMessage(e.message));
  }, []);
  if (hostedMode)
    return (
      <section className="card">
        <h2>SpendShield Live</h2>
        <p>
          The Chrome companion currently connects to a local SpendShield
          installation.
        </p>
      </section>
    );
  return (
    <section className="card" id="live-settings">
      <h2>SpendShield Live</h2>
      <p>
        Bring your plan to the moment of purchase with the optional Chrome
        extension. It uses this app’s finances and safeguards. Install the
        extension, copy its ID from Connection &amp; safeguards, and pair it
        here.
      </p>
      <p role="status">{message}</p>
      {value && (
        <form
          className="plan-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              setValue(await post<Settings>("/live/settings", value));
              setMessage(
                "Live settings saved. Refresh open shopping pages to apply changes.",
              );
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Chrome extension ID
            <input
              value={value.extension_id}
              pattern="[a-p]{32}"
              onChange={(e) =>
                setValue({ ...value, extension_id: e.target.value.trim() })
              }
              placeholder="Paste the 32-letter ID"
            />
          </label>
          <p className="fine-print">
            Leave the ID blank to disconnect. Only this paired extension can
            call Live routes. No Gemini key is shared with Chrome.
          </p>
          {(
            [
              ["purchase_enabled", "Purchase insights"],
              [
                "auto_analyze",
                "Automatically interpret relevant shopping pages",
              ],
              ["guard_enabled", "Gambling Guard"],
              [
                "shield_enabled",
                "Shield Mode: cover gambling pages when my conditions apply",
              ],
              ["block_limit", "Cover when my weekly limit is reached"],
              ["block_cooldown", "Cover during my active cooldown"],
            ] as const
          ).map(([key, label]) => (
            <label className="check-label" key={key}>
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) =>
                  setValue({ ...value, [key]: e.target.checked })
                }
              />
              <span>{label}</span>
            </label>
          ))}
          <label>
            Weekly gambling limit (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={value.weekly_limit}
              onChange={(e) =>
                setValue({ ...value, weekly_limit: e.target.value })
              }
            />
          </label>
          <label>
            Purchase waiting period (hours)
            <input
              type="number"
              min="1"
              max="168"
              required
              value={value.wait_hours}
              onChange={(e) =>
                setValue({ ...value, wait_hours: Number(e.target.value) })
              }
            />
          </label>
          <button className="primary" disabled={busy}>
            Save Live settings
          </button>
          <p className="fine-print">
            Shield Mode is voluntary, off by default, and only applies when
            Gambling Guard is on. It covers detected pages; it does not block
            payments or prevent disabling the extension. You can turn it off
            here or in the extension. Gemini interprets limited product context
            only when enabled; Python calculates the financial impact.
          </p>
        </form>
      )}
      <details>
        <summary>Try the controlled demo pages</summary>
        <p>
          These pages contain fictional products and no checkout or betting
          service. For the judge demo, launch the separate demo profile using
          START LIVE DEMO.cmd; do not put fictional savings into your personal
          profile.
        </p>
        <p>
          <a href="/demo-sites/store.html" target="_blank" rel="noreferrer">
            Open fictional store
          </a>{" "}
          ·{" "}
          <a
            href="/demo-sites/sportsbook.html"
            target="_blank"
            rel="noreferrer"
          >
            Open fictional sportsbook
          </a>
        </p>
      </details>
    </section>
  );
}
