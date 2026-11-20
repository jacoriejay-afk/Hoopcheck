import Foundation
import StoreKit

public struct MembershipProductRule: Sendable {
  public let months: Int
  public let usd: Decimal
  public var monthly: Bool { months == 1 }
  public static func validate(id: String, months: Int, currency: String, price: Decimal, trialDays: Int?, freeTrial: Bool, referenceUSD: Bool = true) throws {
    guard let rule = catalog[id], months == rule.months else { throw StoreFailure.configuration }
    guard !referenceUSD || currency != "USD" || price == rule.usd else { throw StoreFailure.configuration }
    if rule.monthly {
      guard freeTrial, trialDays == 7 else { throw StoreFailure.configuration }
    } else if trialDays != nil { throw StoreFailure.configuration }
  }
  public static let catalog: [String: MembershipProductRule] = [
    "hoopcheck.pro.monthly": .init(months: 1, usd: Decimal(string: "4.99")!),
    "hoopcheck.pro.6month": .init(months: 6, usd: Decimal(string: "26.95")!),
    "hoopcheck.pro.annual": .init(months: 12, usd: Decimal(string: "50.90")!),
    "hoopcheck.premium.monthly": .init(months: 1, usd: Decimal(string: "9.99")!),
    "hoopcheck.premium.6month": .init(months: 6, usd: Decimal(string: "53.95")!),
    "hoopcheck.premium.annual": .init(months: 12, usd: Decimal(string: "101.90")!)
  ]
}
public struct StoreProduct: Sendable {
  public let id: String, title: String, displayPrice: String, price: String, currency: String, groupID: String
  public let months: Int, trialDays: Int
  public let appleIntroEligible: Bool
}
public struct StoreTransaction: Sendable {
  public let id: String, originalID: String, productID: String, accountToken: String?, signedJWS: String
}
public struct StoreIdentity: Sendable {
  public let id: String, environment: String, signedJWS: String
}
public struct StorePurchaseResult: Sendable {
  public let state: String
  public let transaction: StoreTransaction?
}
public enum StoreFailure: Error, LocalizedError {
  case unavailable, unverified, configuration, accountChanged, busy, priceChanged
  public var errorDescription: String? {
    switch self {
    case .unavailable: return "Purchasing needs iOS 16 or later and an App Store account. Restore remains available."
    case .unverified: return "Apple could not verify this purchase. No membership was granted."
    case .configuration: return "Membership products need attention. Please try again later."
    case .accountChanged: return "Your App Store account changed. Reload membership options before purchasing."
    case .busy: return "A purchase is already in progress."
    case .priceChanged: return "The App Store price changed. Reload membership options before purchasing."
    }
  }
}

@available(iOS 15.0, macOS 12.0, *)
public actor HoopcheckStoreKitCore {
  private var updatesTask: Task<Void, Never>?
  private var purchasing = false
  public init() {}
  public func identity() async throws -> StoreIdentity {
    guard #available(iOS 16.0, macOS 13.0, *) else { throw StoreFailure.unavailable }
    let result = try await AppTransaction.shared
    guard case .verified(let value) = result else { throw StoreFailure.unverified }
    let environment: String
    if value.environment == .production { environment = "Production" }
    else if value.environment == .sandbox { environment = "Sandbox" }
    else { environment = "Xcode" }
    return StoreIdentity(id: value.appTransactionID, environment: environment, signedJWS: result.jwsRepresentation)
  }
  private func details(_ product: Product) async throws -> StoreProduct {
    guard let rule = MembershipProductRule.catalog[product.id], product.type == .autoRenewable,
          let subscription = product.subscription else { throw StoreFailure.configuration }
    let period = subscription.subscriptionPeriod
    let months: Int
    switch period.unit {
    case .month: months = period.value
    case .year: months = period.value * 12
    default: throw StoreFailure.configuration
    }
    let currency = product.priceFormatStyle.currencyCode
    var trialDays = 0
    if let offer = subscription.introductoryOffer {
      guard rule.monthly, offer.paymentMode == .freeTrial else { throw StoreFailure.configuration }
      switch offer.period.unit {
      case .day: trialDays = offer.period.value
      case .week: trialDays = offer.period.value * 7
      default: throw StoreFailure.configuration
      }
      guard trialDays == 7 else { throw StoreFailure.configuration }
    } else if rule.monthly { throw StoreFailure.configuration }
    let storefront = await Storefront.current
    try MembershipProductRule.validate(id: product.id, months: months, currency: currency,
      price: product.price, trialDays: subscription.introductoryOffer == nil ? nil : trialDays,
      freeTrial: subscription.introductoryOffer?.paymentMode == .freeTrial,
      referenceUSD: storefront?.countryCode == "USA")
    return StoreProduct(id: product.id, title: product.displayName, displayPrice: product.displayPrice,
      price: NSDecimalNumber(decimal: product.price).stringValue, currency: currency,
      groupID: subscription.subscriptionGroupID, months: months, trialDays: trialDays,
      appleIntroEligible: await subscription.isEligibleForIntroOffer)
  }
  public func products() async throws -> [StoreProduct] {
    let products = try await Product.products(for: Array(MembershipProductRule.catalog.keys))
    var values: [StoreProduct] = []
    for product in products { values.append(try await details(product)) }
    guard Set(values.map(\.groupID)).count <= 1 else { throw StoreFailure.configuration }
    return values.sorted { $0.id < $1.id }
  }
  private func transaction(_ result: VerificationResult<Transaction>) throws -> StoreTransaction {
    guard case .verified(let value) = result,
          MembershipProductRule.catalog[value.productID] != nil else { throw StoreFailure.unverified }
    return StoreTransaction(id: String(value.id), originalID: String(value.originalID), productID: value.productID,
      accountToken: value.appAccountToken?.uuidString.lowercased(), signedJWS: result.jwsRepresentation)
  }
  public func purchase(_ productID: String, owner: String, identityID: String, introJWS: String,
                       expectedPrice: String, expectedCurrency: String) async throws -> StorePurchaseResult {
    guard !purchasing else { throw StoreFailure.busy }
    guard let rule = MembershipProductRule.catalog[productID], let accountToken = UUID(uuidString: owner) else { throw StoreFailure.configuration }
    guard !rule.monthly || (!introJWS.isEmpty && introJWS.utf8.count <= 16384) else { throw StoreFailure.configuration }
    purchasing = true; defer { purchasing = false }
    let currentIdentity = try await identity()
    guard currentIdentity.id == identityID else { throw StoreFailure.accountChanged }
    guard let product = try await Product.products(for: [productID]).first else { throw StoreFailure.configuration }
    let metadata = try await details(product)
    guard metadata.price == expectedPrice && metadata.currency == expectedCurrency else { throw StoreFailure.priceChanged }
    var options: Set<Product.PurchaseOption> = [.appAccountToken(accountToken)]
    if rule.monthly { options.insert(.introductoryOfferEligibility(compactJWS: introJWS)) }
    switch try await product.purchase(options: options) {
    case .success(let result): return StorePurchaseResult(state: "purchased", transaction: try transaction(result))
    case .pending: return StorePurchaseResult(state: "pending", transaction: nil)
    case .userCancelled: return StorePurchaseResult(state: "cancelled", transaction: nil)
    @unknown default: throw StoreFailure.unavailable
    }
  }
  public func availableTransactions() async -> [StoreTransaction] {
    var values: [String: StoreTransaction] = [:]
    for await result in Transaction.currentEntitlements {
      if let value = try? transaction(result) { values[value.id] = value }
      if values.count >= 100 { break }
    }
    for await result in Transaction.unfinished {
      if let value = try? transaction(result) { values[value.id] = value }
      if values.count >= 100 { break }
    }
    return values.values.sorted { $0.id < $1.id }
  }
  public func restore() async throws -> [StoreTransaction] {
    // User-initiated only: sync can present an Apple account authentication sheet.
    try await AppStore.sync()
    return await availableTransactions()
  }
  public func finish(_ id: String) async throws {
    guard UInt64(id) != nil else { throw StoreFailure.configuration }
    for await result in Transaction.unfinished {
      guard case .verified(let value) = result, String(value.id) == id,
            MembershipProductRule.catalog[value.productID] != nil else { continue }
      // The JS coordinator calls this only after server acknowledgement.
      await value.finish(); return
    }
  }
  public func start(_ onTransaction: @escaping @Sendable (StoreTransaction) -> Void) {
    guard updatesTask == nil else { return }
    updatesTask = Task { [weak self] in
      for await result in Transaction.updates {
        if Task.isCancelled { return }
        guard let self, let value = try? await self.transaction(result) else { continue }
        onTransaction(value)
      }
    }
  }
  public func stop() { updatesTask?.cancel(); updatesTask = nil }
}
