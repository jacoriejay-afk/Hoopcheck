import ExpoModulesCore
import UIKit

public class HoopcheckIconsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HoopcheckIcons")

    AsyncFunction("isSupported") { () -> Bool in
      return UIApplication.shared.supportsAlternateIcons
    }.runOnQueue(.main)

    AsyncFunction("current") { () -> String in
      return UIApplication.shared.alternateIconName ?? "Classic"
    }.runOnQueue(.main)

    AsyncFunction("select") { (name: String, promise: Promise) in
      guard ["Classic", "Blackout", "Orange"].contains(name), UIApplication.shared.supportsAlternateIcons else {
        promise.reject("ICON_UNAVAILABLE", "This icon is unavailable on this device.")
        return
      }
      UIApplication.shared.setAlternateIconName(name == "Classic" ? nil : name) { error in
        if error != nil {
          promise.reject("ICON_FAILED", "The icon could not be changed. Please try again.")
        } else {
          promise.resolve(name)
        }
      }
    }.runOnQueue(.main)
  }
}
