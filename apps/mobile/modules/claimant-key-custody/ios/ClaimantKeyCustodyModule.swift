import CryptoKit
import ExpoModulesCore
import LocalAuthentication
import Security

private let testAlias = "com.sanduqkin.claimant-custody.probe-only.v3"
private let keychainService = "com.sanduqkin.claimant-custody.probe-only"
private let protocolName = "sanduqkin:claim:native-enrollment:v1"
private let fingerprintLabel = "sanduqkin:claim:native-enrollment:public-key:v1"
private let proofKeyLabel = "sanduqkin:claim:native-enrollment:proof-key:v1"
private let proofMacLabel = "sanduqkin:claim:native-enrollment:proof-mac:v1"

public final class ClaimantKeyCustodyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ClaimantKeyCustody")

    AsyncFunction("inspectCapabilityAsync") { inspectCapability() }
    AsyncFunction("createTestKeyAsync") { try createTestKey() }
    AsyncFunction("exerciseTestKeyAsync") { try await exerciseTestKey() }
    AsyncFunction("deleteTestKeyAsync") { deleteTestKey() }
  }
}

private func inspectCapability() -> [String: Any] {
  guard SecureEnclave.isAvailable else {
    return capability(
      resultClass: "secure_hardware_unavailable",
      eligible: false,
      hardwareSecurityLevel: "none"
    )
  }

  let context = LAContext()
  var error: NSError?
  guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
    return capability(
      resultClass: "secure_lock_required",
      eligible: false,
      hardwareSecurityLevel: "secure_enclave"
    )
  }

  return capability(
    resultClass: "eligible",
    eligible: true,
    hardwareSecurityLevel: "secure_enclave"
  )
}

private func capability(
  resultClass: String,
  eligible: Bool,
  hardwareSecurityLevel: String
) -> [String: Any] {
  [
    "result_class": resultClass,
    "eligible": eligible,
    "platform": "ios",
    "key_algorithm": "p256_ecdh",
    "public_key_encoding": "ansi_x9_63_uncompressed",
    "hardware_security_level": hardwareSecurityLevel,
    "private_key_exportable": false,
    "user_presence_binding": "transaction_bound",
    "test_alias_only": true
  ]
}

private func createTestKey() throws -> [String: Any] {
  _ = deleteTestKey()

  guard SecureEnclave.isAvailable else {
    return operation(resultClass: "secure_hardware_unavailable", passed: false)
  }

  var accessError: Unmanaged<CFError>?
  guard let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    [.privateKeyUsage, .userPresence],
    &accessError
  ) else {
    throw accessError!.takeRetainedValue()
  }

  let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(
    accessControl: access,
    authenticationContext: LAContext()
  )
  let addStatus = SecItemAdd([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: keychainService,
    kSecAttrAccount: testAlias,
    kSecAttrAccessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    kSecValueData: key.dataRepresentation
  ] as CFDictionary, nil)
  guard addStatus == errSecSuccess else {
    throw NSError(
      domain: NSOSStatusErrorDomain,
      code: Int(addStatus),
      userInfo: [NSLocalizedDescriptionKey: "Unable to persist the probe key reference."]
    )
  }

  let publicKey = key.publicKey.x963Representation
  return [
    "result_class": "created",
    "passed": true,
    "public_key": base64URL(publicKey),
    "public_key_fingerprint": publicKeyFingerprint(publicKey),
    "public_key_encoding": "ansi_x9_63_uncompressed",
    "private_key_exportable": false,
    "protocol_profile": "native_enrollment_v1",
    "test_alias_only": true
  ]
}

private func exerciseTestKey() async throws -> [String: Any] {
  let context = LAContext()
  do {
    let authenticated = try await context.evaluatePolicy(
      .deviceOwnerAuthentication,
      localizedReason: "Verify claimant key custody"
    )
    guard authenticated else {
      return operation(resultClass: "authentication_failed", passed: false)
    }
  } catch {
    return operation(resultClass: "authentication_failed", passed: false)
  }

  guard let representation = readTestKeyRepresentation() else {
    return operation(resultClass: "key_not_found", passed: false)
  }
  let claimantKey = try SecureEnclave.P256.KeyAgreement.PrivateKey(
    dataRepresentation: representation,
    authenticationContext: context
  )
  let serverEphemeral = P256.KeyAgreement.PrivateKey()
  let salt = try secureRandomBytes(count: 32)
  let nonce = try secureRandomBytes(count: 32)
  let claimantPublicKey = claimantKey.publicKey.x963Representation
  let challenge = try canonicalChallenge(
    claimantPublicKey: claimantPublicKey,
    serverPublicKey: serverEphemeral.publicKey.x963Representation,
    salt: salt,
    nonce: nonce
  )
  let challengeDigest = Data(SHA256.hash(data: challenge))
  let proofInfo = separated(label: proofKeyLabel, value: challengeDigest)
  let proofInput = separated(label: proofMacLabel, value: challenge)

  let claimantAgreement = try claimantKey.sharedSecretFromKeyAgreement(
    with: serverEphemeral.publicKey
  )
  let serverAgreement = try serverEphemeral.sharedSecretFromKeyAgreement(
    with: claimantKey.publicKey
  )
  let claimantProofKey = claimantAgreement.hkdfDerivedSymmetricKey(
    using: SHA256.self,
    salt: salt,
    sharedInfo: proofInfo,
    outputByteCount: 32
  )
  let serverProofKey = serverAgreement.hkdfDerivedSymmetricKey(
    using: SHA256.self,
    salt: salt,
    sharedInfo: proofInfo,
    outputByteCount: 32
  )
  let proof = HMAC<SHA256>.authenticationCode(
    for: proofInput,
    using: claimantProofKey
  )
  let matched = HMAC<SHA256>.isValidAuthenticationCode(
    proof,
    authenticating: proofInput,
    using: serverProofKey
  )

  return [
    "result_class": matched ? "passed" : "possession_proof_mismatch",
    "passed": matched,
    "protocol_profile": "native_enrollment_v1",
    "public_key_fingerprint": publicKeyFingerprint(claimantPublicKey),
    "test_alias_only": true
  ]
}

private func canonicalChallenge(
  claimantPublicKey: Data,
  serverPublicKey: Data,
  salt: Data,
  nonce: Data
) throws -> Data {
  let challenge: [String: Any] = [
    "challenge_id": "62000000-0000-4000-8000-000000000016",
    "claimant_id": "22000000-0000-4000-8000-000000000002",
    "claimant_key_id": "32000000-0000-4000-8000-000000000013",
    "claimant_key_version": 1,
    "device_binding_digest": String(repeating: "11", count: 32),
    "eligibility_version": 1,
    "expires_at": "2030-01-01T00:05:00.000Z",
    "invitation_reference": "52000000-0000-4000-8000-000000000005",
    "invitation_version": 1,
    "issued_at": "2030-01-01T00:00:00.000Z",
    "kdf_salt": base64URL(salt),
    "nonce": base64URL(nonce),
    "origin": "https://api.synthetic.test",
    "policy_pack_id": "synthetic-death-only-v1",
    "policy_pack_version": 1,
    "protocol": protocolName,
    "public_key_fingerprint": publicKeyFingerprint(claimantPublicKey),
    "server_ephemeral_public_key": base64URL(serverPublicKey)
  ]
  return try JSONSerialization.data(
    withJSONObject: challenge,
    options: [.sortedKeys, .withoutEscapingSlashes]
  )
}

private func publicKeyFingerprint(_ publicKey: Data) -> String {
  base64URL(Data(SHA256.hash(data: separated(label: fingerprintLabel, value: publicKey))))
}

private func separated(label: String, value: Data) -> Data {
  var result = Data(label.utf8)
  result.append(0)
  result.append(value)
  return result
}

private func secureRandomBytes(count: Int) throws -> Data {
  var result = Data(count: count)
  let status = result.withUnsafeMutableBytes { buffer in
    SecRandomCopyBytes(kSecRandomDefault, count, buffer.baseAddress!)
  }
  guard status == errSecSuccess else {
    throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
  }
  return result
}

private func base64URL(_ value: Data) -> String {
  value.base64EncodedString()
    .replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
}

private func deleteTestKey() -> [String: Any] {
  let status = SecItemDelete([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: keychainService,
    kSecAttrAccount: testAlias
  ] as CFDictionary)
  let passed = status == errSecSuccess || status == errSecItemNotFound
  return operation(
    resultClass: passed ? "deleted" : "deletion_failed",
    passed: passed
  )
}

private func readTestKeyRepresentation() -> Data? {
  var item: CFTypeRef?
  let status = SecItemCopyMatching([
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: keychainService,
    kSecAttrAccount: testAlias,
    kSecReturnData: true,
    kSecMatchLimit: kSecMatchLimitOne
  ] as CFDictionary, &item)
  guard status == errSecSuccess else { return nil }
  return item as? Data
}

private func operation(resultClass: String, passed: Bool) -> [String: Any] {
  [
    "result_class": resultClass,
    "passed": passed,
    "test_alias_only": true
  ]
}
