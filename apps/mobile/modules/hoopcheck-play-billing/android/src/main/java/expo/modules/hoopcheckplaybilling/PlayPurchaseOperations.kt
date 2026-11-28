package expo.modules.hoopcheckplaybilling

import android.app.Activity
import android.os.Looper
import android.os.SystemClock
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryPurchasesParams

/**
 * Internal candidate operations, deliberately not exposed to Expo JS.
 * A future coordinator must verify a server-issued purchase intent, account
 * session, purchase eligibility and fresh ProductDetails before calling.
 * No payment entry point may be exported until backend fulfillment is ready.
 */
internal object PlayPurchaseOperations {
  private val accountPattern = Regex("[a-f0-9]{64}")
  private val tokenPattern = Regex("[A-Za-z0-9._~-]{16,4096}")
  private val products = setOf("hoopcheck.pro", "hoopcheck.premium")
  private val periods = mapOf("monthly" to "P1M", "six-month" to "P6M", "annual" to "P1Y")

  // Not a data class: sensitive account ID must not appear in toString().
  internal class ReviewedQuote(
    val productId: String,
    val basePlanId: String,
    val priceMicros: Long,
    val currency: String,
    val obfuscatedAccountId: String,
    val fetchedAtElapsedMillis: Long
  )

  // No optimistic entitlement. Token is only for server-side verification.
  internal class VerificationCandidate(
    val productId: String,
    val token: String,
    val acknowledged: Boolean
  )

  internal class PurchaseScan(
    val candidates: List<VerificationCandidate>,
    val pendingCount: Int,
    val unmatchedCount: Int
  )

  private fun fullPriceOffer(details: ProductDetails, quote: ReviewedQuote): ProductDetails.SubscriptionOfferDetails? {
    if (details.productId != quote.productId || details.productType != BillingClient.ProductType.SUBS ||
      quote.productId !in products || !accountPattern.matches(quote.obfuscatedAccountId) ||
      quote.priceMicros <= 0 || !Regex("[A-Z]{3}").matches(quote.currency)) return null
    val period = periods[quote.basePlanId] ?: return null
    val matches = details.subscriptionOfferDetails.orEmpty().filter { offer ->
      val phase = offer.pricingPhases.pricingPhaseList.singleOrNull()
      offer.basePlanId == quote.basePlanId && offer.offerId == null &&
        offer.installmentPlanDetails == null && offer.offerToken.isNotBlank() &&
        phase != null && phase.billingPeriod == period &&
        phase.recurrenceMode == ProductDetails.RecurrenceMode.INFINITE_RECURRING &&
        phase.priceAmountMicros == quote.priceMicros && phase.priceCurrencyCode == quote.currency
    }
    return matches.singleOrNull()
  }

  /** Must be invoked on the main thread after fresh provider quote and verified
   * server intent. Returns only an immediate launch response, not a purchase. */
  internal fun launch(
    client: BillingClient, activity: Activity, details: ProductDetails, quote: ReviewedQuote
  ): String {
    if (Looper.myLooper() != Looper.getMainLooper() || !client.isReady ||
      activity.isFinishing || activity.isDestroyed || !activity.hasWindowFocus()) return "unavailable"
    val age = SystemClock.elapsedRealtime() - quote.fetchedAtElapsedMillis
    if (quote.fetchedAtElapsedMillis <= 0 || age < 0 || age > 60_000L) return "quote_changed"
    val offer = fullPriceOffer(details, quote) ?: return "quote_changed"
    return try {
      val item = BillingFlowParams.ProductDetailsParams.newBuilder()
        .setProductDetails(details).setOfferToken(offer.offerToken).build()
      val params = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(listOf(item))
        .setObfuscatedAccountId(quote.obfuscatedAccountId)
        .build()
      when (client.launchBillingFlow(activity, params).responseCode) {
        BillingClient.BillingResponseCode.OK -> "launched"
        BillingClient.BillingResponseCode.USER_CANCELED -> "cancelled"
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "restore_required"
        else -> "unavailable"
      }
    } catch (_: Exception) { "unavailable" }
  }

  /** Shared callback/restore filter. Account matching is not provider proof.
   * Pending purchases are never forwarded as verification candidates. */
  internal fun scan(result: BillingResult, purchases: List<Purchase>?, accountId: String): PurchaseScan? {
    if (!accountPattern.matches(accountId) || result.responseCode != BillingClient.BillingResponseCode.OK ||
      purchases == null || purchases.size > 100) return null
    val accepted = mutableListOf<VerificationCandidate>()
    val seen = mutableMapOf<String, Pair<String, Int>>()
    var pending = 0
    var unmatched = 0
    for (purchase in purchases) {
      val product = purchase.products.singleOrNull()
      if (purchase.accountIdentifiers?.obfuscatedAccountId != accountId || product == null || product !in products) {
        unmatched++
        continue
      }
      val token = purchase.purchaseToken
      if (!tokenPattern.matches(token)) { unmatched++; continue }
      val identity = product to purchase.purchaseState
      val previous = seen.putIfAbsent(token, identity)
      if (previous != null) {
        if (previous != identity) return null
        continue
      }
      if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
        pending++
        continue
      }
      if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) {
        unmatched++
        continue
      }
      accepted.add(VerificationCandidate(product, token, purchase.isAcknowledged))
    }
    return PurchaseScan(accepted, pending, unmatched)
  }

  /** Explicit recovery query only; caller owns connection, timeout and
   * account-generation fencing. Never acknowledges or consumes purchases. */
  internal fun restore(client: BillingClient, accountId: String, callback: (PurchaseScan?) -> Unit) {
    if (!client.isReady || !accountPattern.matches(accountId)) {
      callback(null)
      return
    }
    try {
      val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
      client.queryPurchasesAsync(params) { result, purchases ->
        callback(scan(result, purchases, accountId))
      }
    } catch (_: Exception) { callback(null) }
  }
}
