# Add project specific ProGuard rules here.
# kotlinx.serialization needs its generated serializers kept — see
# https://github.com/Kotlin/kotlinx.serialization/blob/master/rules/consumer-proguard-rules.pro
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class app.chatmeo.mobile.**$$serializer { *; }
-keepclassmembers class app.chatmeo.mobile.** {
    *** Companion;
}
-keepclasseswithmembers class app.chatmeo.mobile.** {
    kotlinx.serialization.KSerializer serializer(...);
}
