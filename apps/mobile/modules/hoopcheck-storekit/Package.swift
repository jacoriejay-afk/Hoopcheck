// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "HoopcheckStoreKitCore",
  platforms: [.iOS(.v15), .macOS(.v13)],
  products: [.library(name: "HoopcheckStoreKitCore", targets: ["HoopcheckStoreKitCore"])],
  targets: [
    .target(name: "HoopcheckStoreKitCore", path: "ios", exclude: ["HoopcheckStoreKitModule.swift", "HoopcheckStoreKit.podspec"], sources: ["StoreKitCore.swift"]),
    .testTarget(name: "HoopcheckStoreKitCoreTests", dependencies: ["HoopcheckStoreKitCore"], path: "Tests")
  ]
)
