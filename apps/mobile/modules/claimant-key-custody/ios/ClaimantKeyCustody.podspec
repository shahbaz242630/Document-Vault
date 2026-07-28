require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ClaimantKeyCustody'
  s.version        = package['version']
  s.summary        = 'Runtime-disconnected claimant hardware custody probe'
  s.description    = 'A test-only Secure Enclave capability probe with no production route.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Sanduqkin'
  s.homepage       = 'https://sanduqkin.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
