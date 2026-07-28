import CryptoKit
import ExpoModulesCore
import LocalAuthentication
import Security

private let testAlias = "com.sanduqkin.claimant-custody.probe-only.v2"
private let keychainService = "com.sanduqkin.claimant-custody.probe-only"

public final class ClaimantKeyCustodyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ClaimantKeyCustody")

    AsyncFunction("inspectCapabilityAsync") {
      return inspectCapability()
    }

    AsyncFunction("createTestKeyAsync") {
      return try createTestKey()
    }

    AsyncFunction("exerciseTestKeyAsync") {
      return try await exerciseTestKey()
    }

    AsyncFunction("deleteTestKeyAsync") {
      return deleteTestKey()
    }
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
  return [
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

  return [
    "result_class": "created",
    "passed": true,
    "public_key": key.publicKey.x963Representation.base64EncodedString(),
    "public_key_encoding": "ansi_x9_63_uncompressed",
    "private_key_exportable": false,
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
  let privateKey = try SecureEnclave.P256.KeyAgreement.PrivateKey(
    dataRepresentation: representation,
    authenticationContext: context
  )
  let peer = P256.KeyAgreement.PrivateKey()
  let claimantSecret = try privateKey.sharedSecretFromKeyAgreement(with: peer.publicKey)
  let peerSecret = try peer.sharedSecretFromKeyAgreement(with: privateKey.publicKey)
  let salt = Data("sanduqkin:claim:custody-probe:v2".utf8)
  let claimantProof = claimantSecret.hkdfDerivedSymmetricKey(
    using: SHA256.self,
    salt: salt,
    sharedInfo: Data(testAlias.utf8),
    outputByteCount: 32
  )
  let peerProof = peerSecret.hkdfDerivedSymmetricKey(
    using: SHA256.self,
    salt: salt,
    sharedInfo: Data(testAlias.utf8),
    outputByteCount: 32
  )
  let matched = claimantProof.withUnsafeBytes { claimantBytes in
    peerProof.withUnsafeBytes { peerBytes in
      Data(claimantBytes) == Data(peerBytes)
    }
  }

  return operation(
    resultClass: matched ? "passed" : "key_agreement_mismatch",
    passed: matched
  )
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
  guard status == errSecSuccess else {
    return nil
  }
  return item as? Data
}

private func operation(
  resultClass: String,
  passed: Bool
) -> [String: Any] {
  return [
    "result_class": resultClass,
    "passed": passed,
    "test_alias_only": true
  ]
}
