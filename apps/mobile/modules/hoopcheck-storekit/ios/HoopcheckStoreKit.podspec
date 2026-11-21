Pod::Spec.new do |s|
  s.name = 'HoopcheckStoreKit'
  s.version = '1.0.0'
  s.summary = 'HoopCheck StoreKit 2 purchase and restoration bridge'
  s.description = 'Verified Apple transactions; server acknowledgement precedes finishing.'
  s.author = 'HoopCheck'
  s.homepage = 'https://hoopcheck.online'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/jacoriejay-afk/Hoopcheck.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
