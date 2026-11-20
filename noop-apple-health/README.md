# NOOP for iOS: WHOOP → Apple Health

## Executive summary

| Question | Answer |
|---|---|
| What is NOOP? | An unofficial, offline companion app for WHOOP straps. It pairs over Bluetooth, computes recovery, strain, HRV and sleep on-device, and needs no WHOOP subscription or cloud. |
| Canonical source | [`ryanbr/noop`](https://github.com/ryanbr/noop). `NoopApp/noop` returns 404. Other repos are forks or unrelated projects. |
| Latest iOS build | **v12.0.0** (2026-10-04): `NOOP-ios-unsigned-v12.0.0.ipa` |
| App Store? | **No.** You sideload it: AltStore/SideStore, or build in Xcode. |
| Apple Health today | Already two-way on iOS (`StrandiOS/Health/HealthKitBridge.swift`). **Gap:** write-back only covers the **last 14 days**. |
| What this patch adds | A **"Backfill history"** action (90 days / 1 year / everything). It pushes imported WHOOP history (sleep, recovery vitals, workouts) into Apple Health. |
| License | PolyForm Noncommercial 1.0.0. Personal use is fine; you cannot sell it or bundle it into a commercial (e.g. e&) offering. |

## 1. Get NOOP on your iPhone

**The key decision: you need a paid Apple Developer account ($99/yr) for Apple Health.**
A free Apple ID signature has no HealthKit entitlement. The app then shows "This install can't connect to Apple Health directly", and only the Shortcuts export workaround is left.

| Route | Apple Health | Effort | Re-sign |
|---|---|---|---|
| **A. Build in Xcode with a paid dev account** (recommended) | ✅ Full two-way + this backfill | Mac + Xcode | Yearly |
| B. AltStore/SideStore + paid dev account | ✅ | Low | Yearly |
| C. AltStore/SideStore + free Apple ID | ❌ (Shortcuts export only) | Low | Every 7 days |

**Route B/C (AltStore/SideStore):** add this source in the app:
`https://raw.githubusercontent.com/ryanbr/noop/main/altstore-source.json`
Or download the `.ipa` from the [Releases page](https://github.com/ryanbr/noop/releases) and sign it yourself.
**Note:** the stock IPA does **not** include this patch. To get the backfill, use Route A.

**Route A (with this patch), on a Mac:**

```bash
brew install xcodegen
git clone https://github.com/ryanbr/noop.git && cd noop
git am /path/to/Tracker/noop-apple-health/0001-feat-ios-health-backfill-full-WHOOP-strap-history-in.patch
xcodegen generate
open Strand.xcodeproj
# Set Signing & Capabilities → Team = your paid team for NOOPiOS AND NOOPiOSWidgets
# Select the NOOPiOS scheme → your iPhone → Run
```

## 2. Move your WHOOP data across

1. **Export your history from WHOOP.** Open the WHOOP app → Profile → App Settings → Data Export, and wait for the email with a `.zip`. It contains `physiological_cycles.csv`, `sleeps.csv`, `workouts.csv` and `journal_entries.csv`.
2. **Import it into NOOP.** Go to Data Sources → *Import WHOOP export* and pick the `.zip`.
3. **Connect Apple Health.** Go to Apple Health screen → *Enable Apple Health* and grant read and write.
4. **Push the history (new).** On the same card: *Backfill history* → *Everything*.
5. **Live strap (optional).** Quit the official WHOOP app or turn off its Bluetooth, then pair in NOOP.
   - WHOOP 4.0 is fully supported.
   - WHOOP 5.0/MG: live HR works; recovery, strain and sleep are still being mapped.
   - The strap holds **one bond at a time**, so the WHOOP app may need to re-pair afterwards.

## 3. What gets written to Apple Health

| Data | Routine sync (last 14 d) | Backfill (this patch) |
|---|---|---|
| Sleep incl. stages (in bed / core / deep / REM / awake) | ✅ | ✅ |
| Resting HR, HRV (SDNN), SpO₂, respiratory rate | ✅ | ✅ |
| Workouts | ✅ | ✅ |
| Continuous 1-min heart rate | ✅ (strap only) | ➖ excluded. A WHOOP CSV has none, and it would bloat Health by ~1.4k samples/day. |

**HRV caveat:** WHOOP reports **RMSSD** and Apple Health stores **SDNN**. NOOP deliberately writes only genuine SDNN, which it computes from strap R-R intervals. HRV rows that came only from a WHOOP CSV are therefore **not** written as HRV. Every other metric is.

## 4. Patch design (for review or an upstream PR)

| File | Change |
|---|---|
| `Packages/StrandImport/.../HealthWriteback.swift` | Pure helper `backfillWindows(fromTs:toTs:chunkDays:utcOffsetSec:)`. 30-day chunks, newest first, boundaries at **local noon** so a night never splits across two chunks. |
| `StrandiOS/Health/HealthKitBridge.swift` | `backfillHistory(days:)` reuses the existing idempotent vitals, sleep and workout writers per chunk. `writeVitals` now takes an explicit `fromTs`/`toTs`. Shares the `syncing` single-flight lock, and publishes progress and a summary. |
| `Strand/Screens/AppleHealthView.swift` | "Backfill history" menu (90 d / 1 y / everything), plus a progress bar and a result line. |
| `.../HealthWritebackBackfillTests.swift` | Unit tests: the chunks cover the range with no gaps or overlaps, boundaries fall at local noon, and UTC± zones and empty ranges behave. |

- **Idempotent.** Every sample carries a deterministic `HKMetadataKeyExternalUUID` (`noop:<kind>:<identity>`), and each write deletes then rewrites by that key. Re-running the backfill replaces data and never duplicates it.
- **Excluded on purpose.** The trailing 2 days stay with the routine pass, because it knows whether last night is still recording.

**Verification status:**
- The chunking algorithm passed an equivalent Python port across 4 time zones.
- The Swift code was **not compiled** in this environment, which has no Swift toolchain or Xcode.
- Before relying on it: run `swift test` in `Packages/StrandImport`, build in Xcode, and run one backfill on a device.

## Sources

- [ryanbr/noop (canonical repo)](https://github.com/ryanbr/noop) · `docs/IOS.md` · `altstore-source.json`
- [BGR](https://bgr.com/2193528/noop-app-use-whoop-band-without-subscription-fee/) · [Android Central](https://androidcentral.com/wearables/this-open-source-app-lets-you-use-your-whoop-without-a-monthly-fee) · [TechRadar](https://techradar.com/health-fitness/fitness-trackers/this-looks-awesome-theres-now-an-unofficial-open-source-app-for-reading-whoop-data-that-doesnt-need-a-subscription) · [Hackaday](https://hackaday.com/2026/07/15/making-a-locked-down-wearable-work-without-a-subscription/)

*NOOP is unofficial and not affiliated with WHOOP, Inc. Using it may conflict with WHOOP's terms of service.*
