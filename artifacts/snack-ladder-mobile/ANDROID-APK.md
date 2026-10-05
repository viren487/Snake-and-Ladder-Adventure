# Android APK — phone-only build and download

The repository includes a manually started **Build Android APK** GitHub Actions
workflow. GitHub's Linux runner generates the native Android project and builds a
bundled, signed APK. No Expo account, EAS command, Android Studio, or signing secret
is needed for this personal/test build.

**An APK does not exist until a GitHub run succeeds.** Replit's mobile preview and
its web-build command are not APK generators. Native compilation is verified by
the GitHub job; having this workflow does not guarantee a first build will succeed.

## On your Android phone

1. Open GitHub in Chrome and sign in. Use **Desktop site** if controls are hidden.
2. In Replit's **Git / Version Control** panel, connect GitHub and create/select
   your repository. A private repository is fine. Commit and push the **whole
   workspace**, including `.github/workflows/android-apk.yml`, `lib`, `artifacts`,
   the root package files and lockfile. Do not upload just the mobile folder or
   include secrets, `node_modules`, or `.env` files.
3. Open the repository on GitHub, then **Actions → Build Android APK → Run workflow**.
   The workflow must be on the repository's default branch for this button to show.
4. Select the branch. The optional **backend_url** has two modes:
    - **Leave empty:** local and Pass & Play work without an internet connection.
      Online rooms need a backend origin, so configure one for an online-enabled build.
   - **Enter the published backend HTTPS origin:** for example the root URL of the
     published game/API, not an Expo QR URL, `/mobile`, `/api`, or a URL with a token.
     This bundles the domain into the APK; changing it requires another APK build.
     Obtain the actual published URL from Replit's publishing information, not a
     guessed domain. The API and its production database must be set up separately.
     A development URL is temporary and only works while that workspace is running.
5. Tap **Run workflow**, open the run, and wait. GitHub shows its progress and quota
   usage. A red failed job has no downloadable APK; inspect the failing step.
6. After a green success, open **Artifacts → Snake-Ladder-APK**. Download and extract
   the ZIP in your phone's Files app, then open **Snake-Ladder.apk**.
7. If prompted, allow **Install unknown apps** only for the browser/Files app you are
   using. Turn that permission off after installing. Do not disable Play Protect;
   investigate any security warning. Only install builds from your own trusted repo.

The APK needs neither Expo Go nor a running Metro server. Online play still needs
a reachable API. GitHub Actions quotas/billing depend on your account.

## Signing and updates

This is a release-mode bundle signed with the native template's **standard debug
certificate**, suitable for personal/testing use, **not a secure Play Store release**.
The workflow verifies the signature before uploading and supplies a SHA-256 checksum.
Replit does not submit Android apps to Google Play. Play Store distribution needs
separate release signing, a signed Android App Bundle, and a Play Console release.

Keep `android.package` and the signing certificate stable between updates. If an
update reports a signature mismatch, **do not uninstall** to get around it:
uninstalling removes the app's local saves. Diagnose signing first. Expo Go's saved
data belongs to Expo Go and is not automatically transferred into this separate app.
Production signing/store distribution requires separate setup.

## Configuration checks

```sh
node --test artifacts/snack-ladder-mobile/scripts/android-build-config.test.mjs
pnpm run typecheck:libs
pnpm --filter @workspace/snack-ladder-mobile run typecheck
```

The workflow uses the committed lockfile, read-only repository permissions and
commit-pinned third-party actions. Backend text is passed through an environment
variable and validated as an HTTPS origin, never interpolated into a shell command.