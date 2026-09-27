# Entry AutoFill

Loads an Excel/CSV file in a Chrome side panel and fills web form fields on
click — no copy-paste.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this `entry-autofill` folder
4. Open the website where you enter data, then click the extension's icon
   in the toolbar — a panel opens on the side (drag its edge to resize,
   e.g. to ~50% of the window)

## Use it

1. **Load your file** — choose your `.xlsx` or `.csv` in the panel
2. **Map fields (once per website)** — for each column, click **Map**, then
   click the matching box on the page. The mapping is remembered per site.
3. **Fill entries** — the panel shows the current row's values. Click
   **Fill this entry** to push them all into the page at once. Use
   **Prev / Next** to move through your rows.

## Notes

- If the portal changes its page layout, a mapped field may show
  "not found" — just click **Re-map** for that column.
- If a form clears itself after each submission (e.g. a fresh entry each
  time), you don't need to re-map — just click **Next** then **Fill** again.
- Re-mapping is per-site (based on the page's domain), so different portals
  keep separate mappings.
- This only fills fields already on the page — it doesn't click submit
  buttons, so you can double-check the entry before submitting.
