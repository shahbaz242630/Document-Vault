import CryptoKit
import DeviceCheck
import ExpoModulesCore
import Foundation
import Security

private let appAttestKeychainService = "com.sanduqkin.claimant-app-attest.probe-only"
private let appAttestKeychainAccount = "probe-only.app-attest-key-id.v1"
private let appAttestProbeBundleIdentifier = "com.sanduqkin.mobile.claimantappattestprobe"

public final class ClaimantAppAttestModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ClaimantAppAttest")

    AsyncFunction("inspectCapabilityAsync") { inspectAppAttestCapability() }
    AsyncFunction("ensureTestKeyAsync") { try await ensureTestKey() }
    AsyncFunction("attestTestKeyAsync") { (challengeBytes: String) in
      try await attestTestKey(challengeBytes: challengeBytes)
    }
    AsyncFunction("generateTestAssertionAsync") { (challengeBytes: String) in
      try await generateTestAssertion(challengeBytes: challengeBytes)
    }
    AsyncFunction("clearTestKeyIdentifierAsync") { clearTestKeyIdentifier() }
  }
}

private func inspectAppAttestCapability() -> [String: Any] {
  guard isAppAttestProbeBundle() else {
    return appAttestResult(resultClass: "probe_build_required", passed: false)
  }
  guard #available(iOS 27.0, *) else {
    return appAttestResult(resultClass: "ios_27_required", passed: false)
  }
  guard DCAppAttestService.shared.isSupported else {
    return appAttestResult(resultClass: "app_attest_unsupported", passed: false)
  }
  return appAttestResult(resultClass: "eligible", passed: true)
}

private func ensureTestKey() async throws -> [String: Any] {
  guard isAppAttestProbeBundle() else {
    return appAttestResult(resultClass: "probe_build_required", passed: false)
  }
  guard #available(iOS 27.0, *), DCAppAttestService.shared.isSupported else {
    return appAttestResult(resultClass: "app_attest_unavailable", passed: false)
  }
  if let existing = readTestKeyIdentifier() {
    return appAttestResult(
      resultClass: "key_available",
      passed: true,
      additional: ["app_attest_key_id": existing]
    )
  }
  let keyIdentifier = try await DCAppAttestService.shared.generateKey()
  try persistTestKeyIdentifier(keyIdentifier)
  return appAttestResult(
    resultClass: "key_generated",
    passed: true,
    additional: ["app_attest_key_id": keyIdentifier]
  )
}

private func attestTestKey(challengeBytes: String) async throws -> [String: Any] {
  guard isAppAttestProbeBundle() else {
    return appAttestResult(resultClass: "probe_build_required", passed: false)
  }
  guard #available(iOS 27.0, *), DCAppAttestService.shared.isSupported else {
    return appAttestResult(resultClass: "app_attest_unavailable", passed: false)
  }
  guard let keyIdentifier = readTestKeyIdentifier() else {
    return appAttestResult(resultClass: "key_not_found", passed: false)
  }
  let clientDataHash = try opaqueChallengeHash(challengeBytes)
  do {
    let attestation = try await DCAppAttestService.shared.attestKey(
      keyIdentifier,
      clientDataHash: clientDataHash
    )
    return appAttestResult(
      resultClass: "attestation_generated",
      passed: true,
      additional: [
        "app_attest_key_id": keyIdentifier,
        "attestation_object": attestation.base64EncodedString()
      ]
    )
  } catch {
    if (error as NSError).code == DCError.Code.serverUnavailable.rawValue {
      return appAttestResult(resultClass: "apple_service_unavailable", passed: false)
    }
    return appAttestResult(resultClass: "attestation_failed", passed: false)
  }
}

private func generateTestAssertion(challengeBytes: String) async throws -> [String: Any] {
  guard isAppAttestProbeBundle() else {
    return appAttestResult(resultClass: "probe_build_required", passed: false)
  }
  guard #available(iOS 27.0, *), DCAppAttestService.shared.isSupported else {
    return appAttestResult(resultClass: "app_attest_unavailable", passed: false)
  }
  guard let keyIdentifier = readTestKeyIdentifier() else {
    return appAttestResult(resultClass: "key_not_found", passed: false)
  }
  let clientDataHash = try opaqueChallengeHash(challengeBytes)
  do {
    let assertion = try await DCAppAttestService.shared.generateAssertion(
      keyIdentifier,
      clientDataHash: clientDataHash
    )
    return appAttestResult(
      resultClass: "assertion_generated",
      passed: true,
      additional: [
        "app_attest_key_id": keyIdentifier,
        "assertion_object": assertion.base64EncodedString()
      ]
    )
  } catch {
    return appAttestResult(resultClass: "assertion_failed", passed: false)
  }
}

private func opaqueChallengeHash(_ encoded: String) throws -> Data {
  guard encoded.count >= 22, encoded.count <= 16_384,
        encoded.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
        let bytes = decodeBase64URL(encoded) else {
    throw NSError(domain: "ClaimantAppAttest", code: 1)
  }
  return Data(SHA256.hash(data: bytes))
}

private func decodeBase64URL(_ value: String) -> Data? {
  var base64 = value.replacingOccurrences(of: "-", with: "+")
    .replacingOccurrences(of: "_", with: "/")
  let remainder = base64.count % 4
  if remainder != 0 { base64.append(String(repeating: "=", count: 4 - remainder)) }
  guard let decoded = Data(base64Encoded: base64),
        base64URL(decoded) == value else { return nil }
  return decoded
}

private func persistTestKeyIdentifier(_ value: String) throws {
  _ = clearTestKeyIdentifier()
  let status = SecItemAdd([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: appAttestKeychainService,
    kSecAttrAccount: appAttestKeychainAccount,
    kSecAttrAccessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    kSecValueData: Data(value.utf8)
  ] as CFDictionary, nil)
  guard status == errSecSuccess else {
    throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
  }
}

private func readTestKeyIdentifier() -> String? {
  var item: CFTypeRef?
  let status = SecItemCopyMatching([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: appAttestKeychainService,
    kSecAttrAccount: appAttestKeychainAccount,
    kSecReturnData: true,
    kSecMatchLimit: kSecMatchLimitOne
  ] as CFDictionary, &item)
  guard status == errSecSuccess, let data = item as? Data else { return nil }
  return String(data: data, encoding: .utf8)
}

private func clearTestKeyIdentifier() -> [String: Any] {
  guard isAppAttestProbeBundle() else {
    return appAttestResult(resultClass: "probe_build_required", passed: false)
  }
  let status = SecItemDelete([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: appAttestKeychainService,
    kSecAttrAccount: appAttestKeychainAccount
  ] as CFDictionary)
  let passed = status == errSecSuccess || status == errSecItemNotFound
  return appAttestResult(
    resultClass: passed ? "local_reference_cleared" : "local_reference_clear_failed",
    passed: passed
  )
}

private func isAppAttestProbeBundle() -> Bool {
  Bundle.main.bundleIdentifier == appAttestProbeBundleIdentifier
}

private func appAttestResult(
  resultClass: String,
  passed: Bool,
  additional: [String: Any] = [:]
) -> [String: Any] {
  var result: [String: Any] = [
    "result_class": resultClass,
    "passed": passed,
    "protocol_profile": "app_attest_adapter_v1",
    "test_alias_only": true
  ]
  additional.forEach { result[$0.key] = $0.value }
  return result
}

private func base64URL(_ value: Data) -> String {
  value.base64EncodedString()
    .replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
}
