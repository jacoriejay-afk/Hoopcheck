import ExpoModulesCore
import StoreKit
import UIKit

public class HoopcheckStoreKitModule: Module {
  private let store = HoopcheckStoreKitCore()
  public func definition() -> ModuleDefinition {
    Name("HoopcheckStoreKit")
    Events("onTransaction")
    AsyncFunction("identity") { () async throws -> [String: String] in
      let value = try await self.store.identity()
      return ["id": value.id, "environment": value.environment, "signedJWS": value.signedJWS]
    }
    AsyncFunction("products") { () async throws -> [[String: Any]] in
      try await self.store.products().map { value in
        ["id": value.id, "title": value.title, "displayPrice": value.displayPrice, "price": value.price,
         "currency": value.currency, "groupID": value.groupID, "months": value.months,
         "trialDays": value.trialDays, "appleIntroEligible": value.appleIntroEligible]
      }
    }
    AsyncFunction("purchase") { (id: String, owner: String, identityID: String, introJWS: String, price: String, currency: String) async throws -> [String: Any] in
      let result = try await self.store.purchase(id, owner: owner, identityID: identityID, introJWS: introJWS, expectedPrice: price, expectedCurrency: currency)
      var output: [String: Any] = ["state": result.state]
      if let value = result.transaction { output["transaction"] = self.payload(value) }
      return output
    }
    AsyncFunction("transactions") { () async -> [[String: String]] in await self.store.availableTransactions().map(self.payload) }
    AsyncFunction("restore") { () async throws -> [[String: String]] in try await self.store.restore().map(self.payload) }
    AsyncFunction("finish") { (id: String) async throws in try await self.store.finish(id) }
    AsyncFunction("manage") { () async throws in
      guard let scene = await MainActor.run(body: { UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive } }) else { throw StoreFailure.unavailable }
      try await AppStore.showManageSubscriptions(in: scene)
    }
    OnStartObserving {
      Task { await self.store.start { [weak self] value in self?.sendEvent("onTransaction", self?.payload(value) ?? [:]) } }
    }
    OnStopObserving { Task { await self.store.stop() } }
    OnDestroy { Task { await self.store.stop() } }
  }
  private func payload(_ value: StoreTransaction) -> [String: String] {
    ["id": value.id, "originalID": value.originalID, "productID": value.productID,
     "accountToken": value.accountToken ?? "", "signedJWS": value.signedJWS]
  }
}
