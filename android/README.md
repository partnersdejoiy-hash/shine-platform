# SHINE on Android

One Android app, a Trusted Web Activity: it opens https://app.shine.dejoiy.com full screen, with no
browser bar, using Chrome on the phone. Every web deploy updates the app at once; a new APK is only
needed to change the icon, name, colours or Android settings.

| App | Package | Opens |
|---|---|---|
| SHINE | `com.dejoiy.shine` | https://app.shine.dejoiy.com/app/chats |

The project is in `android/shine` (made like Dejoiy Mail's `android/mail`). It is built on GitHub only;
no Android tools are needed on the server.

## 1. Create the upload key (once)
On your own computer with Java (not the server):
```
bash android/keystore.sh shine-upload.jks
```
It asks for a password, then prints the keystore as base64 and the upload key's SHA-256.
Keep `shine-upload.jks` and its password private and backed up. Never commit them (`*.jks` is ignored).
Lose it and you can no longer update the app on phones that installed the APK.

## 2. Add the GitHub secrets
Repository **shine-platform** > Settings > Secrets and variables > Actions > New repository secret:
- `SHINE_UPLOAD_KEYSTORE_BASE64`: the base64 text
- `SHINE_KEYSTORE_PASSWORD`: the password

## 3. Build
Actions > **SHINE Android app** > **Run workflow**. Branch `feat/gen-z-look`, version code `1`,
version name `1.0.0`. Every later run needs a higher version code (2, 3, …).

When it is done, the release **SHINE Android 1.0.0** (tag `android-v1`) is on the repository's
**Releases** page with `shine-1.0.0.apk` (install on a phone) and `shine-1.0.0.aab` (Google Play), and
their SHA-256 in the notes.

Without the two secrets from step 2 the run stops with "Add the upload key secrets first
(android/README.md, steps 1 and 2)". It never releases an unsigned APK (Android will not install one).

GitHub shows **Run workflow** only for workflows that are on the default branch (`main`), so
`.github/workflows/android.yml` must be on `main` too.

## 4. Google Play (later)
Create the app, upload the `.aab` to Internal testing first, keep Play App Signing on (the default).
Privacy policy and data safety: as for Dejoiy Mail (chats, files, calls; encrypted in transit; not sold).

## 5. Link the app to the site (removes the address bar)
Put the SHA-256 fingerprints in `android/shine/fingerprints.json`:
```
{ "sha256": ["AB:CD:…"] }
```
- the upload key's (from step 1): it signs the APKs on the Releases page;
- after Google Play: the app signing key's (Play Console > Setup > App signing).

Commit, then update the site (`bash deploy/contabo/update.sh`). The build writes
https://app.shine.dejoiy.com/.well-known/assetlinks.json from that file (`[]` while it is empty;
a wrong entry stops the build). Check that the address opens and shows your fingerprint.

## Install the APK without Play Store
1. On the phone, open the **shine-platform** **Releases** page in Chrome and open the newest
   **SHINE Android** release.
2. Under **Assets**, tap `shine-<version>.apk`. If you want to be sure it is the file GitHub built,
   compare its SHA-256 with the release notes.
3. Open the downloaded file. The first time, Android says the browser may not install apps: tap
   **Settings**, switch on **Allow from this source** (Settings > Apps > Special app access >
   **Install unknown apps** > Chrome), go back and tap **Install**.
4. Open **SHINE** from the home screen and sign in.

Until the fingerprints of step 5 are live, the app shows a small address bar at the top. It works the
same. Installing a newer release over an older one keeps the sign-in, as long as both were signed with
the same upload key.

## How it starts
1. Android shows the splash: the still SHINE logo on paper white (#FFFBF7). Android only allows a
   still picture here.
2. The site's own loading screen takes over with the same logo, size and colours, gently moving
   (still when the phone asks for reduced motion). It fades as soon as the app has drawn itself, and
   after 5 seconds at the latest.

## Changing the app
Edit `android/shine/twa-manifest.json` and the matching values in `android/shine/app/build.gradle`
(the `twaManifest` block). The icons in `android/shine/app/src/main/res` and `public/icon-*.png` are
drawn from `public/logo.svg`. Bump the version code and run the workflow again.
