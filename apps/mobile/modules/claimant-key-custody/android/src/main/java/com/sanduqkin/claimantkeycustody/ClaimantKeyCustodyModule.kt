package com.sanduqkin.claimantkeycustody

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import javax.crypto.KeyAgreement

private const val TEST_ALIAS = "com.sanduqkin.claimant-custody.probe-only.v2"
private const val ANDROID_KEYSTORE = "AndroidKeyStore"

class ClaimantKeyCustodyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ClaimantKeyCustody")

    AsyncFunction("inspectCapabilityAsync") {
      inspectCapability()
    }

    AsyncFunction("createTestKeyAsync") {
      createTestKey()
    }

    AsyncFunction("exerciseTestKeyAsync") {
      exerciseTestKey()
    }

    AsyncFunction("deleteTestKeyAsync") {
      deleteTestKey()
    }
  }

  private fun inspectCapability(): Map<String, Any> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return capability("unsupported_os", false, "unknown")
    }
    val context = appContext.reactContext
      ?: return capability("native_context_unavailable", false, "unknown")
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (!keyguard.isDeviceSecure) {
      return capability("secure_lock_required", false, "unknown")
    }

    // Android API 31-35 can create a per-use authenticated ECDH key, but cannot
    // bind KeyAgreement directly to BiometricPrompt.CryptoObject. Report this
    // distinction closed instead of claiming transaction-bound user presence.
    return capability(
      "transaction_bound_auth_unavailable",
      false,
      "unknown"
    )
  }

  private fun createTestKey(): Map<String, Any> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return operation("unsupported_os", false)
    }
    deleteTestKey()
    val generator = KeyPairGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_EC,
      ANDROID_KEYSTORE
    )
    val parameters = KeyGenParameterSpec.Builder(
      TEST_ALIAS,
      KeyProperties.PURPOSE_AGREE_KEY
    )
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(
        0,
        KeyProperties.AUTH_BIOMETRIC_STRONG
      )
      .setInvalidatedByBiometricEnrollment(true)
      .build()
    generator.initialize(parameters)
    val keyPair = generator.generateKeyPair()
    val privateKeyExportable = keyPair.private.encoded != null
    val securityLevel = securityLevel(keyPair.private)
    if (privateKeyExportable || securityLevel == "software" || securityLevel == "unknown") {
      deleteTestKey()
      return operation("hardware_guarantee_unavailable", false)
    }

    return mapOf(
      "result_class" to "created_probe_only",
      "passed" to true,
      "public_key" to Base64.encodeToString(
        x963(keyPair.public as ECPublicKey),
        Base64.NO_WRAP
      ),
      "public_key_encoding" to "ansi_x9_63_uncompressed",
      "hardware_security_level" to securityLevel,
      "private_key_exportable" to false,
      "user_presence_binding" to "per_use_key_policy_unexercised",
      "test_alias_only" to true
    )
  }

  private fun exerciseTestKey(): Map<String, Any> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return operation("unsupported_os", false)
    }
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val privateKey = keyStore.getKey(TEST_ALIAS, null)
      ?: return operation("key_not_found", false)
    val publicKey = keyStore.getCertificate(TEST_ALIAS)?.publicKey as? ECPublicKey
      ?: return operation("key_not_found", false)

    val peer = KeyPairGenerator.getInstance("EC").apply {
      initialize(ECGenParameterSpec("secp256r1"))
    }.generateKeyPair()

    return try {
      val claimantAgreement = KeyAgreement.getInstance("ECDH").apply {
        init(privateKey)
        doPhase(peer.public, true)
      }
      val peerAgreement = KeyAgreement.getInstance("ECDH").apply {
        init(peer.private)
        doPhase(publicKey, true)
      }
      val matched = claimantAgreement.generateSecret()
        .contentEquals(peerAgreement.generateSecret())
      operation(
        if (matched) "passed_without_transaction_binding" else "key_agreement_mismatch",
        false
      )
    } catch (_: UserNotAuthenticatedException) {
      operation("transaction_bound_auth_required", false)
    } catch (_: Exception) {
      operation("key_agreement_failed", false)
    }
  }

  private fun deleteTestKey(): Map<String, Any> {
    return try {
      KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
        if (containsAlias(TEST_ALIAS)) {
          deleteEntry(TEST_ALIAS)
        }
      }
      operation("deleted", true)
    } catch (_: Exception) {
      operation("deletion_failed", false)
    }
  }

  private fun securityLevel(privateKey: java.security.Key): String {
    return try {
      val factory = KeyFactory.getInstance(privateKey.algorithm, ANDROID_KEYSTORE)
      val info = factory.getKeySpec(privateKey, KeyInfo::class.java)
      when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "trusted_environment"
        KeyProperties.SECURITY_LEVEL_SOFTWARE -> "software"
        else -> "unknown"
      }
    } catch (_: Exception) {
      "unknown"
    }
  }

  private fun x963(publicKey: ECPublicKey): ByteArray {
    return byteArrayOf(0x04) +
      fixedWidth(publicKey.w.affineX, 32) +
      fixedWidth(publicKey.w.affineY, 32)
  }

  private fun fixedWidth(value: BigInteger, size: Int): ByteArray {
    val encoded = value.toByteArray()
    val unsigned = if (encoded.size > size) encoded.copyOfRange(encoded.size - size, encoded.size)
    else encoded
    return ByteArray(size - unsigned.size) + unsigned
  }

  private fun capability(
    resultClass: String,
    eligible: Boolean,
    hardwareSecurityLevel: String
  ): Map<String, Any> = mapOf(
    "result_class" to resultClass,
    "eligible" to eligible,
    "platform" to "android",
    "key_algorithm" to "p256_ecdh",
    "public_key_encoding" to "ansi_x9_63_uncompressed",
    "hardware_security_level" to hardwareSecurityLevel,
    "private_key_exportable" to false,
    "user_presence_binding" to "unavailable",
    "test_alias_only" to true
  )

  private fun operation(resultClass: String, passed: Boolean): Map<String, Any> =
    mapOf(
      "result_class" to resultClass,
      "passed" to passed,
      "test_alias_only" to true
    )
}
