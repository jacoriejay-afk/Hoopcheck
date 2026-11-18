Pod::Spec.new do |s|
  s.name = 'HoopcheckIcons'
  s.version = '1.0.0'
  s.summary = 'Bundled HoopCheck alternate icon selection'
  s.description = 'Device-only cosmetic icon selection through UIApplication.'
  s.author = 'HoopCheck'
  s.homepage = 'https://hoopcheck.online'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/jacoriejay-afk/Hoopcheck.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
