package expo.modules.hoopcheckplaybilling

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.QueryProductDetailsParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Signed sandbox runtime bridge. This branch intentionally has an immutable
 * native release hold: even a forged JS configuration cannot open Play.
 * Removing this hold requires separately reviewed signed license-test
 * configuration, authenticated transport and provider/DB acceptance.
 */
class PlayBillingRuntimeModule : Module() {
  private val signedSandboxAccepted = false
  private val handler = Handler(Looper.getMainLooper())
  private var client: BillingClient? = null
  private var listener: PlayPurchaseSession? = null
  private var generation = 0L
  private var active: Promise? = null
  private var timeout: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("HoopcheckPlayRuntime")
    Events("onPlayPurchaseChanged")
    Function("isAccepted") { signedSandboxAccepted }
    AsyncFunction("launchReviewed") { product: String, plan: String, price: String, currency: String, account: String, expires: Double, promise: Promise ->
      handler.post {
        val micros = price.toLongOrNull()
        if (!signedSandboxAccepted || micros == null || micros <= 0L || !fresh(expires)) {
          promise.resolve("held")
        } else {
          connect(account, promise) { connection, revision ->
            val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
              QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.SUBS).build()
            )).build()
            connection.queryProductDetailsAsync(params) { result, details ->
              handler.post {
                if (!current(connection, revision)) return@post
                val item = details.productDetailsList.singleOrNull()
                val activity = appContext.currentActivity
                val outcome = if (result.responseCode != BillingClient.BillingResponseCode.OK ||
                  details.unfetchedProductList.isNotEmpty() || item == null || activity == null || !fresh(expires)) "held"
                else PlayPurchaseOperations.launch(connection, activity, item,
                  PlayPurchaseOperations.ReviewedQuote(product, plan, micros, currency, account, SystemClock.elapsedRealtime()))
                finish(connection, revision, outcome, outcome == "launched")
              }
            }
          }
        }
      }
    }
    AsyncFunction("restoreReviewed") { account: String, promise: Promise ->
      handler.post {
        if (!signedSandboxAccepted) promise.resolve(null)
        else connect(account, promise) { connection, revision ->
          PlayPurchaseOperations.restore(connection, account) { scan ->
            handler.post {
              if (!current(connection, revision)) return@post
              val payload = scan?.let { value ->
                mapOf("accountId" to account, "pendingCount" to value.pendingCount, "unmatchedCount" to value.unmatchedCount,
                  "candidates" to value.candidates.map { mapOf("accountId" to account, "productId" to it.productId, "token" to it.token) })
              }
              finish(connection, revision, payload, false)
            }
          }
        }
      }
    }
    Function("invalidateScope") { handler.post { reset() }; Unit }
    OnDestroy { handler.post { reset() } }
  }

  private fun fresh(expires: Double): Boolean {
    val delta = expires - System.currentTimeMillis()
    return expires.isFinite() && delta > 0 && delta <= 60_000
  }
  private fun current(connection: BillingClient, revision: Long): Boolean =
    signedSandboxAccepted && connection === client && revision == generation && active != null

  private fun reset() {
    generation++
    timeout?.let { handler.removeCallbacks(it) }
    timeout = null
    active?.resolve(null)
    active = null
    listener?.close()
    listener = null
    try { client?.endConnection() } catch (_: Exception) {}
    client = null
  }

  private fun finish(connection: BillingClient, revision: Long, result: Any?, keepConnection: Boolean) {
    if (!current(connection, revision)) return
    val promise = active
    active = null
    timeout?.let { handler.removeCallbacks(it) }
    timeout = null
    if (!keepConnection) reset()
    promise?.resolve(result)
  }

  private fun connect(account: String, promise: Promise, work: (BillingClient, Long) -> Unit) {
    if (!signedSandboxAccepted || !account.matches(Regex("[a-f0-9]{64}")) || active != null) {
      promise.resolve(null); return
    }
    reset()
    val context = appContext.reactContext?.applicationContext
    if (context == null) { promise.resolve(null); return }
    val revision = generation
    val callback = PlayPurchaseSession(
      onState = { state ->
        // Generic hints only. A fresh coordinator recovery is authoritative.
        if (revision == generation && state in setOf("cancelled", "pending", "retry", "verification_required", "restore_required"))
          sendEvent("onPlayPurchaseChanged", mapOf("state" to state))
      },
      onScan = { _ -> }
    )
    val connection = try {
      BillingClient.newBuilder(context)
        .setListener(callback)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()
    } catch (_: Exception) { promise.resolve(null); return }
    client = connection
    listener = callback
    active = promise
    callback.bind(account, connection)
    val timer = Runnable { finish(connection, revision, null, false) }
    timeout = timer
    handler.postDelayed(timer, 15_000L)
    try {
      connection.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
          handler.post {
            if (!current(connection, revision)) return@post
            if (result.responseCode != BillingClient.BillingResponseCode.OK) finish(connection, revision, null, false)
            else try { work(connection, revision) } catch (_: Exception) { finish(connection, revision, null, false) }
          }
        }
        override fun onBillingServiceDisconnected() {
          handler.post {
            if (current(connection, revision)) finish(connection, revision, null, false)
            else if (client === connection && generation == revision) {
              sendEvent("onPlayPurchaseChanged", mapOf("state" to "retry"))
              reset()
            }
          }
        }
      })
    } catch (_: Exception) { finish(connection, revision, null, false) }
  }
}
