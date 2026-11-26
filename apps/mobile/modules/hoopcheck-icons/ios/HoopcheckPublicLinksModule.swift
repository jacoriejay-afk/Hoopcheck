import AppIntents
import CoreSpotlight
import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers

// Only fixed public navigation categories. No profiles, messages, searches,
// reviews, game state, credentials or account identifiers leave the app.
private let domain = "online.hoopcheck.app.public-directory"
private let settingKey = "hoopcheck.publicSystemLinks.v1"
private let notification = Notification.Name("HoopCheckPublicSystemLink")
private let entries: [(id: String, title: String, path: String)] = [
  ("teams", "HoopCheck · Men's teams", "/teams"),
  ("womens", "HoopCheck · Women's teams", "/womens"),
  ("leagues", "HoopCheck · Leagues", "/leagues")
]
private func featureEnabled() -> Bool { Bundle.main.object(forInfoDictionaryKey: "HoopcheckPublicSystemLinksEnabled") as? Bool == true }
private func enabled() -> Bool { featureEnabled() && UserDefaults.standard.bool(forKey: settingKey) }
private final class PendingPublicLink {
  static let shared = PendingPublicLink()
  private let lock = NSLock()
  private var value: (String, Date)?
  func put(_ path: String) {
    guard enabled(), entries.contains(where: { $0.path == path }) else { return }
    lock.lock(); value = (path, Date()); lock.unlock()
    NotificationCenter.default.post(name: notification, object: nil)
  }
  func clear() { lock.lock(); value = nil; lock.unlock() }
  func take() -> String? {
    lock.lock(); defer { lock.unlock() }
    let pending = value; value = nil
    guard enabled(), let pending, Date().timeIntervalSince(pending.1) >= 0,
          Date().timeIntervalSince(pending.1) <= 120 else { return nil }
    return pending.0
  }
}
public class HoopcheckPublicLinkSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, continue userActivity: NSUserActivity,
                          restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    guard enabled(), userActivity.activityType == CSSearchableItemActionType,
          let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
          let item = entries.first(where: { domain + "." + $0.id == identifier }) else { return false }
    PendingPublicLink.shared.put(item.path)
    return true
  }
}

public class HoopcheckPublicLinksModule: Module {
  private var observer: NSObjectProtocol?
  public func definition() -> ModuleDefinition {
    Name("HoopcheckPublicLinks")
    Events("onPublicLink")
    AsyncFunction("isEnabled") { () -> Bool in enabled() }
    AsyncFunction("setEnabled") { (allow: Bool, promise: Promise) in
      // Disable access immediately even if index cleanup later fails.
      UserDefaults.standard.set(false, forKey: settingKey)
      PendingPublicLink.shared.clear()
      let index = CSSearchableIndex.default()
      index.deleteSearchableItems(withDomainIdentifiers: [domain]) { error in
        if let error { promise.reject("SPOTLIGHT_CLEANUP", error.localizedDescription); return }
        guard allow && featureEnabled() else { promise.resolve(false); return }
        let items = entries.map { entry -> CSSearchableItem in
          let attributes = CSSearchableItemAttributeSet(contentType: UTType.content)
          attributes.title = entry.title
          attributes.contentDescription = "Open the HoopCheck basketball directory."
          let item = CSSearchableItem(uniqueIdentifier: domain + "." + entry.id, domainIdentifier: domain, attributeSet: attributes)
          item.expirationDate = Date().addingTimeInterval(30 * 86400)
          return item
        }
        index.indexSearchableItems(items) { error in
          if let error { promise.reject("SPOTLIGHT_INDEX", error.localizedDescription); return }
          guard featureEnabled() else { promise.resolve(false); return }
          UserDefaults.standard.set(true, forKey: settingKey)
          promise.resolve(true)
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("takePending") { () -> String? in PendingPublicLink.shared.take() }
    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: notification, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onPublicLink", [:])
      }
    }
    OnStopObserving { self.removeObserver() }
    OnDestroy { self.removeObserver() }
  }
  private func removeObserver() {
    if let observer { NotificationCenter.default.removeObserver(observer); self.observer = nil }
  }
}

// The actions are navigation only. A device opt-in is required at execution.
// Existing React Native account/MFA navigation still controls destination access.
@available(iOS 16.0, *)
public struct HoopcheckOpenTeamsIntent: AppIntent {
  public static var title: LocalizedStringResource = "Open basketball teams"
  public static var openAppWhenRun: Bool = true
  public init() {}
  @MainActor public func perform() async throws -> some IntentResult {
    guard enabled() else { throw NSError(domain: domain, code: 1, userInfo: [NSLocalizedDescriptionKey: "Enable public system links in HoopCheck Settings first."]) }
    PendingPublicLink.shared.put("/teams")
    return .result()
  }
}
@available(iOS 16.0, *)
public struct HoopcheckOpenLeaguesIntent: AppIntent {
  public static var title: LocalizedStringResource = "Open basketball leagues"
  public static var openAppWhenRun: Bool = true
  public init() {}
  @MainActor public func perform() async throws -> some IntentResult {
    guard enabled() else { throw NSError(domain: domain, code: 1, userInfo: [NSLocalizedDescriptionKey: "Enable public system links in HoopCheck Settings first."]) }
    PendingPublicLink.shared.put("/leagues")
    return .result()
  }
}
@available(iOS 16.0, *)
public struct HoopcheckPublicAppShortcuts: AppShortcutsProvider {
  public static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: HoopcheckOpenTeamsIntent(), phrases: ["Open teams in \(.applicationName)"], shortTitle: "Basketball teams", systemImageName: "basketball")
    AppShortcut(intent: HoopcheckOpenLeaguesIntent(), phrases: ["Open leagues in \(.applicationName)"], shortTitle: "Basketball leagues", systemImageName: "trophy")
  }
}
