import XCTest
@testable import HoopcheckStoreKitCore
final class ProductPolicyTests: XCTestCase {
  func testMonthlyTrialRequiresExactlySevenFreeDays() throws {
    try MembershipProductRule.validate(id: "hoopcheck.pro.monthly", months: 1, currency: "USD", price: Decimal(string: "4.99")!, trialDays: 7, freeTrial: true)
    for days in [nil, 0, 6, 8, 14] as [Int?] {
      XCTAssertThrowsError(try MembershipProductRule.validate(id: "hoopcheck.pro.monthly", months: 1, currency: "USD", price: Decimal(string: "4.99")!, trialDays: days, freeTrial: true))
    }
    XCTAssertThrowsError(try MembershipProductRule.validate(id: "hoopcheck.pro.monthly", months: 1, currency: "USD", price: Decimal(string: "4.99")!, trialDays: 7, freeTrial: false))
  }
  func testPaidProductsCannotAcquireAnIntroductoryOffer() throws {
    for id in ["hoopcheck.pro.6month", "hoopcheck.premium.annual"] {
      let rule = MembershipProductRule.catalog[id]!
      try MembershipProductRule.validate(id: id, months: rule.months, currency: "USD", price: rule.usd, trialDays: nil, freeTrial: false)
      XCTAssertThrowsError(try MembershipProductRule.validate(id: id, months: rule.months, currency: "USD", price: rule.usd, trialDays: 7, freeTrial: true))
    }
  }
  func testUnknownFanProductsAndChangedTermsFailClosed() {
    XCTAssertThrowsError(try MembershipProductRule.validate(id: "hoopcheck.fan.monthly", months: 1, currency: "USD", price: 1, trialDays: 7, freeTrial: true))
    XCTAssertThrowsError(try MembershipProductRule.validate(id: "hoopcheck.premium.annual", months: 6, currency: "USD", price: Decimal(string: "101.90")!, trialDays: nil, freeTrial: false))
    XCTAssertThrowsError(try MembershipProductRule.validate(id: "hoopcheck.pro.annual", months: 12, currency: "USD", price: 1, trialDays: nil, freeTrial: false))
  }
  func testLocalizedPricesDoNotBecomeHardcodedUSDCharges() throws {
    try MembershipProductRule.validate(id: "hoopcheck.pro.annual", months: 12, currency: "EUR", price: Decimal(string: "59.99")!, trialDays: nil, freeTrial: false)
  }
}
