// Top-level build file — declares plugin versions once here (with apply false), applied per
// module in app/build.gradle.kts. Versions picked to match what this repo's own AGP/compileSdk
// choice was already validated against in CI (see the now-removed Capacitor scaffold's
// android/variables.gradle: compileSdk/targetSdk 36, AGP 8.13.0) — reusing those rather than
// guessing fresh ones keeps this on ground already proven to build on GitHub Actions' runners.
plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0" apply false
    // com.google.gms.google-services (Firebase/FCM) is added once google-services.json exists —
    // see the "Wire up FCM push notifications" follow-up. Applying it without that file present
    // fails the build outright, so it stays out until there's something for it to read.
}
