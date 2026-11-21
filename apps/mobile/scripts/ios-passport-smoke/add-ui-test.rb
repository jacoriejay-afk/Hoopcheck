require 'xcodeproj'
project_path = File.expand_path('../../ios/HoopCheck.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.product_type == 'com.apple.product-type.application' }
raise 'Missing HoopCheck app target' unless app && app.name == 'HoopCheck'
target = project.new_target(:ui_test_bundle, 'PassportSmokeUITests', :ios, '15.1')
target.add_dependency(app)
target.build_configurations.each do |configuration|
  configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'online.hoopcheck.app.passportsmoke'
  configuration.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  configuration.build_settings['SWIFT_VERSION'] = '5.0'
  configuration.build_settings['TEST_TARGET_NAME'] = app.name
  configuration.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end
file = project.new_file(File.expand_path('PassportUITests.swift', __dir__))
target.source_build_phase.add_file_reference(file)
project.save
scheme_path = File.join(project_path, 'xcshareddata/xcschemes/HoopCheck.xcscheme')
scheme = Xcodeproj::XCScheme.new(scheme_path)
scheme.add_test_target(target)
scheme.save_as(project_path, 'HoopCheck', true)
