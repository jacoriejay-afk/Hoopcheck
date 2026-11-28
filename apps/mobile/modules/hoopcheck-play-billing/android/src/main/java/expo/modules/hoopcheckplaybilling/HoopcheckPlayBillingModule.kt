package expo.modules.hoopcheckplaybilling

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Read-only candidate. No purchase launch, acknowledgment, token export or
 * automatic connection at startup. Do not add a payment entry point until
 * server fulfillment and the signed sandbox are independently accepted.
 */
class HoopcheckPlayBillingModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var connection: BillingClient? = null
  private var activePromise: Promise? = null
  private var timeout: Runnable? = null
  private val productIds = setOf("hoopcheck.pro", "hoopcheck.premium")
  private val periods = mapOf("monthly" to "P1M", "six-month" to "P6M", "annual" to "P1Y")

  override fun definition() = ModuleDefinition {
    Name("HoopcheckPlayBilling")

    AsyncFunction("queryCatalog") { promise: Promise ->
      handler.post { query(promise) }
    }

    OnDestroy {
      handler.post {
        val client = connection
        if (client != null) complete(client, null)
      }
    }
  }

  private fun complete(client: BillingClient, rows: List<Map<String, String>>?) {
    if (connection !== client) return
    val promise = activePromise
    connection = null
    activePromise = null
    timeout?.let { handler.removeCallbacks(it) }
    timeout = null
    try { client.endConnection() } catch (_: Exception) {}
    if (rows == null) promise?.reject("ERR_PLAY_CATALOG", "Google Play catalog is unavailable.", null)
    else promise?.resolve(rows)
  }

  private fun query(promise: Promise) {
    if (connection != null) {
      promise.reject("ERR_PLAY_BUSY", "Google Play catalog is already being checked.", null)
      return
    }
    val context = appContext.reactContext?.applicationContext
    if (context == null) {
      promise.reject("ERR_PLAY_CATALOG", "Google Play catalog is unavailable.", null)
      return
    }
    val client = try {
      BillingClient.newBuilder(context)
        // This read-only module never handles purchases or forwards tokens.
        .setListener { _, _ -> }
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()
    } catch (_: Exception) {
      promise.reject("ERR_PLAY_CATALOG", "Google Play catalog is unavailable.", null)
      return
    }
    connection = client
    activePromise = promise
    val timer = Runnable { complete(client, null) }
    timeout = timer
    handler.postDelayed(timer, 15000L)
    try {
      client.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
          handler.post {
            if (connection !== client) return@post
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
              complete(client, null)
              return@post
            }
            try {
              val params = QueryProductDetailsParams.newBuilder().setProductList(productIds.map {
                QueryProductDetailsParams.Product.newBuilder()
                  .setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
              }).build()
              client.queryProductDetailsAsync(params) { billingResult, details ->
                handler.post {
                  if (connection === client) {
                    if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || details.unfetchedProductList.isNotEmpty()) {
                      complete(client, null)
                    } else {
                      try { complete(client, catalog(details.productDetailsList)) }
                      catch (_: Exception) { complete(client, null) }
                    }
                  }
                }
              }
            } catch (_: Exception) { complete(client, null) }
          }
        }
        override fun onBillingServiceDisconnected() {
          handler.post { complete(client, null) }
        }
      })
    } catch (_: Exception) { complete(client, null) }
  }

  private fun catalog(details: List<ProductDetails>): List<Map<String, String>>? {
    if (details.size != 2 || details.map { it.productId }.toSet() != productIds) return null
    val rows = mutableListOf<Map<String, String>>()
    for (product in details) {
      if (product.productType != BillingClient.ProductType.SUBS) return null
      for (offer in product.subscriptionOfferDetails.orEmpty()) {
        // Full-price auto-renewing base plans only. No trial, prepaid,
        // installment, replacement or promotional offers in this candidate.
        if (offer.offerId != null || offer.installmentPlanDetails != null) continue
        val expected = periods[offer.basePlanId] ?: continue
        val phase = offer.pricingPhases.pricingPhaseList.singleOrNull() ?: continue
        if (phase.billingPeriod != expected ||
          phase.recurrenceMode != ProductDetails.RecurrenceMode.INFINITE_RECURRING ||
          phase.priceAmountMicros <= 0 || phase.formattedPrice.isBlank() ||
          !phase.priceCurrencyCode.matches(Regex("[A-Z]{3}"))) continue
        rows.add(mapOf("productId" to product.productId, "basePlanId" to offer.basePlanId,
          "billingPeriod" to expected, "displayPrice" to phase.formattedPrice,
          "currency" to phase.priceCurrencyCode, "priceMicros" to phase.priceAmountMicros.toString()))
      }
    }
    // No incomplete catalog and no ambiguous duplicate base plan.
    if (rows.size != 6 || rows.map { it["productId"] to it["basePlanId"] }.toSet().size != 6) return null
    return rows
  }
}
