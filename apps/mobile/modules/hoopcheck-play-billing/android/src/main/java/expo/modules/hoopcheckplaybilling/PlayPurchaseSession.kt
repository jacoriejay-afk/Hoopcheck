package expo.modules.hoopcheckplaybilling

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener

/**
 * Internal callback/recovery lifecycle. The owning sandbox adapter must create
 * the BillingClient with this listener and supply independently verified
 * account scope. No Expo export, acknowledgment or entitlement grant.
 * A callback is an invalidation signal, never transaction proof.
 */
internal class PlayPurchaseSession(
  private val onState: (String) -> Unit,
  private val onScan: (PlayPurchaseOperations.PurchaseScan) -> Unit
) : PurchasesUpdatedListener {
  private val handler = Handler(Looper.getMainLooper())
  private var generation = 0L
  private var accountId: String? = null
  private var client: BillingClient? = null
  private var queryActive = false
  private var refreshRequested = false
  private var timeout: Runnable? = null
  private var closed = false

  /** Only call after authenticated sandbox account identity is established. */
  fun bind(verifiedAccountId: String, billingClient: BillingClient) {
    handler.post {
      if (closed || !verifiedAccountId.matches(Regex("[a-f0-9]{64}"))) return@post
      clearQuery()
      generation++
      accountId = verifiedAccountId
      client = billingClient
    }
  }

  private fun clearQuery() {
    timeout?.let { handler.removeCallbacks(it) }
    timeout = null
    queryActive = false
    refreshRequested = false
  }

  /** Logout, account change, MFA lock or background invalidate late results. */
  fun invalidate() {
    handler.post {
      generation++
      clearQuery()
      accountId = null
      client = null
    }
  }

  fun close() {
    handler.post {
      closed = true
      generation++
      clearQuery()
      accountId = null
      client = null
    }
  }

  /** Explicit restore and foreground both re-query Play. */
  fun reconcile() { handler.post { refresh() } }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    handler.post {
      if (closed || accountId == null || client == null) return@post
      // Ignore callback purchase objects (even a forged success or stale token).
      when (result.responseCode) {
        BillingClient.BillingResponseCode.USER_CANCELED -> onState("cancelled")
        BillingClient.BillingResponseCode.OK -> onState("verifying")
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> onState("restore_required")
        else -> onState("retry")
      }
      refresh()
    }
  }

  private fun refresh() {
    val active = client ?: return
    val owner = accountId ?: return
    if (closed) return
    if (queryActive) { refreshRequested = true; return }
    val captured = ++generation
    queryActive = true
    val timer = Runnable { finish(captured, active, owner, null) }
    timeout = timer
    handler.postDelayed(timer, 15_000L)
    onState("verifying")
    PlayPurchaseOperations.restore(active, owner) { scan ->
      handler.post { finish(captured, active, owner, scan) }
    }
  }

  private fun finish(captured: Long, active: BillingClient, owner: String, scan: PlayPurchaseOperations.PurchaseScan?) {
    if (closed || !queryActive || generation != captured || client !== active || accountId != owner) return
    val rerun = refreshRequested
    clearQuery()
    if (scan == null) onState("retry")
    else {
      onState(if (scan.pendingCount > 0) "pending" else if (scan.unmatchedCount > 0) "retry" else "verification_required")
      onScan(scan)
    }
    if (rerun) refresh()
  }
}
