// Top-level build file — declares plugin versions once here (with apply false), applied per
// module in app/build.gradle.kts. Versions picked to match what this repo's own AGP/compileSdk
// choice was already validated against in CI (see the now-removed Capacitor scaffold's
// android/variables.gradle: compileSdk/targetSdk 36, AGP 8.13.0) — reusing those rather than
// guessing fresh ones keeps this on ground already proven to build on GitHub Actions' runners.
//
// Kotlin is pinned to 2.3.20, not 2.1.0 — Gradle resolves kotlin-stdlib by highest version among
// all dependencies, and org.jetbrains.kotlinx:kotlinx-serialization-{core,json}-jvm:1.11.0 (see
// app/build.gradle.kts) pulls in a transitive kotlin-stdlib built with Kotlin 2.3.20's metadata
// format. With the compiler plugin left at 2.1.0 that mismatch crashed compileDebugKotlin outright
// ("Module was compiled with an incompatible version of Kotlin... binary version of its metadata
// is 2.3.0, expected version is 2.1.0" — a real CI failure, not a hypothetical). Matching the
// compiler version to the resolved stdlib version fixes it.
plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.20" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.3.20" apply false
    // com.google.gms.google-services (Firebase/FCM) is added once google-services.json exists —
    // see the "Wire up FCM push notifications" follow-up. Applying it without that file present
    // fails the build outright, so it stays out until there's something for it to read.
}
